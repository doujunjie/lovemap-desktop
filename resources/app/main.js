'use strict'

/**
 * 恋爱地图 · 桌面版启动器
 *
 * 结构：
 *   CoupleMap.exe            ← Electron 壳（就是改名后的 electron.exe）
 *   resources/app/           ← 本目录的 main.js / setup.html / preload.js
 *   resources/love-map-server.jar   ← Spring Boot 后端（前端静态文件已打进 jar）
 *   resources/runtime/       ← jlink 裁出来的 JRE，用户机器上不需要装 JDK
 *
 * 两种模式：
 *   host   —— 本机当“主机”：启动内置后端，数据存在本机，自己用 http://127.0.0.1:端口，
 *             伴侣在同一 WiFi 下用 http://局域网IP:端口 访问。
 *   client —— 本机当“客户端”：不自启后端，直接打开对方主机的地址。
 *
 * 设计取舍：host 模式下一定要有一台一直开着的机器，这是“两个人共享同一份数据”的硬性前提，
 * 与是否花钱无关（免费云主机也可以，见 README）。
 */

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const net = require('node:net')
const http = require('node:http')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')

const JAR_NAME = 'love-map-server.jar'
const DEFAULT_PORT = 8080
const PORT_SCAN_LIMIT = 20
const HEALTH_TIMEOUT_MS = 60_000
// 固定数据目录名：打包后 Electron 会用 package.json 的 productName（中文）当 userData，
// 开发模式和打包版于是会落到不同目录，数据看起来“丢了”。这里统一钉死。
const APP_DATA_FOLDER = '恋爱地图'

app.setPath('userData', path.join(app.getPath('appData'), APP_DATA_FOLDER))

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {BrowserWindow | null} */
let setupWindow = null
/** @type {import('node:child_process').ChildProcess | null} */
let serverProcess = null

let config = null
let starting = null

// ---------------------------------------------------------------- 路径与配置

function appRoot() {
    // 打包后：<安装目录>/resources；开发时：D:\CoupleMap\desktop
    return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..')
}

function paths() {
    if (app.isPackaged) {
        return {
            java: path.join(process.resourcesPath, 'runtime', 'bin', 'java.exe'),
            jar: path.join(process.resourcesPath, JAR_NAME),
        }
    }
    return {
        java: path.join(appRoot(), 'build', 'runtime', 'bin', 'java.exe'),
        jar: findDevJar(),
    }
}

/** 开发模式下 target 里的 jar 带版本号（love-map-server-1.0.0.jar），这里自动找 */
function findDevJar() {
    const dir = path.join(appRoot(), 'love-map-server', 'target')
    try {
        const candidates = fs.readdirSync(dir).filter((name) => /^love-map-server-.*\.jar$/.test(name))
        // 优先普通的可执行 jar（不是 .jar.original）
        const main = candidates.find((name) => name === JAR_NAME) || candidates.find((name) => !name.endsWith('.original'))
        if (main) {
            return path.join(dir, main)
        }
    } catch {
        /* ignore */
    }
    return path.join(dir, JAR_NAME)
}

/** 启动过程写一份简单日志，出问题时用户能直接把 startup.log 发过来 */
function trace(message) {
    try {
        fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'), `${new Date().toISOString()} ${message}\n`)
    } catch {
        /* ignore */
    }
}

function configPath() {
    return path.join(app.getPath('userData'), 'config.json')
}

function dataDir() {
    return path.join(app.getPath('userData'), 'data')
}

function loadConfig() {
    try {
        // 记事本另存为时可能带 BOM，JSON.parse 会直接抛错，这里先去掉
        const text = fs.readFileSync(configPath(), 'utf8').replace(/^\uFEFF/, '')
        config = JSON.parse(text)
    } catch {
        config = null
    }
    return config
}

function saveConfig(next) {
    config = next
    fs.mkdirSync(path.dirname(configPath()), { recursive: true })
    fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
}

function backupDataDir() {
    // 换模式时数据留在原处，不删；只提示位置，避免用户以为数据丢了
    return dataDir()
}

// ---------------------------------------------------------------- 网络工具

function lanAddresses() {
    const result = []
    for (const [name, list] of Object.entries(os.networkInterfaces())) {
        for (const item of list || []) {
            if (item.family === 'IPv4' && !item.internal) {
                result.push({ name, address: item.address })
            }
        }
    }
    return result
}

function isPortFree(port) {
    return new Promise((resolve) => {
        const server = net.createServer()
        server.once('error', () => resolve(false))
        server.once('listening', () => server.close(() => resolve(true)))
        server.listen(port, '0.0.0.0')
    })
}

async function pickPort() {
    for (let port = DEFAULT_PORT; port < DEFAULT_PORT + PORT_SCAN_LIMIT; port += 1) {
        if (await isPortFree(port)) {
            return port
        }
    }
    return new Promise((resolve, reject) => {
        const server = net.createServer()
        server.once('error', reject)
        server.listen(0, '0.0.0.0', () => {
            const { port } = server.address()
            server.close(() => resolve(port))
        })
    })
}

function httpGet(url, timeoutMs = 2000) {
    return new Promise((resolve) => {
        const request = http.get(url, { timeout: timeoutMs }, (response) => {
            let body = ''
            response.setEncoding('utf8')
            response.on('data', (chunk) => {
                body += chunk
            })
            response.on('end', () => resolve({ status: response.statusCode, body }))
        })
        request.on('timeout', () => {
            request.destroy()
            resolve({ status: 0, body: '' })
        })
        request.on('error', () => resolve({ status: 0, body: '' }))
    })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 轮询 /actuator/health，直到后端真的起来（Flyway 迁移也在启动阶段完成） */
async function waitForHealth(port) {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS
    while (Date.now() < deadline) {
        if (serverProcess && serverProcess.exitCode !== null) {
            throw new Error('后端进程已退出，请查看日志：' + serverLogPath())
        }
        const { status, body } = await httpGet(`http://127.0.0.1:${port}/actuator/health`)
        if (status === 200 && body.includes('"UP"')) {
            return true
        }
        await sleep(400)
    }
    throw new Error('后端启动超时，请查看日志：' + serverLogPath())
}

function serverLogPath() {
    return path.join(app.getPath('userData'), 'server.log')
}

/** 每次安装生成一个独立 JWT 密钥，避免用仓库里公开的默认值 */
function ensureJwtSecret() {
    if (config && config.jwtSecret) {
        return config.jwtSecret
    }
    const secret = crypto.randomBytes(32).toString('hex')
    saveConfig({ ...(config || {}), jwtSecret: secret })
    return secret
}

// ---------------------------------------------------------------- 后端进程

async function startBackend() {
    if (starting) {
        return starting
    }
    // 已经在跑且健康就直接复用，避免重复 spawn 抢同一个端口
    if (serverProcess && config && config.port) {
        const { status, body } = await httpGet(`http://127.0.0.1:${config.port}/actuator/health`)
        if (status === 200 && body.includes('"UP"')) {
            return config.port
        }
        stopBackend()
    }
    starting = (async () => {
        const { java, jar } = paths()
        trace(`startBackend java=${java} jar=${jar}`)
        if (!fs.existsSync(java)) {
            throw new Error(`找不到内置 Java 运行时：${java}\n请重新解压完整的安装包。`)
        }
        if (!fs.existsSync(jar)) {
            throw new Error(`找不到后端程序：${jar}\n请重新解压完整的安装包。`)
        }

        const port = (config && config.port) || (await pickPort())
        const data = dataDir()
        fs.mkdirSync(path.join(data, 'uploads'), { recursive: true })

        const log = fs.createWriteStream(serverLogPath(), { flags: 'a' })
        log.write(`\n===== ${new Date().toISOString()} 启动后端 port=${port} =====\n`)

        serverProcess = spawn(java, [
            '-jar', jar,
            '--spring.profiles.active=app',
            `--server.port=${port}`,
            `--server.address=0.0.0.0`,
            `--jwt.secret=${ensureJwtSecret()}`,
        ], {
            cwd: data,
            env: { ...process.env, APP_DATA_DIR: data, SERVER_PORT: String(port) },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        })
        serverProcess.stdout.pipe(log)
        serverProcess.stderr.pipe(log)
        serverProcess.on('exit', (code) => {
            log.write(`\n===== 后端退出 code=${code} =====\n`)
            serverProcess = null
        })

        await waitForHealth(port)
        trace(`backend ready port=${port}`)
        saveConfig({ ...config, port })
        return port
    })()

    try {
        return await starting
    } finally {
        starting = null
    }
}

function stopBackend() {
    if (!serverProcess) {
        return
    }
    try {
        // /T 连同 java 子进程一起结束，避免残留占端口
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(serverProcess.pid), '/T', '/F'], { windowsHide: true })
        } else {
            serverProcess.kill('SIGTERM')
        }
    } catch {
        /* ignore */
    }
    serverProcess = null
}

// ---------------------------------------------------------------- 窗口

function createWindow(urlOrFile, options = {}) {
    const window = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 960,
        minHeight: 640,
        show: false,
        backgroundColor: '#ffffff',
        autoHideMenuBar: false,
        webPreferences: options.setup
            ? {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
            }
            : {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
            },
    })

    window.once('ready-to-show', () => window.show())

    // 外链一律用系统浏览器打开，不在 app 里开新窗口
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
            return { action: 'allow' }
        }
        shell.openExternal(url)
        return { action: 'deny' }
    })

    if (options.setup) {
        window.loadFile(path.join(__dirname, 'setup.html'))
    } else {
        window.loadURL(urlOrFile)
    }
    return window
}

function showSetup() {
    if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.focus()
        setupWindow.webContents.send('setup:refresh')
        return setupWindow
    }
    setupWindow = createWindow(null, { setup: true })
    setupWindow.on('closed', () => {
        setupWindow = null
    })
    return setupWindow
}

function showMain(url) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(url)
        mainWindow.focus()
        return mainWindow
    }
    mainWindow = createWindow(url)
    mainWindow.on('closed', () => {
        mainWindow = null
    })
    return mainWindow
}

async function enterAppFromConfig() {
    trace(`enterAppFromConfig mode=${config && config.mode}`)
    if (!config || !config.mode) {
        showSetup()
        return
    }
    if (config.mode === 'client') {
        showMain(normalizeUrl(config.remoteUrl))
        return
    }
    try {
        const port = await startBackend()
        showMain(`http://127.0.0.1:${port}/`)
        buildMenu()
    } catch (error) {
        trace(`startBackend failed: ${error && error.message}`)
        showSetup()
        dialog.showErrorBox('启动失败', String(error.message || error))
    }
}

function normalizeUrl(input) {
    const text = String(input || '').trim()
    if (!text) {
        return ''
    }
    if (/^https?:\/\//i.test(text)) {
        return text.replace(/\/$/, '') + '/'
    }
    return `http://${text.replace(/\/$/, '')}/`
}

function buildMenu() {
    const template = [
        {
            label: '文件',
            submenu: [
                { label: '共享/连接设置…', click: () => showSetup() },
                { label: '打开数据目录', click: () => shell.openPath(dataDir()) },
                { label: '查看后端日志', click: () => shell.openPath(serverLogPath()) },
                { type: 'separator' },
                { label: '退出', role: 'quit' },
            ],
        },
        {
            label: '视图',
            submenu: [
                { role: 'reload', label: '刷新' },
                { role: 'toggleDevTools', label: '开发者工具' },
                { role: 'resetZoom', label: '实际大小' },
                { role: 'zoomIn', label: '放大' },
                { role: 'zoomOut', label: '缩小' },
                { role: 'togglefullscreen', label: '全屏' },
            ],
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '怎么让 TA 访问？',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: '共享方式',
                            message: '同一 WiFi 下',
                            detail:
                                '主机模式启动后，在菜单「文件 → 共享/连接设置」里可以看到局域网地址，\n' +
                                '发给 TA，用手机或电脑浏览器打开即可。\n\n' +
                                '不在一起时\n' +
                                '免费做法：安装 Tailscale（免费），两台设备加入同一网络后用 Tailscale 地址访问；\n' +
                                '或者把数据托管到一台免费云主机上（Oracle Always Free），详见项目 README。',
                            buttons: ['知道了'],
                        })
                    },
                },
                { label: '打开设置页面', click: () => showSetup() },
            ],
        },
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------------------------------------------------------------- IPC（只给设置页用）

ipcMain.handle('setup:info', async () => ({
    mode: config && config.mode ? config.mode : null,
    port: config && config.port ? config.port : null,
    remoteUrl: config && config.remoteUrl ? config.remoteUrl : '',
    lanIps: lanAddresses(),
    dataDir: dataDir(),
    serverRunning: Boolean(serverProcess),
    serverLog: serverLogPath(),
}))

ipcMain.handle('setup:start-host', async () => {
    try {
        saveConfig({ ...(config || {}), mode: 'host', remoteUrl: '' })
        const port = await startBackend()
        showMain(`http://127.0.0.1:${port}/`)
        buildMenu()
        return { ok: true, port, lanIps: lanAddresses() }
    } catch (error) {
        return { ok: false, message: String(error.message || error) }
    }
})

ipcMain.handle('setup:test', async (_event, rawUrl) => {
    const url = normalizeUrl(rawUrl)
    if (!url) {
        return { ok: false, message: '地址不能为空' }
    }
    const { status, body } = await httpGet(`${url}actuator/health`, 4000)
    if (status === 200 && body.includes('"UP"')) {
        return { ok: true }
    }
    return { ok: false, message: status === 0 ? '连不上：检查地址、WiFi 是否同一网络、主机是否已启动' : `对方返回了 ${status}` }
})

ipcMain.handle('setup:connect', async (_event, rawUrl) => {
    const url = normalizeUrl(rawUrl)
    if (!url) {
        return { ok: false, message: '地址不能为空' }
    }
    const check = await httpGet(`${url}actuator/health`, 4000)
    if (!(check.status === 200 && check.body.includes('"UP"'))) {
        return { ok: false, message: '连不上对方主机，先确认对方已经打开「主机模式」' }
    }
    stopBackend()
    saveConfig({ ...(config || {}), mode: 'client', remoteUrl: url })
    showMain(url)
    buildMenu()
    return { ok: true }
})

ipcMain.handle('setup:reset', async () => {
    stopBackend()
    const secret = config && config.jwtSecret
    saveConfig({ jwtSecret: secret })
    // 先开设置页再关主窗口，否则最后一个窗口关闭会触发 window-all-closed 直接退出
    showSetup()
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close()
        mainWindow = null
    }
    return { ok: true }
})

ipcMain.handle('setup:open-app', async () => {
    if (!config || !config.mode) {
        return { ok: false, message: '还没有选择模式' }
    }
    enterAppFromConfig()
    if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.close()
    }
    return { ok: true }
})

ipcMain.handle('setup:open-path', async (_event, kind) => {
    if (kind === 'data') {
        fs.mkdirSync(dataDir(), { recursive: true })
        return shell.openPath(dataDir())
    }
    return shell.openPath(serverLogPath())
})

// ---------------------------------------------------------------- 生命周期

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        const target = mainWindow || setupWindow
        if (target) {
            if (target.isMinimized()) target.restore()
            target.focus()
        }
    })

    app.whenReady().then(async () => {
        trace(`ready packaged=${app.isPackaged} userData=${app.getPath('userData')}`)
        loadConfig()
        trace(`config loaded: ${JSON.stringify(config)}`)
        buildMenu()
        await enterAppFromConfig()
        app.on('activate', () => {
            if (!mainWindow && !setupWindow) {
                enterAppFromConfig()
            }
        })
    }).catch((error) => {
        trace(`whenReady failed: ${error && error.stack}`)
    })

    process.on('uncaughtException', (error) => {
        trace(`uncaughtException: ${error && error.stack}`)
    })

    app.on('window-all-closed', () => {
        app.quit()
    })

    app.on('before-quit', () => {
        stopBackend()
    })

    process.on('exit', () => stopBackend())
}

'use strict'

/**
 * 设置页逻辑：只负责展示和调用 preload 暴露的方法。
 * 所有“启动后端 / 写配置”的动作都在主进程做。
 */

const panels = {
    choose: document.getElementById('panel-choose'),
    host: document.getElementById('panel-host'),
    client: document.getElementById('panel-client'),
    busy: document.getElementById('panel-busy'),
}

function show(name) {
    Object.values(panels).forEach((panel) => panel.classList.remove('active'))
    panels[name].classList.add('active')
}

function setStatus(elementId, text, kind) {
    const element = document.getElementById(elementId)
    element.textContent = text || ''
    element.className = 'status' + (kind ? ' ' + kind : '')
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch {
        // file:// 下 clipboard API 可能不可用，退回老办法
        const helper = document.createElement('textarea')
        helper.value = text
        helper.style.position = 'fixed'
        helper.style.opacity = '0'
        document.body.appendChild(helper)
        helper.select()
        let ok = false
        try {
            ok = document.execCommand('copy')
        } catch {
            ok = false
        }
        document.body.removeChild(helper)
        return ok
    }
}

function renderLanList(info) {
    const container = document.getElementById('lan-list')
    container.textContent = ''
    if (!info.port) {
        return
    }
    const targets = info.lanIps.length
        ? info.lanIps.map((item) => ({ label: item.address, text: `http://${item.address}:${info.port}` }))
        : [{ label: '本机', text: `http://127.0.0.1:${info.port}` }]

    for (const target of targets) {
        const row = document.createElement('div')
        row.className = 'addr'

        const code = document.createElement('code')
        code.textContent = target.text

        const button = document.createElement('button')
        button.className = 'ghost'
        button.textContent = '复制'
        button.addEventListener('click', async () => {
            const ok = await copyText(target.text)
            button.textContent = ok ? '已复制' : '复制失败'
            setTimeout(() => {
                button.textContent = '复制'
            }, 1500)
        })

        row.appendChild(code)
        row.appendChild(button)
        container.appendChild(row)
    }

    if (info.lanIps.length === 0) {
        const hint = document.createElement('p')
        hint.className = 'hint'
        hint.textContent = '没有检测到局域网 IP（可能没连 WiFi）；先用本机地址自己用。'
        container.appendChild(hint)
    }
}

async function refresh() {
    const info = await window.lovemap.info()
    if (!info.mode) {
        show('choose')
        return
    }
    if (info.mode === 'host') {
        renderLanList(info)
        show('host')
        return
    }
    document.getElementById('client-url').textContent = info.remoteUrl || '-'
    show('client')
}

async function startHost() {
    show('busy')
    const result = await window.lovemap.startHost()
    if (!result.ok) {
        show('choose')
        setStatus('status-choose', result.message, 'error')
        return
    }
    await refresh()
}

async function testConnection() {
    const url = document.getElementById('input-url').value
    setStatus('status-choose', '正在测试…')
    const result = await window.lovemap.test(url)
    setStatus('status-choose', result.ok ? '连接成功，可以点「连接并使用」了' : result.message, result.ok ? 'ok' : 'error')
}

async function connect() {
    const url = document.getElementById('input-url').value
    setStatus('status-choose', '正在连接…')
    const result = await window.lovemap.connect(url)
    if (!result.ok) {
        setStatus('status-choose', result.message, 'error')
        return
    }
    await refresh()
}

document.getElementById('btn-host').addEventListener('click', startHost)
document.getElementById('btn-test').addEventListener('click', testConnection)
document.getElementById('btn-connect').addEventListener('click', connect)
document.getElementById('btn-open-host').addEventListener('click', () => window.lovemap.openApp())
document.getElementById('btn-open-client').addEventListener('click', () => window.lovemap.openApp())
document.getElementById('btn-reset-host').addEventListener('click', () => window.lovemap.reset())
document.getElementById('btn-reset-client').addEventListener('click', () => window.lovemap.reset())
document.getElementById('btn-datadir').addEventListener('click', () => window.lovemap.openPath('data'))

window.lovemap.onRefresh(() => refresh())
refresh()

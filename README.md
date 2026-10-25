# 恋爱地图 · 桌面版

一个记录"两个人去过哪里"的地图相册：在地图上打点、上传照片、看时间线、看省份足迹、看统计。
**双击就能用**——不用装 Java，不用装 MySQL，不用装 Node，也不用连数据库。

## 下载安装包

安装包不放在仓库里（exe 有 188 MB，超过 GitHub 单文件 100 MB 限制），请在
**[Releases · doujunjie/lovemap-desktop](https://github.com/doujunjie/lovemap-desktop/releases)** 下载
`lovemap-desktop-1.0.0-win64.zip`，解压出 `恋爱地图` 文件夹后双击里面的 `恋爱地图.exe`。
（安装包 SHA-256：`3abb219353b7736a68a35365e045989942f8fd6d6450dfd1899104c1e43b5b2d`）

> ⚠️ 别只把 exe 单独拷出来——它依赖同目录的 `resources\`、`locales\` 与一批 DLL，单独放会启动失败。整个解压出来的文件夹一起用即可，无需安装任何东西。

- 程序位置：解压后的 `恋爱地图.exe`
- 数据位置：`%APPDATA%\恋爱地图\data`（即 `C:\Users\<你>\AppData\Roaming\恋爱地图\data`）
- 两个人一起用：一台电脑当"主机"，另一台用浏览器或本程序连过来

---

## 一、一分钟上手

1. 双击 `恋爱地图.exe`。
2. 第一次启动会问你：**这台电脑当主机**，还是**连接到对方的主机**？
   - 选「这台电脑当主机」→ 窗口里会列出你这台机器的局域网地址，比如 `http://192.168.1.14:8080`。
3. 注册一个账号 → 创建情侣空间 → 记下 6 位**邀请码**。
4. 让对方（同一个 WiFi 下）用浏览器打开 `http://192.168.1.14:8080`，
   注册自己的账号 → 输入邀请码 → 绑定。之后两个人看到的就是同一份数据。
5. 如果对方也想用桌面程序：把整个 `E:\CoupleMap` 目录拷给他，
   启动时选「连接到对方的主机」，填 `192.168.1.14:8080` 即可。

> Windows 第一次启动可能弹防火墙提示，请勾选「专用网络」并允许，否则对方连不上。

---

## 二、目录结构

```
E:\CoupleMap\
├── 恋爱地图.exe              ← 双击这个
├── README.md                ← 本文件
├── 使用说明.txt              ← 极简版说明
└── resources\
    ├── app\                 ← 桌面壳代码（Electron 主进程 + 设置页）
    │   ├── main.js          ← 启动/关闭后端、窗口、菜单、设置页逻辑
    │   ├── preload.js
    │   ├── setup.html / setup.js
    │   └── package.json
    ├── love-map-server.jar  ← 后端 + 前端静态资源（单端口 8080）
    └── runtime\             ← 裁剪版 Java 21 运行时（约 60 MB，jlink 生成）
```

整个目录是**绿色便携**的：拷到任何 Windows 10/11 x64 机器上双击即用，不写注册表。
但注意：数据不在这个目录里，而在 `%APPDATA%\恋爱地图`（见第四节），所以换目录/升级不会丢数据。

---

## 三、使用说明

### 3.1 两种模式

| 模式 | 谁的数据 | 数据存在哪 | 适用 |
|---|---|---|---|
| 主机（host） | 这台电脑 | 这台电脑的 `%APPDATA%\恋爱地图\data` | 长期用、想随时打开 |
| 连接（client） | 对方的主机 | 不存本地 | 只想用对方的数据 |

切换方式：菜单「文件 → 共享 / 连接设置」。切换会重启后端（几秒）。

### 3.2 主机模式：怎么让对方连上

- **同一个 WiFi / 同一个路由器**：把窗口里显示的地址（形如 `http://192.168.1.14:8080`）发给对方，
  对方浏览器直接打开就行，不需要装任何东西。手机连同一个 WiFi 也能用。
- **手机热点**：让主机连上手机热点，再看窗口里的地址。
- **不在一起（异地）**：两条免费路线（见第九节）：Tailscale 组网后填 `100.x.x.x:8080`；
  或者用 Cloudflare Tunnel 拿到一个临时 https 域名，本程序"连接模式"直接填域名。
- 主机那台电脑**必须开着机、程序在运行**，对方才连得上——这是"共享同一份数据"的代价。

### 3.3 菜单

| 菜单 | 作用 |
|---|---|
| 文件 → 共享 / 连接设置 | 重新选主机/连接模式 |
| 文件 → 打开数据目录 | 直接打开 `%APPDATA%\恋爱地图\data` |
| 文件 → 查看后端日志 | 打开 `server.log`（后端）+ `startup.log`（启动流程） |
| 帮助 → 怎么让 TA 访问？ | 弹窗里有同样的说明 |
| 视图 | 缩放、全屏、开发者工具（排查用） |

### 3.4 数据在哪、怎么备份、怎么迁移

```
%APPDATA%\恋爱地图\
├── data\
│   ├── db\lovemap.mv.db        ← 全部文字数据（H2 单文件）
│   └── uploads\                ← 上传的照片和缩略图（UUID 文件名）
├── config.json                 ← 模式、端口、JWT 密钥（自动生成，别乱改）
├── startup.log                 ← 桌面壳日志
└── server.log                  ← 后端日志（启动失败先看这个）
```

- **备份**：退出程序 → 复制整个 `data` 目录到别处（U 盘、网盘）。
- **恢复**：退出程序 → 用备份的 `data` 覆盖回去 → 启动。
- **换电脑**：新机器装好本程序 → 退出 → 把备份的 `data` 拷到新机器的
  `%APPDATA%\恋爱地图\data` → 启动。
- **升级程序**：直接替换 `E:\CoupleMap` 里的文件（`恋爱地图.exe`、`resources\`），
  数据在 `%APPDATA%`，完全不受影响。

### 3.5 程序升级时怎么不丢配置

`config.json` 里有 `jwtSecret`（登录令牌的签名密钥）。**换掉它，所有人需要重新登录**，
但不会丢数据。正常升级不会碰它。

---

## 四、数据安全：关机、断电、强制结束会不会丢数据

结论：**已经提交的数据不会丢**（实测），但要区分三种情况。

1. **正常关窗口 / 正常关机**
   桌面壳会先结束后端进程，H2 每次提交都已落盘。安全。

2. **断电 / 直接按电源键 / 任务管理器强杀**
   本程序用的是 H2 的 MVStore 文件库，并显式配置了 `WRITE_DELAY=0`
   ——每笔事务提交时立即写盘并同步，不等 500ms 的批处理缓冲。
   实测：提交一个新地点后 0.3 秒内执行 `taskkill /F`，重复 3 次，
   重启后 3 条记录一条不少（`0 lost`），启动也无须人工修复。
   崩溃后再次启动时，H2 会自动从最后一个完整提交点恢复。

3. **真正的风险（这些才需要备份）**
   - 硬盘坏、误删 `%APPDATA%\恋爱地图`、系统重装没备份；
   - 把 `data` 目录放进 OneDrive / 坚果云等同步盘 → 两台机器同时写同一个 `.mv.db` **会损坏**；
   - 两台电脑同时用"主机模式"指向同一份数据文件（不要这么做）。

   照片是文件，`uploads` 里是普通 jpg/png，误删就是真没了。
   **建议每月复制一次 `data` 目录**，这个动作 10 秒钟，能救回所有回忆。

---

## 五、技术架构

### 5.1 技术栈

| 层 | 选型 |
|---|---|
| 后端 | Spring Boot 3.3.5、Java 21、Spring Security（JWT）、MyBatis-Plus 3.5.7、Flyway、Actuator、Thumbnailator（缩略图） |
| 数据库 | H2 2.2.224 文件库，`MODE=MySQL`，`DATABASE_TO_LOWER=TRUE`、`NON_KEYWORDS=USER`、`WRITE_DELAY=0` |
| 前端 | Vue 3.5 + TypeScript 5.6 + Vite 5 + Element Plus 2.8 + Leaflet 1.9（地图）+ ECharts 5.5（统计图）+ Pinia + axios + dayjs |
| 桌面 | Electron 33.4.11（主进程 + 设置页），jlink 裁剪 Java 21 运行时 |
| 打包 | `build-app.ps1`：npm build → mvn package → jlink → 组装目录（可选 zip） |

### 5.2 进程结构

```
恋爱地图.exe (Electron 主进程)
├── 设置页 setup.html （file:// 本地页面，选主机/连接模式）
├── 主窗口 BrowserWindow → http://127.0.0.1:8080/  （Vue 前端）
└── 子进程 java.exe（resources\runtime\bin\java.exe）
      -jar resources\love-map-server.jar
      --spring.profiles.active=app
      --server.port=8080 --server.address=0.0.0.0
      --jwt.secret=<首次启动随机生成，存 config.json>
      APP_DATA_DIR=%APPDATA%\恋爱地图\data
        └── H2 文件库 db\lovemap.mv.db + uploads\
```

启动顺序：Electron 先 spawn java → 轮询 `GET /actuator/health`（60 秒超时）→ UP 之后才开窗口。
端口从 8080 起试，被占用就顺延最多 20 个，再不行交给系统分配（地址会显示在设置页里）。

### 5.3 单端口设计（关键）

原来的项目是"前端 5173 + 后端 8080 + MySQL"，这种结构没法直接共享给第二个人。
改造后**只有 8080 一个端口**，同时承担：

- 前端页面（`GET /`、`/map`、`/timeline` …）
- REST API（`/api/**`）
- 上传文件（`/uploads/**`）
- 健康检查（`/actuator/health`）

怎么做到的：

1. **前端产物打进 jar**：`love-map-server/pom.xml` 里有个 `bundle-web` profile，
   检测到 `../love-map-web/dist/index.html` 就自动激活，在 `process-resources` 阶段把 dist
   拷进 `target/classes/static`。
2. **SPA 路由回退**：`SpaForwardController` 把 `/`、`/login`、`/map`、`/timeline`、`/route`、
   `/province`、`/anniversaries`、`/stats` 转发到 `index.html`（只列真实路由，乱敲的路径仍是 404）。
3. **安全规则收窄**：`SecurityConfig` 只对 `/api/**` 要求认证，静态资源和 SPA 路由放行；
   未登录访问 API 返回 401 JSON（不是 403 HTML），前端拦截器据此跳登录页。
4. **不存在的静态资源返回 404**：`GlobalExceptionHandler` 单独处理
   `NoResourceFoundException`，否则会被兜底的 `Exception` 处理器变成 500。

结果：一个端口 = 一个地址，局域网共享、Tailscale、Cloudflare Tunnel 都只需要暴露这一个。

### 5.4 数据库改造（MySQL → 内嵌 H2）

| 项 | 做法 |
|---|---|
| 迁移脚本 | 单独一套 `db/migration-h2/V1__init.sql`（原 MySQL 的 `db/migration` 原样保留，服务器版还能用） |
| 语法差异 | 去掉 `ENGINE=InnoDB`、`CHARSET`、列 `COMMENT`、`ON UPDATE CURRENT_TIMESTAMP`；索引用独立 `CREATE INDEX IF NOT EXISTS`；外键不要 `ON UPDATE CASCADE` |
| 存量迁移合并 | H2 版 V1 已并入 MySQL 版 V2（`(user_id, deleted)` 唯一键）、V3（`city` 列），并补了 `province` 列 |
| MySQL 专有 SQL | `StatsMapper.countMonthlyCheckIns` 改用 `SUBSTRING(CAST(visit_date AS CHAR(10)), 1, 7) AS ym` + `visit_date >= #{since}`（since 由 Java 传 `LocalDate`）；`DATE_FORMAT`、`DATE_SUB(CURDATE(), …)` 全部去掉 |
| 别名坑 | H2 里 `month`、`count` 是函数名，不能当列别名，所以 `AS month/AS count` 改成 `AS ym/AS cnt`；`StatsService` 读 Map 时做了大小写不敏感兜底 |
| 保留字坑 | 表名 `user` 是 H2 保留字 → 连接串加 `NON_KEYWORDS=USER,VALUE` |

为什么不继续用 MySQL：MySQL 要单独装服务、配账号、开端口，与"双击即用"冲突；
H2 是单文件、纯 Java、零配置，Flyway 迁移照常工作。

### 5.5 安全设计

- **JWT 密钥**：仓库里的默认密钥是公开的，所以桌面壳首次启动用
  `crypto.randomBytes(32)` 生成一个随机密钥存进 `config.json`，启动时通过
  `--jwt.secret=` 传进去。每台机器各不相同。
- **密码**：BCrypt 哈希存储。
- **接口鉴权**：只保护 `/api/**`；401/403 都返回统一 JSON。
- **上传文件**：`/uploads/**` 免登录（图片要能直接显示），文件名是 UUID，不可枚举。
- **Swagger**：桌面版 profile 关闭（`springdoc` 相关开关置 false）。
- **监听范围**：`0.0.0.0:8080`（否则对方连不上）。这意味着**同一网络内的人都能访问到登录页**，
  所以密码别用弱口令；要暴露到公网时优先用 Tailscale（私有网络），而不是把 8080 直接映射出去。

### 5.6 桌面壳做了什么（`resources\app\main.js`）

- 找 jar 和运行时（打包后 `resources\runtime`，开发模式 `build\runtime`）；
- 首次生成并保存 JWT 密钥；
- spawn java 子进程，stdout/stderr 写 `server.log`；
- 轮询健康检查，就绪后打开主窗口；失败时显示设置页并给出日志路径；
- 单实例锁（重复双击只是聚焦已有窗口）；
- 退出时 `taskkill /pid <pid> /T /F` 结束后端，不留孤儿进程；
- 固定数据目录为 `%APPDATA%\恋爱地图`（Electron 默认会用 `productName` 当目录名，
  开发模式和打包版会不一致，这里用 `app.setPath('userData', …)` 钉死）；
- 中文菜单：切换模式、打开数据目录、看日志、帮助；
- 主窗口不挂 preload（没有 IPC 能力），外部链接一律用系统浏览器打开。

### 5.7 体积

| 部分 | 大小 |
|---|---|
| Electron 运行时 + exe | 约 230 MB（其中 `恋爱地图.exe` 180 MB） |
| Java 运行时（jlink 裁剪） | 约 60 MB |
| 后端 jar（含前端静态资源） | 约 47 MB |
| 合计 | **约 375 MB** |

---

## 六、常见问题

**双击后一直转圈 / 白屏？**
看 `%APPDATA%\恋爱地图\startup.log`（壳的启动流程）和 `server.log`（后端）。
最常见原因是端口被占用或上一个 java 进程没退干净——任务管理器里结束 `java.exe` 再试。

**对方打不开地址？**
1. 两台设备在同一个 WiFi？手机流量不行。
2. 主机防火墙是否允许"专用网络"（控制面板 → Windows Defender 防火墙 → 允许应用）。
3. 地址是否用的是设置页显示的那个（IP 会变，路由器重启后可能不同）。
4. 主机的 8080 端口有没有被别的程序占了（本程序会自动换端口，以界面显示为准）。

**地址搜索没结果？**
地址联想依赖高德 Web 服务 API Key，桌面版默认没配。直接在地图上点选位置即可；
想要联想功能就申请一个免费 key，配到 `amap.key` 后重新打包。

**地图是空白的？**
地图瓦片要联网加载。断网时只有已缓存的区块能看。

**数据会不会因为换目录/升级丢？**
不会。数据在 `%APPDATA%\恋爱地图`，和程序目录无关。

**能放到 U 盘里带走吗？**
可以，程序本身是绿色便携的；但数据仍在 `%APPDATA%`，要一起带走得手动拷 `data`。

**能装成带图标的安装包吗？**
目前是绿色目录 + Electron 默认图标。想要安装包/自定义图标，用 `electron-builder` 打 NSIS（见第八节）。

---

## 七、已知限制

- 单机单写：一台主机、一个数据库文件，不支持多人同时写不同副本；
- 没有账号权限体系（就是给两个人用的），注册是开放的；
- 数据在本机明文存储（H2 文件 + 照片），不加密——电脑本身要设密码；
- 无自动更新，升级靠替换目录；
- exe 图标是 Electron 默认图标；
- 地址搜索需要自备高德 key。

---

## 八、从源码重新打包

源码在 `D:\CoupleMap`（`love-map-server` / `love-map-web` / `desktop` 三个目录）。

前置：JDK 21（要带 `jlink`）、Maven、Node 20+。首次还要装依赖：

```powershell
cd D:\CoupleMap\love-map-web
npm install --registry=https://registry.npmmirror.com

cd D:\CoupleMap\desktop
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install --registry=https://registry.npmmirror.com
```

一键打包（产物默认在 `D:\CoupleMap\build\CoupleMap-win64`）：

```powershell
cd D:\CoupleMap
.\build-app.ps1                          # 全量：前端 + 后端 + jlink + 组装
.\build-app.ps1 -SkipFrontend            # 只改了后端/壳
.\build-app.ps1 -SkipRuntime             # 运行时已生成，跳过 jlink
.\build-app.ps1 -OutDir E:\CoupleMap     # 直接输出到本目录
.\build-app.ps1 -Zip                     # 额外生成 恋爱地图-win64.zip
```

开发模式（改代码时用，热更新最快）：

```powershell
# 终端 1：后端（用 app profile，数据进临时目录）
cd D:\CoupleMap
java -jar love-map-server\target\love-map-server-1.0.0.jar --spring.profiles.active=app

# 终端 2：前端（5173，代理到 8080）
cd D:\CoupleMap\love-map-web
npm run dev

# 终端 3：桌面壳（可选）
cd D:\CoupleMap\desktop
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
.\node_modules\electron\dist\electron.exe .
```

三个容易踩的坑：

1. `build-app.ps1` 里有中文，**PowerShell 5.1 必须存成 UTF-8 with BOM**，否则报
   `Unexpected token` / 字符串未终止。
2. `mvn package` 报 `Unable to rename ... .jar to ... .jar.original` = 有旧的 `java.exe`
   占着 jar，结束进程再重试。
3. 如果环境里有 `ELECTRON_RUN_AS_NODE=1`，Electron 会以 Node 模式跑，报
   `ipcMain` undefined —— 启动前先 `Remove-Item Env:ELECTRON_RUN_AS_NODE`。

---

## 九、免费的"随时随地问"（异地访问）

主机模式的前提是"主机开着"。想突破这一点（**逐步操作见同目录的 [异地访问指南.md](异地访问指南.md)，含 Tailscale / cpolar / Cloudflare / 云主机四条路**）：

| 方案 | 免费额度 | 适合 | 代价 |
|---|---|---|---|
| **Tailscale** | 个人版免费（最多 3 用户/100 设备） | 两个人各自装客户端，组成私有网络，手机/电脑都能连 | 需要两边都装、登录同一账号 |
| **Cloudflare Tunnel** | 免费（quick tunnel 临时域名） | 临时给朋友看；主机开着就能从任何地方访问 | 域名每次重启会变；流量走 Cloudflare |
| **Oracle Cloud Always Free** | 永久免费 ARM 实例（4 核 24G 内存） | 想 7×24 常开、自己电脑不用一直开 | 要外币卡验证、要会基本 Linux |

安全性提醒：Tailscale 是私有网络，最稳；quick tunnel 是把服务暴露到公网，
上线前务必改掉默认配置、用强密码，并且别把 `/api/auth/register` 留给陌生人。

---

## 十、版本

| 版本 | 日期 | 说明 |
|---|---|---|
| 1.0.0 | 2026-10-25 | 首个桌面版：内嵌 H2 + 单端口 + jlink 运行时 + Electron 壳 + 主机/连接模式 |

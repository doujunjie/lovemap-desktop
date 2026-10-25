# 安全策略 / Security Policy

## 官方来源

本项目的唯一官方仓库是：

- https://github.com/doujunjie/lovemap-desktop

其他任何站点、网盘、群文件、第三方镜像分发的「恋爱地图」安装包与本仓库作者无关。下载后请比对仓库中所列的校验值；来源不明的安装包请勿运行。

## 报告安全问题

**请不要通过公开 Issue 报告安全漏洞。**

请使用 GitHub 的私密漏洞报告通道：

1. 打开 https://github.com/doujunjie/lovemap-desktop/security/advisories
2. 点击 **Report a vulnerability**，填写复现步骤与影响说明。

该通道只有仓库维护者可见，报告内容不会公开，修复后再由维护者发布安全公告。

## 适用范围

- 桌面版发行包（`恋爱地图.exe` 及 `resources/` 下的 Electron 壳、内置 JRE、`love-map-server.jar`）
- 内置的 Spring Boot 服务端与其 H2/MySQL 数据访问逻辑
- 局域网共享与异地访问相关配置

## 已知设计说明（非漏洞）

- 发行包内含 `resources/app/application-dev.yml`，其中 `root` / `123456` 是**本地开发用 MySQL 示例值**，正式使用请改为自己的账号密码，或直接使用默认的内置 H2 数据库。
- 服务默认监听局域网端口，供同一 WiFi 下的手机访问；请勿直接暴露到公网，异地访问请按 `异地访问指南.md` 使用内网穿透并启用鉴权。
- 程序在同目录生成的 `data/`、`uploads/`、`*.log` 为本地运行数据，已在 `.gitignore` 中排除，不随仓库分发。

## 支持版本

仅最新发行版接受安全修复。旧版本不再维护。

## 致谢

确认有效的漏洞报告会在修复后的发行说明中致谢（如报告者希望匿名请注明）。

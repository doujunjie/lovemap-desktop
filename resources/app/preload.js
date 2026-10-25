'use strict'

/**
 * 设置页的 preload：只暴露几个具名方法，不把 ipcRenderer 整个丢给页面。
 * 主窗口加载的是本地后端页面，刻意不挂 preload，权限降到底。
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lovemap', {
    info: () => ipcRenderer.invoke('setup:info'),
    startHost: () => ipcRenderer.invoke('setup:start-host'),
    test: (url) => ipcRenderer.invoke('setup:test', url),
    connect: (url) => ipcRenderer.invoke('setup:connect', url),
    reset: () => ipcRenderer.invoke('setup:reset'),
    openApp: () => ipcRenderer.invoke('setup:open-app'),
    openPath: (kind) => ipcRenderer.invoke('setup:open-path', kind),
    onRefresh: (callback) => ipcRenderer.on('setup:refresh', () => callback()),
})

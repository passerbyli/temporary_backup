const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('configApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: data => ipcRenderer.invoke('config:update', data),
  sysReadLogs: data => ipcRenderer.invoke('sys:readLogs', data),
  sysOpenDirectory: data => ipcRenderer.invoke('sys:openDirectory', data),
  sysOpenChrome: data => ipcRenderer.invoke('sys:openChrome', data),
  sysSelectFolder: data => ipcRenderer.invoke('sys:selectFolder', data),
  sysSelectFile: data => ipcRenderer.invoke('sys:selectFile', data)
})
contextBridge.exposeInMainWorld('authApi', {
  login: data => ipcRenderer.invoke('auth:login', data),
  logout: () => ipcRenderer.invoke('auth:logout'),
  changeRole: data => ipcRenderer.invoke('auth:changeRole', data),
  checkLogin: () => ipcRenderer.invoke('auth:checkLogin'),
  authLogin: () => ipcRenderer.invoke('auth:authLogin')
})

contextBridge.exposeInMainWorld('electron', {
  onNavigate: callback => {
    ipcRenderer.on('navigate', (event, route) => {
      callback(route)
    })
  }
})

contextBridge.exposeInMainWorld('ipc', {
  /**
   * 用于单向消息发送，不带返回
   * @param {*} channel
   * @param {*} data
   *
   *
   * @example
   * 发消息到主进程
   * window.ipc.send('toMain', data)
   *
   * 主进程监听方式
   * ipcMain.on('toMain', (event, data) => { ... })
   *
   */
  send: (channel, data) => {
    let validChannels = ['toMain']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  /**
   * 用于接收主进程的消息
   * @param {*} channel
   * @param {*} func
   * @example
   * 用于接收主进程的消息
   * window.ipc.receive('fromMain', (data) => { ... })
   *
   * 主进程发送消息
   * window.webContents.send('fromMain', data)
   */
  receive: (channel, func) => {
    let validChannels = ['fromMain']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    }
  },
  /**
   *
   * @param {*} channel
   * @param {*} data
   * @returns
   *
   * @example
   * 用于带返回值的异步调用
   * const result = await window.ipc.sendInvoke('toMain', { key: 123 })
   *
   * 主进程处理方式
   * ipcMain.handle('toMain', async (event, data) => {
   *    return someResult
   * })
   */
  sendInvoke: (channel, data) => {
    let validChannels = ['toMain']
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data)
    }
  },
  refreshWindow: () => ipcRenderer.invoke('refresh-window')
})

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  toggleMaximize: () => ipcRenderer.send('window-toggle-maximize')
})

contextBridge.exposeInMainWorld('dsApi', {
  list: () => ipcRenderer.invoke('ds:list'),
  save: data => ipcRenderer.invoke('ds:save', data),
  test: ds => ipcRenderer.invoke('ds:test', ds)
})

contextBridge.exposeInMainWorld('dbAPI', {
  getAllTables: () => ipcRenderer.invoke('get-all-tables'),
  getTableDetail: params => ipcRenderer.invoke('get-table-detail', params),

  tableQueryAll: params => ipcRenderer.invoke('table/query-all', params),
  tableQueryDataView: params => ipcRenderer.invoke('get-table-data-view', params),

  tableDistinctOptions: () => ipcRenderer.invoke('table/distinct-options'),
  tableExportAll: filters => ipcRenderer.invoke('table/export-all', filters),
  exportToFile: filters => ipcRenderer.invoke('table/export-all-to-file', filters)
})

contextBridge.exposeInMainWorld('serviceApi', {
  diffApiByRoute: router_id => ipcRenderer.invoke('diffApiByRoute', router_id),
  queryApiListByRoute: params => ipcRenderer.invoke('queryApiListByRoute', params),
  getApiDetailByRouteId: router_id => ipcRenderer.invoke('getApiDetailByRouteId', router_id)
})

contextBridge.exposeInMainWorld('spotlightApi', {
  onFocusInput: callback => ipcRenderer.on('focus-input', callback),
  resizeWindow: h => ipcRenderer.send('spotlight-resize', { h }),
  hide: () => ipcRenderer.send('spotlight-hide'),
  executeCommand: cmd => ipcRenderer.send('spotlight-cmd', cmd)
})

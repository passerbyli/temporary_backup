const { contextBridge, ipcRenderer } = require('electron');

// 日志功能单独暴露
contextBridge.exposeInMainWorld('logger', {
  info: (message, meta = {}) => ipcRenderer.invoke('log:write', { level: 'info', message, meta }),
  warn: (message, meta = {}) => ipcRenderer.invoke('log:write', { level: 'warn', message, meta }),
  error: (message, meta = {}) => ipcRenderer.invoke('log:write', { level: 'error', message, meta }),
  debug: (message, meta = {}) => ipcRenderer.invoke('log:write', { level: 'debug', message, meta }),
  log: (level, message, meta = {}) => ipcRenderer.invoke('log:write', { level, message, meta }),
  openLogDir: () => ipcRenderer.invoke('log:openDir'),
});

// 为了向后兼容，保留一些常用的旧API名称，通过引用appApi实现
contextBridge.exposeInMainWorld('configApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (data) => ipcRenderer.invoke('config:update', data),
  sysReadLogs: (data) => ipcRenderer.invoke('sys:readLogs', data),
  sysOpenDirectory: (data) => ipcRenderer.invoke('sys:openDirectory', data),
  sysOpenChrome: (data) => ipcRenderer.invoke('sys:openChrome', data),
  sysSelectFolder: () => ipcRenderer.invoke('sys:selectFolder'),
  sysSelectFile: () => ipcRenderer.invoke('sys:selectFile'),
});

contextBridge.exposeInMainWorld('spotlightApi', {
  onFocusInput: (callback) => ipcRenderer.on('focus-input', callback),
  resizeWindow: (h) => ipcRenderer.send('spotlight-resize', { h }),
  hide: () => ipcRenderer.send('spotlight-hide'),
  executeCommand: (type, cmd) => ipcRenderer.send('spotlight-cmd', type, cmd),
  search: (inputText) => ipcRenderer.invoke('spotlight:search', inputText),
  open: (item) => ipcRenderer.invoke('spotlight:open', item),
  refresh: () => ipcRenderer.invoke('spotlight:refresh'),
  query: (text, filterProfile = '') => ipcRenderer.invoke('spotlight:query', text, filterProfile),
  getIpInfo: () => ipcRenderer.invoke('sys:getIpInfo'),
});

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  onNavigate: (callback) => ipcRenderer.on('navigate', callback),
  onIpInfo: (callback) => ipcRenderer.on('show-ip-info', callback),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
});

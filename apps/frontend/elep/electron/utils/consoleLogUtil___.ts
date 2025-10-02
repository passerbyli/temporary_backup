const { BrowserWindow } = require('electron')

function sendToRenderer(level = 'log', ...msg) {
  try {
    const windows = BrowserWindow.getAllWindows()
    if (!windows || windows.length === 0) {
      return
    }

    const currentWindow = windows.find(win => win?.title === 'Vite App')
    if (!currentWindow?.webContents) return

    const params = msg.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)))
    const str = params.join(' ')

    currentWindow.webContents &&
      currentWindow.webContents.send('fromMain', {
        event: 'console',
        level,
        data: str
      })
  } catch (e) {
    // 防止在某些平台抛出异常
  }
}

const log = (...msg) => sendToRenderer('log', ...msg)
const error = (...msg) => sendToRenderer('error', ...msg)
const warn = (...msg) => sendToRenderer('warn', ...msg)
const debug = (...msg) => sendToRenderer('debug', ...msg)

module.exports = { log, error, warn, debug }

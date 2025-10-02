const { BrowserWindow } = require('electron')

/**
 * 主进程发生事件到渲染进程
 */
function mainSendToRender(event, data) {
  try {
    // 获取所有浏览器窗口
    const windows = BrowserWindow.getAllWindows()
    if (!windows) {
      return
    }
    // 查找目标窗口（根据窗口标题）
    let currentWindow
    for (let i = 0; i < windows.length; i++) {
      const win = windows[i]

      if (win && win.title == 'Vite App') {
        // 精确匹配窗口标题
        currentWindow = win
        break // 找到第一个匹配窗口即停止
      }
    }
    // 向渲染进程发送 IPC 消息
    if (currentWindow) {
      currentWindow.webContents &&
        currentWindow.webContents.send('fromMain', {
          // 使用可选链操作符
          event: event,
          data: data
        })
    }
  } catch (error) {}
}

module.exports = { mainSendToRender }

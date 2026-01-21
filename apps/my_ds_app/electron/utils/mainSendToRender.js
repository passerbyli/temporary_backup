const { BrowserWindow } = require('electron');

// 存储主窗口引用
let mainWindowRef = null;

/**
 * 设置主窗口引用
 * @param {BrowserWindow} window - 主应用窗口
 */
function setMainWindow(window) {
  mainWindowRef = window;
  console.log('[mainSendToRender] Main window reference set');
}

/**
 * 主进程发生事件到渲染进程
 * @param {string} event - 事件名称
 * @param {any} data - 传递的数据
 */
function mainSendToRender(event, data) {
  try {
    console.log(`[mainSendToRender] Attempting to send: event=${event}, data=`, data);
    
    // 优先使用设置的 mainWindowRef
    let targetWindow = mainWindowRef;
    
    // 如果没有引用，尝试获取所有窗口中的主窗口
    if (!targetWindow || targetWindow.isDestroyed()) {
      const windows = BrowserWindow.getAllWindows();
      if (windows && windows.length > 0) {
        // 获取第一个没有被销毁的窗口
        for (const win of windows) {
          if (win && !win.isDestroyed()) {
            targetWindow = win;
            break;
          }
        }
      }
    }
    
    if (targetWindow && targetWindow.webContents && !targetWindow.isDestroyed()) {
      console.log(`[mainSendToRender] ✓ Sending message via webContents`);
      targetWindow.webContents.send('fromMain', {
        event: event,
        data: data,
      });
    } else {
      console.error('[mainSendToRender] ✗ No valid window found to send message');
    }
  } catch (error) {
    console.error('[mainSendToRender] Error:', error);
  }
}

module.exports = { mainSendToRender, setMainWindow };

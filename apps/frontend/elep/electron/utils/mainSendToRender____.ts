// electron/utils/mainSendToRender.ts
import { BrowserWindow } from 'electron'

/**
 * 向渲染进程广播事件（仅发送给标题为 'Vite App' 的窗口）
 * @param event 自定义事件名
 * @param data 携带的数据（可为任意类型）
 */
export function mainSendToRender(event: string, data: any): void {
  try {
    const windows = BrowserWindow.getAllWindows()
    if (!windows || windows.length === 0) return

    const targetWindow = windows.find(win => win.getTitle?.() === 'Vite App')

    if (targetWindow?.webContents) {
      targetWindow.webContents.send('fromMain', { event, data })
    }
  } catch (error) {
    console.error('[mainSendToRender] 发送失败:', error)
  }
}

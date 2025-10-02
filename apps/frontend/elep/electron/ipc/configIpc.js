const { getConfig, updateConfig } = require('../db/configDb.js')

function registerConfigIpc(ipcMain) {
  ipcMain.handle('config:get', () => {
    return getConfig()
  })

  ipcMain.handle('config:update', (event, data) => {
    updateConfig(data)
    return { success: true }
  })
}
module.exports = registerConfigIpc

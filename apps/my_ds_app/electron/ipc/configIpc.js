const { getConfig, updateConfig } = require('../db/configDb.js');
const { log: consoleUtil } = require('../log/logger.js');

function registerConfigIpc(ipcMain) {
  ipcMain.handle('config:get', async () => {
    try {
      return getConfig();
    } catch (error) {
      consoleUtil.error('获取配置失败:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('config:update', async (event, data) => {
    try {
      // 输入验证
      if (!data || typeof data !== 'object') {
        throw new Error('配置数据必须是有效的对象');
      }
      updateConfig(data);
      return { success: true };
    } catch (error) {
      consoleUtil.error('更新配置失败:', error);
      return { success: false, message: error.message };
    }
  });
}
module.exports = registerConfigIpc;

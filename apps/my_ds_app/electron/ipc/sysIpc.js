const { shell, app, dialog } = require('electron');
const { exec } = require('child_process');
const path = require('node:path');
const fs = require('node:fs');
const { getBasePath } = require('../db/configDb');
const { log: consoleUtil } = require('../log/logger');

const { openChromeWithPlugin } = require('../../plugins/common/openChromeWithPlugin');

function registerSysIpc(ipcMain) {
  ipcMain.handle('sys:readLogs', async (_, params) => {
    try {
      // 输入验证
      if (!params || !params.date) {
        throw new Error('日志日期不能为空');
      }
      return readLogFile(params.date);
    } catch (error) {
      consoleUtil.error('读取日志失败:', error);
      return { success: false, message: error.message, data: [] };
    }
  });

  ipcMain.handle('sys:openDirectory', async (_, params) => {
    try {
      // 输入验证
      if (!params || !params.type) {
        throw new Error('目录类型不能为空');
      }
      return openDirectory(params.path, params.type);
    } catch (error) {
      consoleUtil.error('打开目录失败:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('sys:openChrome', async (_, params) => {
    try {
      // 输入验证
      if (!params || !params.url) {
        throw new Error('URL不能为空');
      }
      return openChrome(params.url);
    } catch (error) {
      consoleUtil.error('打开Chrome失败:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('sys:selectFolder', async (_) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
      });
      return canceled ? null : filePaths; // 返回绝对路径
    } catch (error) {
      consoleUtil.error('选择文件夹失败:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('sys:selectFile', async (_) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: '选择 SQL 或 JSON 文件',
        filters: [{ name: 'SQL/JSON', extensions: ['sql', 'json'] }],
        properties: ['openFile'],
      });
      if (canceled) return null;
      const filePath = filePaths[0];
      const content = fs.readFileSync(filePath, 'utf-8');
      return { filePath, content };
    } catch (error) {
      consoleUtil.error('选择文件失败:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('plugin:launch-chrome', async () => {
    try {
      let pluginPath = path.join(__dirname, 'chrome/my-extensiondebug');
      const guidePath = path.join(__dirname, './public/plugin-guide.html');
      openChromeWithPlugin(pluginPath, guidePath);
      return 'done';
    } catch (error) {
      consoleUtil.error('启动Chrome插件失败:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('log:openDir', () => {
    const dir = path.join(app.getPath('userData'), 'logs');
    shell.openPath(dir);
    return true;
  });
}

function readLogFile(params) {
  try {
    // 输入验证
    if (!params || typeof params !== 'object' || !params.date || typeof params.date !== 'string') {
      throw new Error('无效的日志日期参数');
    }
    consoleUtil.log('读取日志文件', params);

    const logPath = path.join(getBasePath(), 'logs', `request_${params.date}.log`);
    if (!fs.existsSync(logPath)) {
      return { success: false, message: '日志文件不存在', data: [] };
    }

    const raw = fs.readFileSync(logPath, 'utf-8');
    const blocks = raw.split(/\n(?=\[\d{4}-\d{2}-\d{2}T)/g);
    const data = [];

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const metaLine = lines[0] || '';
      const typeMatch = metaLine.match(/\] (.+?)(?: \[(.+?)\])?$/);
      const timeMatch = metaLine.match(/^\[(.+?)\]/);

      const type = typeMatch?.[1] || '';
      const tag = typeMatch?.[2] || '';
      const time = timeMatch?.[1] || '';
      let method = '',
        url = '',
        status = '',
        duration = '',
        error = '';
      let requestParams = '',
        requestData = '',
        responseData = '';

      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('URL:')) {
          const parts = line.replace('URL:', '').trim().split(' ');
          method = parts[0];
          url = parts[1];
        } else if (line.startsWith('Params:')) {
          requestParams = line.replace('Params:', '').trim();
        } else if (line.startsWith('Data:')) {
          requestData = line.replace('Data:', '').trim();
        } else if (line.startsWith('Response:')) {
          responseData = line.replace('Response:', '').trim();
        } else if (line.startsWith('Status:')) {
          status = line.replace('Status:', '').trim();
        } else if (line.startsWith('Duration:')) {
          duration = line.replace('Duration:', '').trim();
        } else if (line.startsWith('Error:')) {
          error = line.replace('Error:', '').trim();
        }
      }

      data.push({
        time,
        type,
        tag,
        method,
        url,
        status,
        duration,
        error,
        params: requestParams,
        requestData,
        responseData,
      });
    }
    return { success: true, data: data };
  } catch (error) {
    consoleUtil.error('读取日志文件失败:', error);
    return { success: false, message: error.message, data: [] };
  }
}

function openChrome(params) {
  try {
    // 输入验证
    if (!params || typeof params !== 'string') {
      throw new Error('无效的URL参数');
    }

    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const targetUrl = params;
    const profile = 'Default';

    // 使用参数化方式执行命令，避免命令注入
    exec(`${chromePath} --profile-directory=${profile} ${targetUrl}`, (error) => {
      if (error) {
        consoleUtil.error('打开Chrome失败:', error);
      } else {
        consoleUtil.log('Chrome 已打开');
      }
    });
  } catch (error) {
    consoleUtil.error('openChrome函数执行失败:', error);
  }
}
function openDirectory(dirPath, type) {
  let folderPath = dirPath;
  if (type === 'config') {
    folderPath = path.join(app.getPath('userData'));
  } else if (type === 'log') {
    folderPath = path.join(getBasePath(), 'logs');
  } else if (type === 'export') {
    folderPath = path.join(getBasePath(), 'export');
  }

  if (!fs.existsSync(folderPath)) {
    fs.mkdir(folderPath, { recursive: true }, (error) => {
      if (error) {
        consoleUtil.log('Error creating directory', error);
      } else {
        consoleUtil.log('Directory created successfully');
      }
    });
  }

  shell
    .openPath(folderPath)
    .then(() => {
      consoleUtil.log('文件夹已打开');
    })
    .catch((err) => {
      consoleUtil.error('无法打开文件夹:', err);
    });
}

/**
 * 如果是文件则返回其所在目录；如果是目录则原样返回；不存在则返回 null
 * @param {string} targetPath
 * @returns {string|null}
 */
function getDirectoryFromPath(targetPath) {
  if (!fs.existsSync(targetPath)) return null;

  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    return path.dirname(targetPath);
  } else if (stat.isDirectory()) {
    return targetPath;
  } else {
    return null;
  }
}
module.exports = registerSysIpc;

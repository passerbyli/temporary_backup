const { app } = require('electron');

const registerConfigIpc = require('./configIpc');
const registerSysIpc = require('./sysIpc');

function registerAllIpc(ipcMain) {
  registerConfigIpc(ipcMain);
  registerSysIpc(ipcMain);
  console.log('[IPC] 所有 IPC handler 已注册完成');
}

async function ipcHandle(e, args) {
  if (!args || !args.event) {
    return;
  }

  const event = args.event;
  let data;
  if (event == 'appInfo') {
    data = {
      version: app.getVersion(),
    };
  } else if (event === 'kg') {
  }
  return data;
}

module.exports = { registerAllIpc, ipcHandle };

/* eslint-disable no-undef */
const { app, BrowserWindow, ipcMain, globalShortcut, Menu } = require('electron');
const path = require('node:path');
const { registerAllIpc, ipcHandle } = require('./electron/ipc/index');
const spotlight = require('./plugins/chrome/bookmarks');
const spotlightRouter = require('./services/spotlight');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let win = null;
let spotlightWin = null;
let isQuiting = false;
// 检查是否已存在实例
const gotTheLock = app.requestSingleInstanceLock();

function createSpotlight() {
  spotlightWin = new BrowserWindow({
    width: 624,
    height: 70, // 初始高度最小化
    frame: false, // 去掉原生边框
    autoHideMenuBar: true, // 隐藏菜单栏
    transparent: false, // 不设置透明（否则可能失效）
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    show: false, // 初始不显示，避免闪烁
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 失去焦点时自动隐藏
  spotlightWin.on('blur', () => {
    if (spotlightWin && spotlightWin.isVisible()) {
      spotlightWin.hide();
    }
  });

  if (isDev) {
    // Vue Router hash 模式
    spotlightWin.loadURL('http://localhost:5173/#/spotlight');
  } else {
    spotlightWin.loadFile(path.join(__dirname, '/pages/index.html'), { hash: 'spotlight' });
  }
  // spotlightWin.webContents.openDevTools();
}
function createMenu() {
  const template = [
    {
      label: '菜单一',
      submenu: [
        {
          label: '功能一',
        },
        {
          label: '功能二',
        },
      ],
    },
    {
      label: '菜单二',
      submenu: [
        {
          label: '功能一',
        },
        {
          label: '功能二',
        },
        { role: 'quit' },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
function createWindow() {
  const iconPath = path.join(__dirname, 'public/icons/512x512.png');
  // 创建浏览器窗口
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    // frame: false, // 去掉原生边框
    autoHideMenuBar: true, // 隐藏菜单栏
    transparent: false, // 不设置透明（否则可能失效）
    roundedCorners: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: iconPath,
  });

  createMenu();

  // 窗口控制监听
  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('window-toggle-maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  // 隐藏菜单栏
  win.setMenuBarVisibility(false);

  // 或者禁止菜单栏显示快捷键（如 Alt 键呼出菜单）
  win.setAutoHideMenuBar(true);

  if (isDev) {
    win.loadURL('http://localhost:5173'); // Vite 默认端口
  } else {
    win.loadFile(path.join(__dirname, '/pages/index.html'));
  }
  win.webContents.openDevTools();

  win.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault();
      if (win.isMinimized()) {
        win.restore();
      } else {
        win.minimize();
      }
    }
  });
}

if (!gotTheLock) {
  // 已经有一个实例在运行，退出当前进程
  app.quit();
} else {
  // 监听 second-instance 事件（第二次启动时触发）
  app.on('second-instance', (event, argv, workingDirectory) => {
    console.log(event, argv, workingDirectory);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  // 创建窗口
  app.whenReady().then(async () => {
    registerAllIpc(ipcMain);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
    createSpotlight();
    await spotlight.init();

    const ok = globalShortcut.register('CommandOrControl+Option+P', () => {
      console.log('✅ 快捷键触发成功');
      if (spotlightWin.isVisible()) {
        spotlightWin.hide();
      } else {
        spotlightWin.center();
        spotlightWin.show();
        spotlightWin.focus();
        spotlightWin.webContents.send('focus-input');
      }
    });

    if (!ok) {
      console.log('❌ 快捷键注册失败');
    }
  });
}
// 所有窗口关闭时退出（可选，如果你希望退出应用时）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuiting = true;
});

app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('refresh-window', () => {
  win.reload();
});

ipcMain.handle('toMain', async (e, args) => {
  return await ipcHandle(e, args);
});

ipcMain.handle('bookmarks:listProfiles', async () => {
  return await spotlight.listProfiles();
});

// IPC：读取某个 Profile 的书签树
ipcMain.handle('bookmarks:load', async (_evt, profileName) => {
  return await spotlight.loadBookmarksTree(profileName);
});

// ipcRenderer.on 处理
ipcMain.on('toMain', async (e, args) => {
  if (!args || !args.event) {
    return;
  }
  const data = await ipcHandle(e, args);
  const webContents = e.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  win.webContents.send('fromMain', { event: args.event, data: data });
});

ipcMain.on('spotlight-cmd', (e, type, cmd) => {
  console.log('spotlight-cmd', type, cmd);
  if (!win) return;

  if (type == 'local_route') {
    win.webContents.send('navigate', cmd);
  } else if (type == 'local_sys') {
    if (cmd == 'quit') {
      app.quit();
    }
  }
});

ipcMain.handle('spotlight:search', async (_evt, inputText) => {
  const r = await spotlight.search(inputText);
  return r;
});

ipcMain.handle('spotlight:query', async (_e, text) => {
  return await spotlightRouter.query(text); // 必须 return
});

ipcMain.handle('spotlight:open', async (_evt, item) => {
  // return await spotlight.open(item);
  return await spotlightRouter.open(item); // 必须 return
});

ipcMain.handle('spotlight:refresh', async () => {
  await spotlight.init(true);
  return true;
});

ipcMain.on('spotlight-hide', () => {
  if (spotlightWin && spotlightWin.isVisible()) {
    spotlightWin.hide();
  }
});

ipcMain.on('spotlight-resize', (event, { h }) => {
  console.log('调整高度:', h);
  if (!spotlightWin) return;
  const bounds = spotlightWin.getBounds();
  spotlightWin.setBounds({
    x: bounds.x, // 不改
    y: bounds.y, // 不改
    width: bounds.width, // 不改
    height: h, // ✅ 只改高度
  });
});

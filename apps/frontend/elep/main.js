/* eslint-disable no-undef */
const { app, BrowserWindow, ipcMain, globalShortcut, Menu, Tray, nativeImage } = require('electron');
const path = require('node:path');
const { registerAllIpc, ipcHandle } = require('./electron/ipc/index');
const spotlight = require('./plugins/chrome/bookmarks');
const spotlightRouter = require('./services/spotlight');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const isMac = process.platform === 'darwin';
let win = null;
let tray; // ← 保持引用
let spotlightWin = null;
let isQuiting = false;
// 检查是否已存在实例
const gotTheLock = app.requestSingleInstanceLock();

function getIconPath() {
  // 开发环境和打包后路径不同
  const iconFile = process.platform === 'win32' ? '512x512.png' : '512x512.png';
  return app.isPackaged
    ? path.join(process.resourcesPath, iconFile) // 打包后放 resources 旁
    : path.join(__dirname, 'public/icons/', iconFile); // 开发环境 ./assets/icon.ico
}
function createTray() {
  const icon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(icon);

  tray.setToolTip('你的应用名');

  const trayMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏',
      click: () => {
        if (!win) return;
        if (win.isVisible()) win.hide();
        else {
          win.show();
          win.focus();
        }
      },
    },
    { type: 'separator' },
    { label: '关于', click: () => console.log('关于被点击') },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(trayMenu);

  // 左键单击：切换显示
  tray.on('click', () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else {
      win.show();
      win.focus();
    }
  });
}
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
        { label: '功能一', click: () => console.log('功能一') },
        { label: '功能二', click: () => console.log('功能二') },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  // 应用级菜单（macOS 显示在系统菜单栏，Windows 显示在窗口上方）
  Menu.setApplicationMenu(menu);
  // 保险起见，也绑到当前窗口（Windows 上更稳）
  win.setMenu(menu);
  win.setAutoHideMenuBar(false);
  win.setMenuBarVisibility(true);
}
function createWindow() {
  const iconPath = path.join(__dirname, 'public/icons/512x512.png');
  // 创建浏览器窗口
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    // frame: true, // 确保有原生边框时，菜单栏才可见
    // Windows 要显示菜单栏，别用 frame:false；且不要 autoHide
    autoHideMenuBar: false, // 显示菜单栏
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
    if (process.platform === 'win32') {
      createTray(); // 仅 Windows 托盘
    }
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
    createSpotlight();
    await spotlight.init();
    const accelerator = isMac ? 'CommandOrControl+Option+P' : 'CommandOrControl+Alt+P';

    const ok = globalShortcut.register(accelerator, () => {
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

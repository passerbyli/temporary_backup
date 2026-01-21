// 模块导入
const { app, BrowserWindow, ipcMain, globalShortcut, Menu, Tray, shell, nativeImage } = require('electron');
const path = require('path');
const { initLogger } = require('./electron/log/logger');
const { registerAllIpc, ipcHandle } = require('./electron/ipc/index');
const { setMainWindow } = require('./electron/utils/mainSendToRender');
const SpotlightManager = require('./services/spotlight/main');
const UpdateManager = require('./services/updater/main');

let spotlightManager = null;
let updateManager = null;

// 日志初始化
const log = initLogger({ level: 'info' });

// 环境检测
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const isMac = process.platform === 'darwin';

// 应用配置
const APP_CONFIG = {
  UPDATE_SERVER_BASE: 'http://127.0.0.1:3000', // 改成你的 Express 服务器 IP
  SPOTLIGHT_SHORTCUT: isMac ? 'CommandOrControl+Option+P' : 'CommandOrControl+Alt+P',
  DEFAULT_WINDOW_WIDTH: 1000,
  DEFAULT_WINDOW_HEIGHT: 700,
  SPOTLIGHT_WIDTH: 744,
  SPOTLIGHT_HEIGHT: 70,
  UPDATE_WINDOW_WIDTH: 420,
  UPDATE_WINDOW_HEIGHT: 220,
  PROGRESS_WINDOW_WIDTH: 420,
  PROGRESS_WINDOW_HEIGHT: 180,

  // 模拟更新配置
  MOCK_UPDATE_FILE_SIZE_MB: 120,
  MOCK_UPDATE_SPEED_MBPS: 12.0,
};

// 窗口引用
let mainWindow = null;
let tray = null;

// 状态变量
let isQuitting = false;

// 检查是否已存在实例
const gotTheLock = app.requestSingleInstanceLock();

function checkForUpdates() {
  try {
    updateManager?.checkForUpdates();
  } catch (e) {
    log.error('[checkForUpdates] failed:', e);
  }
}

function getIconPath() {
  // 开发环境和打包后路径不同
  const iconFile = '512x512.png';
  return app.isPackaged
    ? path.join(process.resourcesPath, iconFile) // 打包后放 resources 旁
    : path.join(__dirname, 'public/icons/', iconFile);
}
function createTray() {
  // 避免重复创建
  if (tray && !tray.isDestroyed()) {
    return tray;
  }

  const icon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(icon);

  tray.setToolTip('你的应用名');

  const trayMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    { label: '关于', click: () => log.info('关于被点击') },
    {
      label: '检查更新',
      click: () => checkForUpdates(),
    },
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
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createMenu() {
  const template = [
    {
      label: '菜单一',
      submenu: [
        { label: '检查更新', click: () => checkForUpdates() },

        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      // 补充系统默认快捷键
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  // 应用级菜单（macOS 显示在系统菜单栏，Windows 显示在窗口上方）
  Menu.setApplicationMenu(menu);
  // 保险起见，也绑到当前窗口（Windows 上更稳）
  mainWindow.setMenu(menu);
  mainWindow.setAutoHideMenuBar(false);
  mainWindow.setMenuBarVisibility(true);
}
function createWindow() {
  // 避免重复创建
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  const iconPath = path.join(__dirname, 'public/icons/512x512.png');
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: APP_CONFIG.DEFAULT_WINDOW_WIDTH,
    height: APP_CONFIG.DEFAULT_WINDOW_HEIGHT,
    x: 10,
    y: 700,
    frame: false, // 确保有原生边框时，菜单栏才可见
    autoHideMenuBar: true, // 显示菜单栏
    // Windows 要显示菜单栏，别用 frame:false；且不要 autoHide
    transparent: true, // 不设置透明（否则可能失效）
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
  // 设置主窗口引用供 IPC 通信使用
  setMainWindow(mainWindow);

  // 隐藏菜单栏
  mainWindow.setMenuBarVisibility(false);

  // 或者禁止菜单栏显示快捷键（如 Alt 键呼出菜单）
  mainWindow.setAutoHideMenuBar(true);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173'); // Vite 默认端口
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '/pages/index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      } else {
        mainWindow.minimize();
      }
    }
  });
  log.info('===== window created =====');
}

if (!gotTheLock) {
  // 已经有一个实例在运行，退出当前进程
  app.quit();
} else {
  // 监听 second-instance 事件（第二次启动时触发）
  app.on('second-instance', (event, argv, workingDirectory) => {
    log.debug('second-instance event:', { argv, workingDirectory });
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // 创建窗口
  app.whenReady().then(async () => {
    registerAllIpc(ipcMain);
    createWindow();
    if (process.platform === 'win32') {
      createTray(); // 仅 Windows 托盘
    }

    // 初始化 Spotlight 管理器
    spotlightManager = new SpotlightManager({
      app,
      log,
      config: APP_CONFIG,
    });
    spotlightManager.setMainWindow(mainWindow);
    spotlightManager.init();

    // 初始化更新管理器
    updateManager = new UpdateManager({
      app,
      log,
      config: APP_CONFIG,
    });
    updateManager.setMainWindow(mainWindow);
    updateManager.init();

    // updateManager.mockUpdateFlow()

    // await bookmark.init();
  });
}
// 当我们注册了全局快捷键之后，当应用程序退出的时候，也需要注销这个快捷键
app.on('will-quit', function () {
  if (spotlightManager) {
    spotlightManager.unregisterShortcuts();
  }
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  isQuitting = true;
});

// 在 macOS 上，除非用户用 Cmd + Q 确定地退出，否则绝大部分应用及其菜单栏会保持激活
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 在macOS上，当单击dock图标并且没有其他窗口打开时，通常在应用程序中重新创建一个窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('toMain', async (e, args) => {
  return await ipcHandle(e, args);
});

// ipcRenderer.on 处理
ipcMain.on('toMain', async (e, args) => {
  if (!args || !args.event) {
    return;
  }
  const data = await ipcHandle(e, args);
  const webContents = e.sender;
  const mainWindow = BrowserWindow.fromWebContents(webContents);
  mainWindow.webContents.send('fromMain', { event: args.event, data: data });
});

ipcMain.handle('log:write', (_e, payload) => {
  try {
    console.log('--====----log:write', payload);
    const { level = 'info', message = '', meta } = payload || {};
    const fn = log[level] || log.info;
    if (meta !== undefined) fn.call(log, message, meta);
    else fn.call(log, message);
    return true;
  } catch (err) {
    log.error('[log:write] failed', { message: err?.message, stack: err?.stack });
    return false;
  }
});

ipcMain.handle('refresh-window', () => {
  mainWindow.reload();
});

// 窗口控制监听
ipcMain.on('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});
ipcMain.on('window-maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});
ipcMain.on('window-toggle-maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});
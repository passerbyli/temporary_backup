// 导入必要的模块
const { BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const spotlightRouter = require('./index');
const isMac = process.platform === 'darwin';

// Spotlight 模块类
class SpotlightManager {
  constructor(options) {
    this.app = options.app;
    this.log = options.log;
    this.config = options.config;
    this.mainWindow = null;
    this.spotlightWin = null;
  }

  // 设置主窗口引用
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  hideWin() {
    if (this.spotlightWin) {
      this.spotlightWin.hide();
    }
  }
  // 创建 Spotlight 窗口
  createSpotlight() {
    // 避免重复创建
    if (this.spotlightWin && !this.spotlightWin.isDestroyed()) {
      return this.spotlightWin;
    }

    this.spotlightWin = new BrowserWindow({
      width: this.config.SPOTLIGHT_WIDTH,
      height: 60, // 初始高度最小化
      frame: false, // 无边框窗口
      autoHideMenuBar: true, // 隐藏菜单栏
      transparent: true, // 设置窗口透明
      alwaysOnTop: true, // 保持窗口在最前面
      resizable: true, // 允许调整大小
      movable: true, // 允许移动窗口
      skipTaskbar: true,
      vibrancy: 'light', // 或者 'dark'，取决于你的需求（仅限 macOS）
      show: false, // 初始不显示，避免闪烁
      webPreferences: {
        devTools: false, // 关键!! false才会透明生效
        preload: path.join(__dirname, '../../preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    if (isMac) {
      this.spotlightWin.setVibrancy('appearance-based');
    } else {
      this.spotlightWin.setBackgroundMaterial('acrylic');
    }
    // 在创建窗口后调用
    // 失去焦点时自动隐藏
    this.spotlightWin.on('blur', () => {
      if (this.spotlightWin && this.spotlightWin.isVisible()) {
        this.hideWin();
      }
    });

    const isDev = process.env.NODE_ENV === 'development' || !this.app.isPackaged;
    if (isDev) {
      // Vue Router hash 模式
      this.spotlightWin.loadURL('http://localhost:5173/#/spotlight');
    } else {
      this.spotlightWin.loadFile(path.join(__dirname, '../../pages/index.html'), { hash: 'spotlight' });
    }
    this.spotlightWin.webContents.openDevTools();
    return this.spotlightWin;
  }

  // 初始化 Spotlight 功能
  init() {
    // 创建 Spotlight 窗口
    this.spotlightWin = this.createSpotlight();

    // 注册全局快捷键
    const ok = globalShortcut.register(this.config.SPOTLIGHT_SHORTCUT, () => {
      this.log.info('✅ 快捷键触发成功');
      if (!this.spotlightWin || this.spotlightWin.isDestroyed()) {
        this.log.warn('Spotlight窗口已销毁，重新创建');
        this.spotlightWin = this.createSpotlight();
      }

      if (this.spotlightWin && !this.spotlightWin.isDestroyed()) {
        if (this.spotlightWin.isVisible()) {
          this.hideWin();
        } else {
          this.spotlightWin.center();
          this.spotlightWin.show();
          this.spotlightWin.focus();
          this.spotlightWin.webContents.send('focus-input'); // send方法是同步的，不需要catch
        }
      }
    });

    if (!ok) {
      this.log.error('❌ 快捷键注册失败');
    }

    // 注册 IPC 处理
    this.registerIpcHandlers();
  }

  // 注册 IPC 处理函数
  registerIpcHandlers() {
    // Spotlight 命令处理
    ipcMain.on('spotlight-cmd', (e, type, cmd) => {
      this.log.info('spotlight-cmd', type, cmd);
      if (!this.mainWindow) return;

      if (type == 'local_route') {
        this.log.info('navigate', cmd);
        this.mainWindow.webContents.send('navigate', cmd);
      } else if (type == 'local_sys') {
        if (cmd == 'quit') {
          this.app.quit();
        } else if (cmd == 'ip') {
          this.handleIpCommand();
        }
      }
    });

    // Spotlight 查询处理
    ipcMain.handle('spotlight:query', async (_e, text, filterProfile = '') => {
      return await spotlightRouter.query(text, filterProfile); // 必须 return
    });

    // Spotlight 打开处理
    ipcMain.handle('spotlight:open', async (_evt, item) => {
      return await spotlightRouter.open(item); // 必须 return
    });

    // Spotlight 隐藏处理
    ipcMain.on('spotlight-hide', () => {
      if (this.spotlightWin && this.spotlightWin.isVisible()) {
        this.hideWin();
      }
    });

    // Spotlight 调整大小处理
    ipcMain.on('spotlight-resize', (event, { h }) => {
      this.log.info('调整高度:', h);
      if (!this.spotlightWin || this.spotlightWin.isDestroyed()) {
        this.log.warn('Spotlight窗口不存在或已销毁');
        return;
      }

      try {
        const bounds = this.spotlightWin.getBounds();
        this.spotlightWin.setBounds({
          x: bounds.x, // 不改
          y: bounds.y, // 不改
          width: bounds.width, // 不改
          height: Math.max(70, Math.min(800, h)), // 限制高度范围 70-800px
        });
      } catch (err) {
        this.log.error('调整Spotlight窗口大小失败:', err);
      }
    });

    // 获取 IP 信息
    ipcMain.handle('sys:getIpInfo', async () => {
      const { getIpInfo } = require('../../electron/utils/ipUtil');
      try {
        const ipInfo = getIpInfo();
        this.log.info('IP信息已获取:', ipInfo);
        return ipInfo;
      } catch (error) {
        this.log.error('获取IP信息失败:', error);
        throw error;
      }
    });
  }

  // 处理 IP 查询命令
  handleIpCommand() {
    const { ipcRenderer } = require('electron');
    const { getIpInfo, getFormattedIpInfo } = require('../../electron/utils/ipUtil');

    try {
      const ipInfo = getIpInfo();
      const formattedInfo = getFormattedIpInfo();

      // 发送 IP 信息到主窗口供显示
      if (this.mainWindow) {
        this.mainWindow.webContents.send('show-ip-info', {
          success: true,
          data: ipInfo,
          formatted: formattedInfo,
        });
      }

      this.log.info('IP信息已获取:', ipInfo);

      // 隐藏 Spotlight 窗口
      if (this.spotlightWin && this.spotlightWin.isVisible()) {
        this.hideWin();
      }
    } catch (error) {
      this.log.error('获取IP信息失败:', error);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('show-ip-info', {
          success: false,
          message: error.message,
        });
      }
    }
  }

  // 注销全局快捷键
  unregisterShortcuts() {
    globalShortcut.unregister(this.config.SPOTLIGHT_SHORTCUT);
  }

  // 获取 Spotlight 窗口引用
  getSpotlightWindow() {
    return this.spotlightWin;
  }
}

// 导出模块
module.exports = SpotlightManager;

/* eslint-disable no-undef */
const { app, BrowserWindow, ipcMain, globalShortcut, Menu, Tray, nativeImage, dialog, shell } = require('electron');
const { initLogger } = require('./electron/logger');
const log = initLogger({ level: 'info' });
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const { registerAllIpc, ipcHandle } = require('./electron/ipc/index');
const spotlight = require('./plugins/chrome/bookmarks');
const spotlightRouter = require('./services/spotlight');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const isMac = process.platform === 'darwin';

const http = require('http');
const https = require('https');

// 让 electron-updater 也写进同一份日志
autoUpdater.logger = log;
autoUpdater.autoDownload = false;

ipcMain.handle('log:openDir', () => {
  const dir = path.join(app.getPath('userData'), 'logs');
  shell.openPath(dir);
  return true;
});

// renderer 写日志入口（contextIsolation 下必须走 IPC）
ipcMain.handle('log:write', (_e, payload) => {
  try {
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

let win = null;
let progressWin = null;
let tray; // ← 保持引用
let spotlightWin = null;
let isQuiting = false;
// 检查是否已存在实例
const gotTheLock = app.requestSingleInstanceLock();
const accelerator = isMac ? 'CommandOrControl+Option+P' : 'CommandOrControl+Alt+P';

const Store = require('electron-store');
const store = new Store({
  name: 'my-data', // 自定义存储文件的名称，默认是 'config'
  encryptionKey: 'aes-256-cbc', // 加密存储的数据
  cwd: 'some/path', // 自定义存储文件的路径
  fileExtension: 'json', // 文件扩展名，默认是 'json'
});

/*****************************************************************************/

function openLogDir() {
  shell.openPath(log.transports.file.getFile().path.replace(/main\.log$/, ''));
}

const UPDATE_SERVER_BASE = 'http://127.0.0.1:3000'; // 改成你的 Express 服务器 IP

function getFeedURL() {
  if (process.platform === 'win32') return `${UPDATE_SERVER_BASE}/win/`;
  if (process.platform === 'darwin') return `${UPDATE_SERVER_BASE}/mac/`;
  return UPDATE_SERVER_BASE;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function createProgressWindow() {
  if (progressWin && !progressWin.isDestroyed()) return progressWin;

  progressWin = new BrowserWindow({
    width: 420,
    height: 180,
    resizable: false,
    minimizable: false,
    maximizable: false,
    modal: false,
    show: false,
    title: '正在下载更新…',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial; margin:16px;}
  .title{font-size:14px; margin-bottom:10px;}
  .bar{width:100%; height:12px; border-radius:999px; background:#e6e6e6; overflow:hidden;}
  .fill{height:100%; width:0%; background:#3b82f6;}
  .meta{margin-top:10px; font-size:12px; color:#444; display:flex; justify-content:space-between;}
  .small{margin-top:6px; font-size:12px; color:#666;}
</style>
</head>
<body>
  <div class="title" id="t">正在下载更新…</div>
  <div class="bar"><div class="fill" id="f"></div></div>
  <div class="meta"><span id="p">0%</span><span id="s">0 MB / 0 MB</span></div>
  <div class="small" id="v"></div>

<script>
  // 主进程通过 executeJavaScript 注入 window.__setProgress(...)
  window.__setProgress = (percent, transferredMB, totalMB, speedMBps, text) => {
    const f = document.getElementById('f');
    const p = document.getElementById('p');
    const s = document.getElementById('s');
    const v = document.getElementById('v');
    f.style.width = percent.toFixed(1) + '%';
    p.textContent = percent.toFixed(1) + '%';
    s.textContent = transferredMB.toFixed(1) + ' MB / ' + totalMB.toFixed(1) + ' MB' + '  (' + speedMBps.toFixed(1) + ' MB/s)';
    v.textContent = text || '';
  };
</script>
</body>
</html>
`;
  progressWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  progressWin.on('closed', () => (progressWin = null));
  return progressWin;
}

function setProgressUI({ percent, transferred, total, speed, text }) {
  if (!progressWin || progressWin.isDestroyed()) return;
  const transferredMB = transferred / 1024 / 1024;
  const totalMB = total / 1024 / 1024;
  const speedMBps = speed / 1024 / 1024;

  progressWin.setProgressBar(Math.max(0, Math.min(1, percent / 100)));

  progressWin.webContents
    .executeJavaScript(
      `window.__setProgress(${percent}, ${transferredMB}, ${totalMB}, ${speedMBps}, ${JSON.stringify(text || '')});`,
      true,
    )
    .catch(() => {});
}

function downloadFileWithProgress(url, outFile, onProgress) {
  log.info('[manual-update] progress', {
    percent: p.percent.toFixed(1),
    transferred: p.transferred,
    total: p.total,
    speed: p.speed,
  });

  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : http;

    const req = client.get(u, (res) => {
      // 处理 302/301
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(downloadFileWithProgress(new URL(res.headers.location, u).toString(), outFile, onProgress));
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }

      const total = Number(res.headers['content-length'] || 0);
      let transferred = 0;

      ensureDir(path.dirname(outFile));
      const file = fs.createWriteStream(outFile);

      const start = Date.now();
      let lastTick = Date.now();
      let lastBytes = 0;

      res.on('data', (chunk) => {
        transferred += chunk.length;

        const now = Date.now();
        if (now - lastTick >= 300) {
          const elapsedSec = (now - start) / 1000;
          const deltaBytes = transferred - lastBytes;
          const deltaSec = (now - lastTick) / 1000;
          const speed = deltaSec > 0 ? deltaBytes / deltaSec : 0;

          const percent = total > 0 ? (transferred / total) * 100 : 0;
          onProgress?.({ percent, transferred, total: total || transferred, speed, elapsedSec });

          lastTick = now;
          lastBytes = transferred;
        }
      });

      res.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          const percent = 100;
          onProgress?.({
            percent,
            transferred,
            total: total || transferred,
            speed: 0,
            elapsedSec: (Date.now() - start) / 1000,
          });
          resolve(outFile);
        });
      });

      file.on('error', (err) => {
        fs.unlink(outFile, () => reject(err));
      });
    });

    req.on('error', reject);
  });
}

function resolveDownloadUrl(updateInfo) {
  // electron-updater 的 updateInfo 里一般会带 files[0].url（generic provider 常见）
  const feed = getFeedURL();
  const fileUrl = updateInfo?.files?.[0]?.url || updateInfo?.path || updateInfo?.url;
  if (!fileUrl) return null;
  return new URL(fileUrl, feed).toString();
}

async function startManualUpdateFlow(updateInfo) {
  const downloadUrl = resolveDownloadUrl(updateInfo);
  if (!downloadUrl) {
    await dialog.showMessageBox({
      type: 'error',
      title: '更新失败',
      message: '无法解析更新下载地址（updateInfo.files[0].url 不存在）。',
    });
    return;
  }

  // 你可以改成 app.getPath("downloads")，这里用 userData 下的 updates 更可控
  const saveDir = path.join(app.getPath('userData'), 'updates');
  const fileName = decodeURIComponent(new URL(downloadUrl).pathname.split('/').pop() || 'update.exe');
  const outFile = path.join(saveDir, fileName);

  const win = createProgressWindow();
  win.show();

  try {
    let lastText = `来源：${downloadUrl}`;
    await downloadFileWithProgress(downloadUrl, outFile, ({ percent, transferred, total, speed }) => {
      setProgressUI({
        percent,
        transferred,
        total,
        speed,
        text: lastText,
      });
    });

    if (progressWin && !progressWin.isDestroyed()) {
      progressWin.setProgressBar(-1);
      progressWin.close();
    }

    const r = await dialog.showMessageBox({
      type: 'info',
      title: '下载完成',
      message: '新版本已下载完成。',
      detail: `文件：${outFile}`,
      buttons: ['打开下载目录', '运行安装包', '稍后'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });

    if (r.response === 0) {
      shell.showItemInFolder(outFile); // 打开并选中文件
    } else if (r.response === 1) {
      shell.openPath(outFile); // 直接运行安装包
    }
  } catch (e) {
    console.error('[manual-update] download error:', e);
    if (progressWin && !progressWin.isDestroyed()) {
      progressWin.setProgressBar(-1);
      progressWin.close();
    }
    await dialog.showMessageBox({
      type: 'error',
      title: '下载失败',
      message: '更新包下载失败。',
      detail: String(e?.message || e),
    });
  }
}

function setupAutoUpdate() {
  log.info('[updater] setup start');
  // 只用来“检查更新拿信息”，不走下载/安装（避免签名校验卡住）
  autoUpdater.autoDownload = false;

  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
    console.log('xxxx');
  }

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: getFeedURL(),
  });

  log.info('[updater] feed url:', getFeedURL());

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for update');
    log.info('[updater] checking for update');
  });

  // autoUpdater.on('update-available', async (info) => {
  //   console.log('[updater] update available:', info.version);

  //   const r = await dialog.showMessageBox({
  //     type: 'info',
  //     title: '发现新版本',
  //     message: `发现新版本 ${info.version}，是否下载？`,
  //     buttons: ['下载', '稍后'],
  //     defaultId: 0,
  //     cancelId: 1,
  //     noLink: true,
  //   });

  //   if (r.response === 0) {
  //     autoUpdater.downloadUpdate();
  //   }
  // });

  autoUpdater.on('update-available', async (info) => {
    log.info('[updater] update available', {
      version: info.version,
      files: info.files,
    });
    const r = await dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${info.version}，是否下载？`,
      buttons: ['下载', '稍后'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (r.response === 0) {
      await startManualUpdateFlow(info);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] no update available');
  });

  autoUpdater.on('download-progress', (p) => {
    console.log(`[updater] download ${Math.round(p.percent)}% (${p.transferred}/${p.total})`);
  });

  autoUpdater.on('update-downloaded', async () => {
    console.log('[updater] update downloaded');
    log.info('[updater] update not available');

    // mac 无签名：不保证一定成功，但允许尝试
    const isMac = process.platform === 'darwin';

    const r = await dialog.showMessageBox({
      type: 'info',
      title: '更新已下载',
      message: isMac
        ? '更新已下载完成，重启应用以尝试完成更新。\n\n如果更新失败，请退出应用后重新打开。'
        : '更新已下载完成，是否立即安装并重启？',
      buttons: isMac ? ['立即重启', '稍后'] : ['安装并重启', '稍后'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (r.response === 0) {
      autoUpdater.quitAndInstall(true, true);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err);
    // mac 无签名时这里偶尔会报错，建议只打日志
  });
}

function checkForUpdates() {
  try {
    autoUpdater.checkForUpdates();
  } catch (e) {
    console.error('[updater] check failed:', e);
  }
}

/**


const UPDATE_SERVER_BASE = "http://192.168.1.10:3000";

function getFeedURL() {
  if (process.platform === "win32") return `${UPDATE_SERVER_BASE}/win/`;
  if (process.platform === "darwin") return `${UPDATE_SERVER_BASE}/mac/`;
  return UPDATE_SERVER_BASE;
}

function setupUpdater() {
  autoUpdater.autoDownload = false;

  autoUpdater.setFeedURL({ provider: "generic", url: getFeedURL() });

  autoUpdater.on("update-available", async (info) => {
    const r = await dialog.showMessageBox({
      type: "info",
      title: "发现新版本",
      message: `发现新版本 ${info.version}，是否下载？`,
      buttons: ["下载", "稍后"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (r.response === 0) autoUpdater.downloadUpdate();
  });

  autoUpdater.on("update-downloaded", async () => {
    const r = await dialog.showMessageBox({
      type: "info",
      title: "更新已就绪",
      message: "更新已下载完成，是否立即安装并重启？",
      buttons: ["安装并重启", "稍后"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (r.response === 0) autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.on("error", (e) => console.error("[updater] error:", e));
}

 */
/*****************************************************************************/

/*****************************************************************************/
store.set('name', 'xiejie');
console.log(store.get('name')); // xiejie
// 还可以设置 JSON 对象某个属性的值
store.set('foo.bar', 'this is a bar');
console.log(store.get('foo')); // {bar: "this is a bar"}
console.log(store.get('aaa')); // undefined

/*****************************************************************************/

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
        { label: '功能三', click: () => checkForUpdates() },

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

function initUpdater() {
  if (!app.isPackaged) {
    console.log('[updater] skip in dev mode');
    // return;
  }
  setupAutoUpdate();
  autoUpdater.checkForUpdates();
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
    initUpdater();
    // setupAutoUpdate();
    // setTimeout(checkForUpdates, 3000);
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
// 当我们注册了全局快捷键之后，当应用程序退出的时候，也需要注销这个快捷键
app.on('will-quit', function () {
  globalShortcut.unregister(accelerator);
  globalShortcut.unregisterAll();
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

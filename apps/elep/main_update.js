const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

const UPDATE_SERVER_BASE = 'http://192.168.1.10:3000'; // 内网更新服务器
let mainWindow; // 你的主窗口引用
let updateWindow = null; // 更新UI窗口
let downloading = false;

function getFeedURL() {
  if (process.platform === 'win32') return `${UPDATE_SERVER_BASE}/win/`;
  if (process.platform === 'darwin') return `${UPDATE_SERVER_BASE}/mac/`;
  return UPDATE_SERVER_BASE;
}

// ====== 更新UI窗口 ======
function createUpdateWindow() {
  if (updateWindow && !updateWindow.isDestroyed()) return updateWindow;

  updateWindow = new BrowserWindow({
    width: 420,
    height: 220,
    resizable: false,
    minimizable: true,
    maximizable: false,
    show: false,
    alwaysOnTop: true,
    title: '正在更新',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 简单内嵌页面（无需额外文件）
  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:;">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial;
       margin:16px;background:#fff;color:#111}
  .title{font-size:16px;font-weight:600;margin-bottom:10px}
  .desc{font-size:12px;color:#555;margin-bottom:12px;white-space:pre-line}
  .bar{height:10px;background:#eee;border-radius:999px;overflow:hidden}
  .fill{height:10px;width:0%;background:#2f7cf6}
  .row{display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:#333}
  .muted{color:#666}
</style>
</head>
<body>
  <div class="title" id="title">准备更新…</div>
  <div class="desc" id="desc">正在初始化</div>
  <div class="bar"><div class="fill" id="fill"></div></div>
  <div class="row">
    <div id="percent">0%</div>
    <div class="muted" id="detail">0 MB / 0 MB</div>
  </div>

<script>
  // 通过 window.postMessage 接收主进程发来的状态（无需ipc）
  window.addEventListener('message', (e) => {
    const s = e.data || {};
    if (s.title) document.getElementById('title').textContent = s.title;
    if (s.desc) document.getElementById('desc').textContent = s.desc;
    if (typeof s.percent === 'number') {
      document.getElementById('percent').textContent = Math.floor(s.percent) + '%';
      document.getElementById('fill').style.width = Math.max(0, Math.min(100, s.percent)) + '%';
    }
    if (s.detail) document.getElementById('detail').textContent = s.detail;
  });
</script>
</body>
</html>`;

  updateWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  updateWindow.on('closed', () => (updateWindow = null));
  return updateWindow;
}

function showUpdateUI(payload) {
  const w = createUpdateWindow();
  if (!w.isVisible()) w.show();
  // 用 postMessage 往页面发数据
  w.webContents.executeJavaScript(`window.postMessage(${JSON.stringify(payload)}, '*');`, true).catch(() => {});
}

function closeUpdateUI() {
  if (updateWindow && !updateWindow.isDestroyed()) updateWindow.close();
  updateWindow = null;
}

function formatMB(bytes) {
  if (!bytes || bytes <= 0) return '0 MB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function formatSpeed(bps) {
  if (!bps || bps <= 0) return '';
  return (bps / 1024 / 1024).toFixed(1) + ' MB/s';
}

// ====== 更新逻辑（带 UI） ======
function setupAutoUpdate() {
  autoUpdater.autoDownload = false;

  // 你已用方案二：关闭签名校验（Windows）
  // electron-builder.yml 里设置：verifyUpdateCodeSignature: false

  autoUpdater.setFeedURL({ provider: 'generic', url: getFeedURL() });

  autoUpdater.on('checking-for-update', () => {
    showUpdateUI({
      title: '检查更新…',
      desc: '正在连接内部更新服务器',
      percent: 0,
      detail: '',
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(2); // indeterminate
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(-1);
    closeUpdateUI();
    // 不弹窗打扰；如果你希望“手动检查更新”时提示，可在菜单里另做
  });

  autoUpdater.on('update-available', async (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(-1);
    showUpdateUI({
      title: '发现新版本',
      desc: `新版本：${info.version}\n下载完成后将自动安装并重启`,
      percent: 0,
      detail: '',
    });

    const r = await dialog.showMessageBox(mainWindow ?? undefined, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${info.version}`,
      detail: '是否现在下载？（下载完成后会提示安装并重启）',
      buttons: ['立即下载', '稍后'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (r.response === 0) {
      downloading = true;
      showUpdateUI({
        title: '正在下载更新…',
        desc: '请不要关闭应用',
        percent: 0,
        detail: '',
      });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(0);
      }
      autoUpdater.downloadUpdate();
    } else {
      closeUpdateUI();
    }
  });

  autoUpdater.on('download-progress', (p) => {
    // p: percent, transferred, total, bytesPerSecond
    const detail =
      `${formatMB(p.transferred)} / ${formatMB(p.total)}` +
      (p.bytesPerSecond ? `  ·  ${formatSpeed(p.bytesPerSecond)}` : '');

    showUpdateUI({
      title: '正在下载更新…',
      desc: '下载完成后将提示安装并重启',
      percent: p.percent,
      detail,
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      // Windows任务栏进度
      mainWindow.setProgressBar(Math.max(0, Math.min(1, p.percent / 100)));
    }
  });

  autoUpdater.on('update-downloaded', async () => {
    downloading = false;

    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(-1);

    showUpdateUI({
      title: '下载完成',
      desc: '已准备安装。安装过程中应用会退出并自动重启。',
      percent: 100,
      detail: '下载完成',
    });

    const r = await dialog.showMessageBox(mainWindow ?? undefined, {
      type: 'info',
      title: '更新已就绪',
      message: '更新已下载完成',
      detail: '是否现在安装并重启？',
      buttons: ['立即安装并重启', '稍后'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (r.response === 0) {
      showUpdateUI({
        title: '正在安装…',
        desc: '请稍候，应用即将重启',
        percent: 100,
        detail: '安装中',
      });

      // 给 UI 一点时间刷新（非必须，但体验更好）
      setTimeout(() => {
        autoUpdater.quitAndInstall(true, true);
      }, 400);
    } else {
      // 稍后安装：保留一个轻提示窗口也行，这里直接关闭
      closeUpdateUI();
    }
  });

  autoUpdater.on('error', (err) => {
    downloading = false;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(-1);

    showUpdateUI({
      title: '更新失败',
      desc: '本次更新未完成，你可以稍后重试。\n（内部工具不影响继续使用）',
      percent: 0,
      detail: '',
    });

    console.error('[updater] error:', err);
  });
}

// 你可以在创建主窗口后调用
function startUpdateCheckOnLaunch() {
  if (!app.isPackaged) return; // dev 环境不跑 updater
  setTimeout(() => autoUpdater.checkForUpdates(), 2000);
}

// ====== 你原来的创建窗口示例：请把 mainWindow 赋值，然后调用 ======
app.whenReady().then(() => {
  // TODO: 你的创建主窗口逻辑
  // mainWindow = new BrowserWindow(...)

  setupAutoUpdate();
  startUpdateCheckOnLaunch();
});

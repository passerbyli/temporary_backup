const { BrowserWindow, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

class UpdateManager {
  constructor(options) {
    this.app = options.app;
    this.log = options.log;
    this.config = options.config;
    this.mainWindow = null;
    this.updateWindow = null;
    this.progressWin = null;
    this.isDev = process.env.NODE_ENV === 'development' || !this.app.isPackaged;

    // 让 electron-updater 也写进同一份日志
    autoUpdater.logger = this.log;
    autoUpdater.autoDownload = false;
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  // ====== 更新UI窗口 ======
  createUpdateWindow() {
    if (this.updateWindow && !this.updateWindow.isDestroyed()) return this.updateWindow;

    this.updateWindow = new BrowserWindow({
      width: this.config.UPDATE_WINDOW_WIDTH,
      height: this.config.UPDATE_WINDOW_HEIGHT,
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

    this.updateWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    this.updateWindow.on('closed', () => (this.updateWindow = null));
    return this.updateWindow;
  }

  showUpdateUI(payload) {
    this.log.info('showUpdateUI', payload);
    const w = this.createUpdateWindow();
    if (!w.isVisible()) w.show();
    // 用 postMessage 往页面发数据
    w.webContents.executeJavaScript(`window.postMessage(${JSON.stringify(payload)}, '*');`, true).catch(() => {});
  }

  closeUpdateUI() {
    if (this.updateWindow && !this.updateWindow.isDestroyed()) this.updateWindow.close();
    this.updateWindow = null;
  }

  formatMB(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  formatSpeed(bps) {
    if (!bps || bps <= 0) return '';
    return (bps / 1024 / 1024).toFixed(1) + ' MB/s';
  }

  // 模拟更新流程（用于开发测试）
  mockUpdateFlow() {
    // 1) checking
    this.showUpdateUI({
      title: '检查更新…',
      desc: '（DEV 模拟）正在连接内部更新服务器',
      percent: 0,
      detail: '',
    });
    if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.setProgressBar(2);

    // 2) update available
    setTimeout(async () => { // 800ms 延迟
      if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.setProgressBar(-1);

      this.showUpdateUI({
        title: '发现新版本',
        desc: '（DEV 模拟）新版本：0.0.99\n下载完成后将自动安装并重启',
        percent: 0,
        detail: '',
      });

      const r = await dialog.showMessageBox(this.mainWindow ?? undefined, {
        type: 'info',
        title: '发现新版本（DEV 模拟）',
        message: '发现新版本 0.0.99',
        detail: '是否现在下载？（模拟下载进度）',
        buttons: ['立即下载', '稍后'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      if (r.response !== 0) {
        this.closeUpdateUI();
        return;
      }

      // 3) progress
      let percent = 0;
      if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.setProgressBar(0);

      const timer = setInterval(() => {
        percent += 2.5; // 每次增加2.5%进度
        const transferred = (Math.min(100, percent) / 100) * this.config.MOCK_UPDATE_FILE_SIZE_MB * 1024 * 1024;
        const total = this.config.MOCK_UPDATE_FILE_SIZE_MB * 1024 * 1024;

        this.showUpdateUI({
          title: '正在下载更新…',
          desc: '（DEV 模拟）下载完成后将提示安装并重启',
          percent: Math.min(100, percent),
          detail: `${this.formatMB(transferred)} / ${this.formatMB(total)}  ·  ${this.config.MOCK_UPDATE_SPEED_MBPS} MB/s`,
        });

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.setProgressBar(Math.max(0, Math.min(1, percent / 100)));
        }

        if (percent >= 100) {
          clearInterval(timer);
          if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.setProgressBar(-1);

          // 4) downloaded
          setTimeout(async () => {
            this.showUpdateUI({
              title: '下载完成',
              desc: '（DEV 模拟）已准备安装。安装过程中应用会退出并自动重启。',
              percent: 100,
              detail: '下载完成',
            });

            const rr = await dialog.showMessageBox(this.mainWindow ?? undefined, {
              type: 'info',
              title: '更新已就绪（DEV 模拟）',
              message: '更新已下载完成',
              detail: '是否现在安装并重启？（这里只模拟，不会真的安装）',
              buttons: ['立即安装并重启', '稍后'],
              defaultId: 0,
              cancelId: 1,
              noLink: true,
            });

            if (rr.response === 0) {
              this.showUpdateUI({
                title: '正在安装…',
                desc: '（DEV 模拟）请稍候，应用即将重启',
                percent: 100,
                detail: '安装中',
              });

              // 模拟“重启”
              setTimeout(() => { // 800ms 延迟
                this.closeUpdateUI();
                dialog.showMessageBox({
                  type: 'info',
                  title: '模拟完成',
                  message: '（DEV 模拟）已完成安装并重启（仅演示 UI）',
                  buttons: ['知道了'],
                  noLink: true,
                });
              }, 800); // 800ms 延迟
            } else {
              this.closeUpdateUI();
            }
          }, 300); // 300ms 延迟
        }
      }, 120); // 120ms 间隔
    }, 800);
  }

  getFeedURL() {
    if (process.platform === 'win32') return `${this.config.UPDATE_SERVER_BASE}/win/`;
    if (process.platform === 'darwin') return `${this.config.UPDATE_SERVER_BASE}/mac/`;
    return this.config.UPDATE_SERVER_BASE;
  }

  ensureDir(p) {
    fs.mkdirSync(p, { recursive: true });
  }

  createProgressWindow() {
    if (this.progressWin && !this.progressWin.isDestroyed()) return this.progressWin;

    this.progressWin = new BrowserWindow({
      width: this.config.PROGRESS_WINDOW_WIDTH,
      height: this.config.PROGRESS_WINDOW_HEIGHT,
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
    this.progressWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    this.progressWin.on('closed', () => (this.progressWin = null));
    return this.progressWin;
  }

  setProgressUI({ percent, transferred, total, speed, text }) {
    if (!this.progressWin || this.progressWin.isDestroyed()) return;
    const transferredMB = transferred / 1024 / 1024;
    const totalMB = total / 1024 / 1024;
    const speedMBps = speed / 1024 / 1024;

    this.progressWin.setProgressBar(Math.max(0, Math.min(1, percent / 100)));

    this.progressWin.webContents
      .executeJavaScript(
        `window.__setProgress(${percent}, ${transferredMB}, ${totalMB}, ${speedMBps}, ${JSON.stringify(text || '')});`,
        true,
      )
      .catch(() => {});
  }

  /**
   * 带进度的文件下载函数
   * @param {string} url - 下载文件的URL地址
   * @param {string} outFile - 下载文件的保存路径
   * @param {Function} onProgress - 进度回调函数，接收 { percent, transferred, total, speed, elapsedSec } 参数
   * @returns {Promise<string>} - 返回下载完成的文件路径
   */
  downloadFileWithProgress(url, outFile, onProgress) {
    return new Promise((resolve, reject) => {
      // 安全检查：限制输出目录，防止路径遍历攻击
      const safeOutDir = path.join(this.app.getPath('userData'), 'updates');
      const resolvedOutFile = path.resolve(outFile);
      if (!resolvedOutFile.startsWith(path.resolve(safeOutDir))) {
        return reject(new Error('Output file path is not allowed: must be within updates directory'));
      }

      const u = new URL(url);
      const client = u.protocol === 'https:' ? https : http;

      const req = client.get(u, (res) => {
        // 处理 302/301
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(this.downloadFileWithProgress(new URL(res.headers.location, u).toString(), outFile, onProgress));
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }

        const total = Number(res.headers['content-length'] || 0);
        let transferred = 0;

        this.ensureDir(path.dirname(outFile));
        const file = fs.createWriteStream(outFile);

        const start = Date.now();
        let lastTick = Date.now();
        let lastBytes = 0;

        res.on('data', (chunk) => {
          transferred += chunk.length;

          const now = Date.now();
          if (now - lastTick >= 300) { // 300ms 更新一次进度
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

  resolveDownloadUrl(updateInfo) {
    // electron-updater 的 updateInfo 里一般会带 files[0].url（generic provider 常见）
    const feed = this.getFeedURL();
    const fileUrl = updateInfo?.files?.[0]?.url || updateInfo?.path || updateInfo?.url;
    if (!fileUrl) return null;
    return new URL(fileUrl, feed).toString();
  }

  /**
   * 启动手动更新流程
   * @param {Object} updateInfo - 更新信息对象，包含下载地址等信息
   * @returns {Promise<void>} - 无返回值
   */
  async startManualUpdateFlow(updateInfo) {
    const downloadUrl = this.resolveDownloadUrl(updateInfo);
    this.log.info('[updater] manual update flow start', { downloadUrl });
    if (!downloadUrl) {
      await dialog.showMessageBox({
        type: 'error',
        title: '更新失败',
        message: '无法解析更新下载地址（updateInfo.files[0].url 不存在）。',
      });
      return;
    }

    // 你可以改成 app.getPath("downloads")，这里用 userData 下的 updates 更可控
    const saveDir = path.join(this.app.getPath('userData'), 'updates');
    const fileName = decodeURIComponent(new URL(downloadUrl).pathname.split('/').pop() || 'update.exe');
    const outFile = path.join(saveDir, fileName);

    const win2 = this.createProgressWindow();
    win2.show();

    try {
      let lastText = `来源：${downloadUrl}`;
      await this.downloadFileWithProgress(downloadUrl, outFile, ({ percent, transferred, total, speed }) => {
        this.setProgressUI({
          percent,
          transferred,
          total,
          speed,
          text: lastText,
        });
      });

      if (this.progressWin && !this.progressWin.isDestroyed()) {
        this.progressWin.setProgressBar(-1);
        this.progressWin.close();
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
      this.log.error('[manual-update] download error:', e);
      if (this.progressWin && !this.progressWin.isDestroyed()) {
        this.progressWin.setProgressBar(-1);
        this.progressWin.close();
      }
      await dialog.showMessageBox({
        type: 'error',
        title: '下载失败',
        message: '更新包下载失败。',
        detail: String(e?.message || e),
      });
    }
  }

  /**
   * 设置自动更新配置
   * 配置 electron-updater 以检查更新，但不自动下载和安装
   */
  setupAutoUpdate() {
    this.log.info('[updater] setup start');
    // 只用来“检查更新拿信息”，不走下载/安装（避免签名校验卡住）
    autoUpdater.autoDownload = false;

    if (this.isDev) {
      autoUpdater.forceDevUpdateConfig = true;
    }

    autoUpdater.setFeedURL({
      provider: 'generic',
      url: this.getFeedURL(),
    });
    this.log.info('[updater] feed url:', this.getFeedURL());

    autoUpdater.on('checking-for-update', () => {
      this.log.info('[updater] checking for update');
    });

    autoUpdater.on('update-available', async (info) => {
      this.log.info('[updater] update available', {
        version: info.version,
        files: info.files,
      });
      const r = await dialog.showMessageBox(this.mainWindow ?? undefined, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${info.version}，是否下载？`,
        buttons: ['下载', '稍后'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      if (r.response === 0) {
        // autoUpdater.downloadUpdate();
        await this.startManualUpdateFlow(info);
      }
    });

    autoUpdater.on('update-not-available', () => {
      this.log.info('[updater] no update available');
    });

    autoUpdater.on('download-progress', (p) => {
      this.log.info(`[updater] download ${Math.round(p.percent)}% (${p.transferred}/${p.total})`);
    });

    autoUpdater.on('update-downloaded', async () => {
      this.log.info('[updater] update downloaded');

      // mac 无签名：不保证一定成功，但允许尝试
      const r = await dialog.showMessageBox(this.mainWindow ?? undefined, {
        type: 'info',
        title: '更新已下载',
        message: process.platform === 'darwin'
          ? '更新已下载完成，重启应用以尝试完成更新。\n\n如果更新失败，请退出应用后重新打开。'
          : '更新已下载完成，是否立即安装并重启？',
        buttons: process.platform === 'darwin' ? ['立即重启', '稍后'] : ['安装并重启', '稍后'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      if (r.response === 0) {
        autoUpdater.quitAndInstall(true, true);
      }
    });

    autoUpdater.on('error', (err) => {
      this.log.error('[updater] error:', err);
      // mac 无签名时这里偶尔会报错，建议只打日志
    });
  }

  checkForUpdates() {
    try {
      autoUpdater.checkForUpdates();
    } catch (e) {
      this.log.error('[updater] check failed:', e);
    }
  }

  initUpdater() {
    if (this.isDev) {
      this.log.info('[updater] skip in dev mode');
      return;
    }
    this.setupAutoUpdate();
    // autoUpdater.checkForUpdates();
  }

  // 初始化更新管理器
  init() {
    this.initUpdater();
  }

  // 清理资源
  cleanup() {
    this.closeUpdateUI();
    if (this.progressWin && !this.progressWin.isDestroyed()) {
      this.progressWin.close();
    }
  }
}

module.exports = UpdateManager;
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

    this.globalSettings = false;

    // 让 electron-updater 也写进同一份日志
    autoUpdater.logger = this.log;
    autoUpdater.autoDownload = false;
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  // 给渲染进程发送消息
  sendUpdateMessage(text) {
    this.mainWindow.webContents.send('message', text);
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
          return resolve(
            this.downloadFileWithProgress(new URL(res.headers.location, u).toString(), outFile, onProgress),
          );
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
          if (now - lastTick >= 300) {
            // 300ms 更新一次进度
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
    this.log.info('[updater] 启动手动更新流程', { downloadUrl });
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
    // 设置更新包的地址
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: this.getFeedURL(),
    });
    this.log.info('[updater] feed url:', this.getFeedURL());

    // 监听开始检测更新事件
    autoUpdater.on('checking-for-update', (message) => {
      this.log.info('[updater] 检测更新', message);
    });

    // 监听发现可用更新事件
    autoUpdater.on('update-available', async (info) => {
      this.log.info('[updater] 发现可用更新', {
        version: info.version,
        files: info.files,
      });

      const releaseNotes = info.releaseNotes;
      let releaseContent = '';
      if (releaseNotes) {
        releaseContent = '本次更新\n';
        if (typeof releaseNotes === 'string') {
          releaseContent = releaseNotes;
        } else if (releaseNotes instanceof Array) {
          releaseNotes.forEach((releaseNote, index) => {
            releaseContent += `- ${releaseNote}\n`;
          });
        }
      } else {
        releaseContent = '暂无更新说明';
      }

      const r = await dialog.showMessageBox(this.mainWindow ?? undefined, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${info.version}，是否下载？`,
        detail: releaseContent,
        buttons: ['下载', '稍后'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      if (r.response === 0) {
        await this.startManualUpdateFlow(info);
      }
    });
    // 监听没有可用更新事件
    autoUpdater.on('update-not-available', (message) => {
      this.log.info('[updater] 没有可用更新', message);
    });
    // 更新下载进度事件
    autoUpdater.on('download-progress', (p) => {
      this.log.info(`[updater] download ${Math.round(p.percent)}% (${p.transferred}/${p.total})`);
    });

    // 监听下载完成事件
    // autoUpdater.on('update-downloaded', async (event, releaseNotes, releaseName, releaseDate, updateUrl, quitAndUpdate) => {
    autoUpdater.on('update-downloaded', async (releaseInfo) => {
      this.log.info('[updater] update downloaded');
      this.log.info(JSON.stringify(releaseInfo));

      // mac 无签名：不保证一定成功，但允许尝试
      const r = await dialog.showMessageBox(this.mainWindow ?? undefined, {
        type: 'info',
        title: '更新已下载',
        message:
          process.platform === 'darwin'
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
      sendUpdateMessage({
        cmd: 'error',
        message: error,
      });
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
      // return;
    }
    this.setupAutoUpdate();
    // autoUpdater.checkForUpdates();
  }

  // 初始化更新管理器
  init() {
    this.initUpdater();
  }
}

module.exports = UpdateManager;

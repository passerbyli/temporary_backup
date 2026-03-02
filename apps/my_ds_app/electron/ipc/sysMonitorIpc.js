const { createSampler } = require('../utils/collector');
const { execFile } = require('child_process');

function execFileAsync(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

async function killProcessCrossPlatform(pid, { force = false } = {}) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('invalid pid');
  if (pid === process.pid) throw new Error('cannot kill self');

  if (process.platform === 'win32') {
    // Windows: taskkill /PID <pid> [/T] [/F]
    // /T: 结束子进程树；/F: 强制
    const args = ['/PID', String(pid), '/T'];
    if (force) args.push('/F');

    try {
      await execFileAsync('taskkill', args);
      return;
    } catch (e) {
      // 一些情况下需要提升权限；把 stderr 带回去更好排障
      const msg = (e.stderr || e.stdout || e.message || '').toString().trim();
      throw new Error(msg || 'taskkill failed');
    }
  }

  // macOS/Linux
  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
  } catch (e) {
    throw new Error(e.message || String(e));
  }
}

function registerSysMonitorIpc(ipcMain) {
  // 每个 webContents 单独一个推送任务
  const tasks = new Map(); // key: webContentsId, value: { timer, senderId }

  ipcMain.handle('sys-monitor:start', (event, options = {}) => {
    const sender = event.sender;
    const id = sender.id;

    // 已经启动就先停掉再重启（防止重复 interval）
    if (tasks.has(id)) {
      clearInterval(tasks.get(id).timer);
      tasks.delete(id);
    }

    const intervalMs = Number(options.intervalMs || 1500);
    const top = Number(options.top || 5);
    const alpha = typeof options.alpha === 'number' ? options.alpha : 0.35;

    const sampler = createSampler({ alpha, top });

    const tick = async () => {
      try {
        const data = await sampler.sample();
        // 主动 push（channel 固定）
        sender.send('sys-monitor:sample', data);
      } catch (e) {
        sender.send('sys-monitor:error', {
          ts: Date.now(),
          message: String(e && e.message ? e.message : e),
        });
      }
    };

    const timer = setInterval(tick, intervalMs);
    tick();

    tasks.set(id, { timer });

    return { ok: true };
  });

  ipcMain.handle('sys-monitor:stop', (event) => {
    const sender = event.sender;
    const id = sender.id;

    const task = tasks.get(id);
    if (task) {
      clearInterval(task.timer);
      tasks.delete(id);
    }
    return { ok: true };
  });

  // 可选：一次性拉取（不启动推送）
  ipcMain.handle('sys-monitor:once', async (_event, options = {}) => {
    const { sampleOnce } = require('../../shared/sysinfo/collector');
    return sampleOnce({ top: Number(options.top || 5) });
  });

  ipcMain.handle('sys-monitor:kill', async (_event, payload) => {
    // payload: { pid: number, force?: boolean }
    try {
      const pid = typeof payload === 'number' ? payload : payload?.pid;
      const force = typeof payload === 'object' ? !!payload.force : false;

      await killProcessCrossPlatform(pid, { force });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message || String(e) };
    }
  });
}

module.exports = registerSysMonitorIpc;

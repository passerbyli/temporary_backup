// services/spotlight/providers/cmd.js
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { clipboard, shell } = require('electron');

const isWin = process.platform === 'win32';
// 顶部：新增一个包装，把命令放到 UTF-8 代码页执行
function wrapUtf8(command) {
  // 切到 65001（UTF-8），并执行原命令。>nul 静音
  // 注意 & 连接符能串接多条命令
  return `chcp 65001>nul & ${command}`;
}
function ensureWindows() {
  if (!isWin) throw new Error('CMD 快速执行仅在 Windows 可用');
}

function exists(p) {
  try {
    return p && fs.existsSync(p);
  } catch {
    return false;
  }
}

function findPwsh() {
  // 优先 Windows Terminal，再 PowerShell，再 cmd
  const wt = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'wt.exe');
  const pwsh1 = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const pwsh2 = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe');
  return {
    wt: exists(wt) ? wt : null,
    pwsh: exists(pwsh2) ? pwsh2 : exists(pwsh1) ? pwsh1 : null,
  };
}

/** 终端动作：新开窗口并停留，UTF-8 中文不花 */
function openInTerminal(command) {
  const { wt, pwsh } = findPwsh();

  // 统一的 PowerShell 启动脚本：
  // - 关闭 Logo，不退出
  // - 设置控制台输入/输出编码为 UTF-8
  // - 直接执行用户命令
  const psCmd =
    `$OutputEncoding = [Console]::OutputEncoding = ` +
    `[System.Text.UTF8Encoding]::new(); ` +
    `[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new(); ` +
    `${command}`;

  if (wt && pwsh) {
    // Windows Terminal 打开一个 PowerShell 页签并常驻
    spawn(wt, ['-w', '0', 'nt', pwsh, '-NoLogo', '-NoExit', '-Command', psCmd], {
      windowsHide: false,
      detached: true,
      stdio: 'ignore',
    }).unref();
    return true;
  }

  if (pwsh) {
    // 直接新开 PowerShell 窗口
    spawn('cmd.exe', ['/c', 'start', '""', pwsh, '-NoLogo', '-NoExit', '-Command', psCmd], {
      windowsHide: false,
      detached: true,
      stdio: 'ignore',
    }).unref();
    return true;
  }

  // 兜底：经典 cmd 窗口（尽量也用 UTF-8，但显示字体可能导致方块）
  const cmdLine = `chcp 65001>nul & ${command}`;
  spawn('cmd.exe', ['/c', 'start', '""', 'cmd', '/k', cmdLine], {
    windowsHide: false,
    detached: true,
    stdio: 'ignore',
  }).unref();
  return true;
}

function defaultItem(raw) {
  return {
    provider: 'cmd',
    kind: 'run',
    view: 'CmdItem',
    title: `运行：${raw}`,
    subtitle: '后台执行，输出将用记事本打开',
    command: raw,
  };
}

function errorItem(msg) {
  return {
    provider: 'cmd',
    kind: 'error',
    view: 'LocalItem',
    label: `⚠️ ${msg}`,
    disabled: true,
  };
}

function runCmdCapture(command, { timeoutMs = 20000, maxBytes = 2 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    // /d: 禁用 AutoRun；/s: 正确处理引号；/c: 执行后退出
    const child = spawn('cmd.exe', ['/d', '/s', '/c', wrapUtf8(command)], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = Buffer.alloc(0);
    let err = Buffer.alloc(0);
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        child.kill();
        reject(new Error(`命令超时(${timeoutMs}ms)：${command}`));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      out = Buffer.concat([out, chunk]);
      if (out.length > maxBytes) {
        // 超过上限就截断
        out = Buffer.concat([out.slice(0, maxBytes), Buffer.from('\n...[截断]\n', 'utf8')]);
        child.stdout.removeAllListeners('data');
      }
    });

    child.stderr.on('data', (chunk) => {
      err = Buffer.concat([err, chunk]);
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ code, stdout: out.toString('utf8'), stderr: err.toString('utf8') });
    });

    child.on('error', (e) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(e);
    });
  });
}

async function openOutputInNotepad(text, title = 'cmd-output') {
  const tmp = path.join(os.tmpdir(), `${title}_${Date.now()}.txt`);
  // 在最前面写入 BOM，避免旧记事本把 UTF-8 当 ANSI
  const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
  await fs.promises.writeFile(tmp, Buffer.concat([BOM, Buffer.from(text, 'utf8')]));
  await shell.openPath(tmp);
  return tmp;
}

/** Provider API: search(content) */
async function search(content) {
  ensureWindows();
  const q = String(content || '').trim();
  if (!q) return { items: [] };
  // 只给一条“运行：命令”项（也可扩展为历史/推荐命令列表）
  return { items: [defaultItem(q)] };
}

/** Provider API: open(item) */
async function open(item) {
  ensureWindows();
  if (!item) return false;

  // 按钮动作：copy / terminal / run
  const action = item.action || 'run';

  if (action === 'copy') {
    clipboard.writeText(item.command || '');
    return true;
  }

  if (action === 'terminal') {
    openInTerminal(item.command);
    return true;
  }

  // 默认：后台执行并把输出写到临时文件，用记事本打开
  const { code, stdout, stderr } = await runCmdCapture(item.command);
  const header = `> ${item.command}\n(exit code: ${code})\n\n`;
  const text = header + (stdout || '') + (stderr ? `\n[stderr]\n${stderr}` : '');
  await openOutputInNotepad(text, 'spotlight-cmd');
  return true;
}

module.exports = { search, open };

// services/spotlight/providers/files.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite'); // 用于解决中文路径输出编码
const isWin = process.platform === 'win32';

const CONFIG = {
  maxResults: 9,
  // 常见安装位置（可自行追加）
  esCandidates: [
    'es.exe', // 如果在 PATH
    'C:\\Program Files\\Everything\\es.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Everything', 'es.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Everything', 'es.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Everything', 'es.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Everything', 'es.exe'),
  ],
  everythingExe: [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Everything', 'Everything.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Everything', 'Everything.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Everything', 'Everything.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Everything', 'Everything.exe'),
  ],
};

function ensureWindows() {
  if (!isWin) throw new Error('Everything 文件搜索仅在 Windows 可用');
}

function pickExisting(paths) {
  for (const p of paths) {
    if (!p) continue;
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

function findEsExe() {
  // 优先 PATH（'es.exe'）再尝试常见目录
  return pickExisting(CONFIG.esCandidates);
}

function decodeWindows(buf) {
  // es.exe 用当前系统代码页，一般是 CP936；用 iconv 兜底
  if (!Buffer.isBuffer(buf)) return String(buf || '');
  try {
    return iconv.decode(buf, 'cp936');
  } catch {
    return buf.toString('utf8');
  }
}

function runEsRaw(args) {
  return new Promise((resolve, reject) => {
    const es = findEsExe();
    if (!es) return reject(new Error('未找到 es.exe；请安装 Everything 并将 es.exe 加入 PATH 或放到常见安装目录'));

    const child = spawn(es, args, { windowsHide: true });
    const chunks = [];
    const errChunks = [];

    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => errChunks.push(d));

    child.on('close', (code) => {
      const out = decodeWindows(Buffer.concat(chunks));
      const err = decodeWindows(Buffer.concat(errChunks));
      if (code === 0) resolve({ out, err });
      else reject(new Error(err || `es.exe exit ${code}`));
    });
    child.on('error', reject);
  });
}

async function esAvailable() {
  try {
    // 用一个简单查询测试，而不是 -version
    const { out } = await runEsRaw(['-n', '1', 'test']);
    return out.trim().length >= 0;
  } catch {
    return false;
  }
}

async function runEsQuery(query) {
  // 最基础，限制条数
  const { out } = await runEsRaw(['-n', String(CONFIG.maxResults), query]);
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function defaultSearchItem(raw) {
  return {
    provider: 'fs',
    kind: 'default-search',
    view: 'SearchItem',
    title: `在 Everything 中搜索：${raw}`,
    subtitle: '打开 Everything 结果列表',
    query: raw,
  };
}

function errorItem(msg) {
  return {
    provider: 'fs',
    kind: 'error',
    view: 'LocalItem',
    label: `⚠️ ${msg}`,
    disabled: true,
  };
}

function fileToItem(fullPath) {
  const name = path.basename(fullPath);
  return {
    provider: 'fs',
    kind: 'file',
    view: 'FileItem',
    title: name,
    subtitle: fullPath, // 前端用中间省略展示
    fullPath,
  };
}

/** Provider API: search(content) */
async function search(content) {
  ensureWindows();

  const q = String(content || '').trim();
  if (!q) return { items: [] };

  const items = [defaultSearchItem(q)];

  const es = findEsExe();
  if (!es) {
    items.push(errorItem('未找到 es.exe，请安装 Everything 并将 es.exe 加入 PATH'));
    return { items };
  }

  const ok = await esAvailable();
  if (!ok) {
    items.push(errorItem('Everything 未在运行或未建立索引，请先启动 Everything'));
    return { items };
  }

  try {
    const paths = await runEsQuery(q);
    items.push(...paths.map(fileToItem));
  } catch (e) {
    items.push(errorItem(`查询失败：${e.message}`));
  }

  return { items };
}

/** Provider API: open(item) */
async function open(item) {
  ensureWindows();
  const { shell } = require('electron');

  if (item.kind === 'default-search') {
    const exe = pickExisting(CONFIG.everythingExe);
    if (exe) {
      spawn(exe, ['/search', item.query], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
      return true;
    }
    // 没有 Everything.exe：打开官网
    await shell.openExternal('https://www.voidtools.com/zh-cn/');
    return true;
  }

  if (item.kind === 'file') {
    const action = item.action || 'open';
    if (action === 'reveal') {
      shell.showItemInFolder(item.fullPath);
      return true;
    }
    const r = await shell.openPath(item.fullPath);
    if (r) throw new Error(r); // openPath 返回非空字符串表示错误信息
    return true;
  }

  return false;
}

module.exports = { search, open };

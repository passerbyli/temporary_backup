// services/spotlight/providers/bookmarks.js (CommonJS)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');

const CONFIG = {
  defaultSearchTemplate: 'https://www.google.com/search?q={q}',
  maxBookmarkResults: 9,
};

let index = []; // { title, url, profile }

function chromeRoot() {
  const home = os.homedir();
  if (process.platform === 'win32') return path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome');
  return path.join(home, '.config', 'google-chrome');
}

async function listProfiles() {
  const root = chromeRoot();
  let entries = [];
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch {}
  const out = [];
  for (const d of entries) {
    if (!d.isDirectory()) continue;
    const f = path.join(root, d.name, 'Bookmarks');
    try {
      const st = await fs.promises.stat(f);
      if (st.isFile()) out.push(d.name);
    } catch {}
  }
  out.sort((a, b) => (a === 'Default' ? -1 : b === 'Default' ? 1 : a.localeCompare(b)));
  return out;
}

async function readBookmarksJson(profile) {
  const src = path.join(chromeRoot(), profile, 'Bookmarks');
  const tmp = path.join(os.tmpdir(), `bk_${profile}_${randomUUID()}.json`);
  await fs.promises.copyFile(src, tmp);
  const raw = await fs.promises.readFile(tmp, 'utf8');
  await fs.promises.unlink(tmp).catch(() => {});
  return JSON.parse(raw);
}

function flatten(node, profile, out = []) {
  if (!node) return out;
  const kids = node.children || [];
  for (const c of kids) {
    if (c.type === 'url' && c.url) {
      out.push({ title: c.name || c.url, url: c.url, profile });
    } else if (c.type === 'folder') {
      flatten(c, profile, out);
    }
  }
  return out;
}

async function ensureIndex() {
  if (index.length) return;
  const profiles = await listProfiles();
  const all = [];
  for (const p of profiles) {
    try {
      const j = await readBookmarksJson(p);
      const r = j.roots || {};
      if (r.bookmark_bar) flatten(r.bookmark_bar, p, all);
      if (r.other) flatten(r.other, p, all);
      if (r.synced) flatten(r.synced, p, all);
    } catch {}
  }
  index = all;
}

function score(q, item) {
  const s = q.toLowerCase();
  const n = (item.title || '').toLowerCase();
  const u = (item.url || '').toLowerCase();
  let sc = 0;
  if (n.includes(s)) sc += 2;
  if (u.includes(s)) sc += 1;
  const ni = n.indexOf(s);
  if (ni >= 0) sc += Math.max(0, 1.5 - ni / 20);
  const ui = u.indexOf(s);
  if (ui >= 0) sc += Math.max(0, 1.0 - ui / 40);
  return sc;
}

function findChromeExe() {
  if (process.platform === 'win32') {
    const cands = [
      path.join(
        process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
        'Google',
        'Chrome',
        'Application',
        'chrome.exe',
      ),
      path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['LOCALAPPDATA'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    for (const p of cands) if (p && fs.existsSync(p)) return p;
  } else if (process.platform === 'darwin') {
    const p = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(p)) return p;
  } else {
    const p = '/usr/bin/google-chrome';
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function openInProfile(url, profile = 'Default') {
  const exe = findChromeExe();
  if (!exe) throw new Error('Chrome 未安装');
  const args = [`--profile-directory=${profile}`, url];
  const opts =
    process.platform === 'win32'
      ? { windowsHide: true, detached: true, stdio: 'ignore' }
      : { detached: true, stdio: 'ignore' };
  const child = spawn(exe, args, opts);
  child.unref();
  return true;
}

function defaultSearchItem(qRaw) {
  const url = CONFIG.defaultSearchTemplate.replace('{q}', encodeURIComponent(qRaw.trim()));
  return {
    provider: 'ch',
    kind: 'default-search',
    view: 'SearchItem', // 渲染组件名（前端会映射）
    title: `搜索: ${qRaw}`,
    subtitle: '系统默认浏览器 · 默认搜索引擎',
    url,
  };
}

/** Provider API: search(content) */
async function search(content) {
  await ensureIndex();
  const q = String(content || '').trim();
  if (!q) return { items: [] };

  const head = defaultSearchItem(q);
  const rest = index
    .map((it) => ({ ...it, _s: score(q, it) }))
    .filter((it) => it._s > 0)
    .sort((a, b) => b._s - a._s)
    .slice(0, 9)
    .map((it) => ({
      provider: 'ch',
      kind: 'bookmark',
      view: 'BookmarkItem', // 使用另一种样式
      title: it.title,
      subtitle: `${it.url} · ${it.profile}`,
      url: it.url,
      profile: it.profile,
    }));

  return { items: [head, ...rest] };
}

/** Provider API: open(item) */
async function open(item) {
  if (item.kind === 'default-search') {
    const { shell } = require('electron');
    await shell.openExternal(item.url);
    return true;
  }
  if (item.kind === 'bookmark') {
    return openInProfile(item.url, item.profile || 'Default');
  }
  return false;
}

module.exports = { search, open };

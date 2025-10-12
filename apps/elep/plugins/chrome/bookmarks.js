const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');

const CONFIG = {
  // 默认搜索引擎模板，可换为你的设置中心读取：{q} 会被替换为关键词（已URL编码）
  defaultSearchTemplate: 'https://www.google.com/search?q={q}',
  // 书签最多返回 9 条（加上第一条“默认搜索”，总 10 条）
  maxBookmarkResults: 9,
  // 索引哪些 profile；为空则自动发现（推荐自动）
  profiles: [],
};

let bookmarkIndex = []; // { title, url, profile, score? }
let profilesCached = [];

// --- 1) 各平台 Chrome 用户数据根目录（稳定版） ---
function chromeUserDataRoot() {
  const home = os.homedir();
  switch (process.platform) {
    case 'win32':
      return path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome');
    case 'linux':
      return path.join(home, '.config', 'google-chrome');
    default:
      throw new Error('Unsupported OS');
  }
}

// --- 2) 列出可用的 Profiles（存在 Bookmarks 文件）---
async function listProfiles() {
  const root = chromeUserDataRoot();
  const dirs = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => []);
  const profiles = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const name = d.name; // e.g. "Default", "Profile 1"
    const p = path.join(root, name, 'Bookmarks');
    try {
      const stat = await fs.promises.stat(p);
      if (stat.isFile()) profiles.push(name);
    } catch {}
  }
  // 默认优先
  profiles.sort((a, b) => (a === 'Default' ? -1 : b === 'Default' ? 1 : a.localeCompare(b)));
  return profiles;
}

// --- 3) 读取并解析书签文件：复制到临时文件避免锁 ---
async function readBookmarksJson(profileName) {
  const src = path.join(chromeUserDataRoot(), profileName, 'Bookmarks');
  const tmp = path.join(os.tmpdir(), `chrome_bookmarks_${profileName}_${randomUUID()}.json`);
  await fs.promises.copyFile(src, tmp);
  const raw = await fs.promises.readFile(tmp, 'utf8');
  await fs.promises.unlink(tmp).catch(() => {});
  return JSON.parse(raw);
}

// --- 4) 将 Chrome JSON 转为树结构 ---
function toTree(node) {
  // 只处理包含 children 的节点
  if (!node) return [];
  const out = [];

  const children = node.children || [];
  for (const c of children) {
    if (c.type === 'url') {
      out.push({
        id: c.id,
        label: c.name || c.url,
        url: c.url,
        type: 'url',
      });
    } else if (c.type === 'folder') {
      out.push({
        id: c.id,
        label: c.name || 'Folder',
        type: 'folder',
        children: toTree(c), // 递归
      });
    }
  }
  return out;
}

// --- 5) 对外：加载指定 Profile 的 “书签栏 + 其他书签 + 已同步书签” ---
async function loadBookmarksTree(profileName = 'Default') {
  const json = await readBookmarksJson(profileName);

  const roots = json.roots || {};
  const sections = [];

  if (roots.bookmark_bar) {
    sections.push({
      id: 'bookmark_bar',
      label: '书签栏',
      type: 'folder',
      children: toTree(roots.bookmark_bar),
    });
  }
  if (roots.other) {
    sections.push({
      id: 'other',
      label: '其他书签',
      type: 'folder',
      children: toTree(roots.other),
    });
  }
  if (roots.synced) {
    sections.push({
      id: 'synced',
      label: '已同步书签',
      type: 'folder',
      children: toTree(roots.synced),
    });
  }
  return { profile: profileName, tree: sections };
}

function flatten(node, profile, out = []) {
  if (!node) return out;
  const children = node.children || [];
  for (const c of children) {
    if (c.type === 'url' && c.url) {
      out.push({ title: c.name || c.url, url: c.url, profile });
    } else if (c.type === 'folder') {
      flatten(c, profile, out);
    }
  }
  return out;
}

async function buildIndex() {
  const profiles = CONFIG.profiles.length ? CONFIG.profiles : await listProfiles();
  profilesCached = profiles;
  const all = [];
  for (const p of profiles) {
    try {
      const json = await readBookmarksJson(p);
      const roots = json.roots || {};
      if (roots.bookmark_bar) flatten(roots.bookmark_bar, p, all);
      if (roots.other) flatten(roots.other, p, all);
      if (roots.synced) flatten(roots.synced, p, all);
    } catch (e) {
      // 忽略单个 profile 的错误
    }
  }
  bookmarkIndex = all;
}

function scoreMatch(q, item) {
  // 简单得分：名称包含 + URL 包含
  const s = q.toLowerCase();
  const name = (item.title || '').toLowerCase();
  const url = (item.url || '').toLowerCase();
  let score = 0;
  if (name.includes(s)) score += 2;
  if (url.includes(s)) score += 1;
  // 越靠前加一点分
  const ni = name.indexOf(s);
  if (ni >= 0) score += Math.max(0, 1.5 - ni / 20);
  const ui = url.indexOf(s);
  if (ui >= 0) score += Math.max(0, 1.0 - ui / 40);
  return score;
}

function buildDefaultSearchItem(rawQ) {
  const q = encodeURIComponent(rawQ.trim());
  const url = CONFIG.defaultSearchTemplate.replace('{q}', q);
  // 第一条：默认搜索（系统默认浏览器）
  return {
    kind: 'default-search',
    title: `搜索: ${rawQ}`,
    subtitle: '使用系统默认浏览器的搜索（模板可配置）',
    url,
  };
}

function findChromeExecutable() {
  if (process.platform === 'win32') {
    const candidates = [
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
    for (const p of candidates) {
      if (p && fs.existsSync(p)) return p;
    }
  } else if (process.platform === 'darwin') {
    const p = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(p)) return p;
  } else {
    const p = '/usr/bin/google-chrome';
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function openInChromeProfile(url, profileName = 'Default') {
  const exe = findChromeExecutable();
  if (!exe) throw new Error('未找到 Chrome 可执行文件');
  const args = [`--profile-directory=${profileName}`, url];
  // Windows 下避免弹出黑框
  const opts =
    process.platform === 'win32'
      ? { windowsHide: true, detached: true, stdio: 'ignore' }
      : { detached: true, stdio: 'ignore' };
  const child = spawn(exe, args, opts);
  child.unref();
  return true;
}

function openExternal(url) {
  // 不指定浏览器 → 由系统默认浏览器打开
  const { shell } = require('electron');
  return shell.openExternal(url);
}

/** 初始化/重建索引 */
async function init(force = false) {
  if (force || bookmarkIndex.length === 0) {
    await buildIndex();
  }
}

/** Spotlight 搜索：输入必须以 "ch " 开头；返回最多 10 条（1 条默认搜索 + 9 条书签） */
async function search(inputText) {
  console.log('inputText', inputText);
  inputText = String(inputText || '');
  if (!/^ch\s+/i.test(inputText)) return []; // 非触发指令，返回空
  const rawQ = inputText.replace(/^ch\s+/i, '').trim();
  if (!rawQ) return [];
  console.log('inputText:rawQ', rawQ);

  // 第一条：默认搜索
  const items = [buildDefaultSearchItem(rawQ)];

  // 模糊书签
  const scored = bookmarkIndex
    .map((it) => ({ ...it, _score: scoreMatch(rawQ, it) }))
    .filter((it) => it._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, CONFIG.maxBookmarkResults)
    .map((it) => ({
      kind: 'bookmark',
      title: it.title,
      subtitle: `${it.url}   ·   ${it.profile}`,
      url: it.url,
      profile: it.profile,
    }));

  let arr = items.concat(scored);
  console.log('arr', arr[0]);
  return arr;
}

/** 打开项 */
async function open(item) {
  if (!item) return false;
  if (item.kind === 'default-search') {
    return openExternal(item.url);
  } else if (item.kind === 'bookmark') {
    return openInChromeProfile(item.url, item.profile || 'Default');
  }
  return false;
}

module.exports = { listProfiles, loadBookmarksTree, init, search, open };

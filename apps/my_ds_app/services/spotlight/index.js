// services/spotlight/index.js
const bookmarksProvider = require('./providers/bookmarks'); // ch
const githubProvider = require('./providers/github'); // gh
const filesProvider = require('./providers/files'); // fs
const cmdProvider = require('./providers/cmd'); // cmd

/** 注册表：keyword -> provider */
const registry = {
  ch: bookmarksProvider,
  gh: githubProvider,
  fs: filesProvider,
  cmd: cmdProvider,
};

/** 解析输入，返回 { keyword, content } 或 null（非 provider 模式） */
function parseCommand(input) {
  if (!input) return null;
  const m = String(input).match(/^\s*([a-zA-Z]{1,8})\s+(.+)$/);
  if (!m) return null;
  return { keyword: m[1].toLowerCase(), content: m[2].trim() };
}

/** 统一查询入口 */
async function query(input, filterProfile = '') {
  // 特殊处理：ch:profiles 返回用户列表
  if (input === 'ch:profiles') {
    const profiles = await bookmarksProvider.getProfiles();
    return { profiles, mode: 'profiles' };
  }
  
  const parsed = parseCommand(input);
  if (!parsed) return { items: [], mode: 'local' }; // 返回 local 模式，前端走你原来的本地过滤
  const provider = registry[parsed.keyword];
  if (!provider || !provider.search) {
    return { items: [], mode: 'unknown' };
  }
  // Provider 约定：返回 { items: SpotlightItem[], meta? }
  // 对于 ch（bookmarks）provider，传递 filterProfile 参数
  const result = parsed.keyword === 'ch' 
    ? await provider.search(parsed.content, filterProfile)
    : await provider.search(parsed.content);
  return { ...result, mode: parsed.keyword };
}

/** 统一执行入口 */
async function open(item) {
  if (!item || !item.provider) return false;
  const provider = registry[item.provider];
  if (!provider || !provider.open) return false;
  return await provider.open(item);
}

module.exports = {
  query,
  open,
  parseCommand,
  registry,
};

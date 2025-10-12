// services/spotlight/providers/github.js
const https = require('https');

const CONFIG = {
  perPage: 9, // 除了第一条“默认搜索”，再列出 9 条仓库
  searchSort: 'stars', // stars | best match(默认)
};

function githubSearchUrl(q) {
  const qp = new URLSearchParams({
    q,
    per_page: String(CONFIG.perPage),
    sort: CONFIG.searchSort,
    order: 'desc',
  });
  return `https://api.github.com/search/repositories?${qp.toString()}`;
}

function getJSON(url) {
  const headers = {
    'User-Agent': 'Spotlight-GitHub-Search',
    Accept: 'application/vnd.github+json',
  };
  // 可选：提高速率限制
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              // 失败时也返回一个结构，避免前端空白
              resolve({ items: [], error: json?.message || `HTTP ${res.statusCode}` });
            }
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function defaultSearchItem(qRaw) {
  return {
    provider: 'gh',
    kind: 'default-search',
    view: 'SearchItem',
    title: `在 GitHub 中搜索：${qRaw}`,
    subtitle: '系统默认浏览器打开 · github.com',
    url: `https://github.com/search?q=${encodeURIComponent(qRaw.trim())}`,
  };
}

function toGitHubItem(repo) {
  const title = `${repo.full_name || repo.name || ''}`;
  const lang = repo.language || 'Unknown';
  const stars = repo.stargazers_count ?? 0;
  const desc = (repo.description || '').replace(/\s+/g, ' ').trim();
  const sub = `★ ${stars} · ${lang}${desc ? ' · ' + (desc.length > 80 ? desc.slice(0, 77) + '…' : desc) : ''}`;

  return {
    provider: 'gh',
    kind: 'repo',
    view: 'GitHubItem',
    title,
    subtitle: sub,
    url: repo.html_url,
  };
}

/** Provider API: search(content) */
async function search(content) {
  const q = String(content || '').trim();
  if (!q) return { items: [] };

  const head = defaultSearchItem(q);
  let repos = [];
  try {
    const json = await getJSON(githubSearchUrl(q));
    repos = Array.isArray(json.items) ? json.items : [];
  } catch (_) {
    repos = [];
  }

  const items = [head, ...repos.map(toGitHubItem)];
  return { items };
}

/** Provider API: open(item) */
async function open(item) {
  const { shell } = require('electron');
  if (item?.url) {
    await shell.openExternal(item.url);
    return true;
  }
  return false;
}

module.exports = { search, open };

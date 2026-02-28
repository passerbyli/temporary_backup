// services/pageMap.js
let dict = null; // { [pageCode]: menuId }
let inflight = null; // Promise

async function fetchAllRows() {
  const res = await fetch('/api/pageCode-menu-map');
  if (!res.ok) throw new Error('map api failed');
  return await res.json(); // 全量数据集
}

function buildDict(rows) {
  const d = {};
  (rows || []).forEach((r) => {
    const pageCode = String(r.pageCode ?? '');
    if (!pageCode) return;
    d[pageCode] = String(r.menuId);
  });
  return d;
}

export function ensureLoaded() {
  if (dict) return Promise.resolve(dict);

  if (!inflight) {
    inflight = fetchAllRows()
      .then(buildDict)
      .then((d) => {
        dict = d;
        return d;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export async function getMenuId(pageCode) {
  const d = await ensureLoaded();
  return d[String(pageCode)];
}

export function preload() {
  // 预拉：不 await，失败也别让应用崩
  ensureLoaded().catch(() => {});
}

<template>
  <div class="spotlight-box">
    <div class="input-wrapper">
      <span class="icon">🔍{{ sListHeight }}</span>
      <input
        ref="searchInput"
        v-model="query"
        class="spotlight-input"
        placeholder="搜索或输入命令…（如 ch 关键字 搜书签）"
        @keydown.enter="execute"
      />
    </div>

    <ul class="result-list">
      <li
        v-for="(item, i) in renderList"
        :key="i"
        :class="['result-item', { active: i === selected, disabled: item.disabled }]"
        @click="!item.disabled && run(item)"
      >
        <component :is="componentFor(item)" :item="item" />
      </li>

      <li v-if="renderList.length === 0 && query.length > 0" class="result-item disabled">没有找到相关结果</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, h, nextTick } from 'vue';

// —— 原有本地命令 —— //
const localItems = ref([
  { label: '打开设置', type: 'local_route', command: 'setting' },
  { label: '关于', type: 'local_route', command: 'about' },
  { label: '退出应用', type: 'local_sys', command: 'quit' },
]);

// —— Spotlight 远端结果 —— //
const remoteMode = ref('local'); // 'local' | keyword | 'unknown'
const remoteItems = ref([]); // provider 返回的 items（含 view / provider / title / subtitle 等）
const sListHeight = ref(0);
// 输入与选中
const query = ref('');
const selected = ref(0);
const searchInput = ref(null);
let timer = null;

// —— 渲染数据汇总 —— //
const renderList = computed(() => {
  if (remoteMode.value === 'local') {
    return localItems.value.filter((i) => i.label.includes(query.value)).map((i) => ({ view: 'LocalItem', ...i }));
  }
  return remoteItems.value;
});

/** 中间省略：把长串压成 head + … + tail */
function middleEllipsis(str = '', max = 68) {
  const s = String(str);
  if (s.length <= max) return s;
  const keep = Math.max(1, Math.floor((max - 1) / 2));
  return s.slice(0, keep) + '…' + s.slice(-keep);
}
const MiniBtn = (label, onClick) =>
  h(
    'button',
    {
      class: 'mini-btn',
      onClick: (e) => {
        e.stopPropagation();
        onClick(e);
      },
    },
    label,
  );

/** LocalItem：单行 */
const LocalItem = (props) =>
  h('div', { class: 'one-line', title: props.item.label }, [h('span', { class: 'li-title' }, props.item.label)]);

/** SearchItem：第一条（默认搜索）——单行 */
const SearchItem = (props) =>
  h('div', { class: 'one-line', title: `${props.item.title}   ${props.item.subtitle || ''}` }, [
    h('span', { class: 'si-icon' }, '🔎'),
    h('span', { class: 'si-title' }, props.item.title || ''),
    props.item.subtitle ? h('span', { class: 'si-sub' }, props.item.subtitle) : null,
  ]);

/** BookmarkItem：两行（标题 + URL(中间省略)）*/
const BookmarkItem = (props) => {
  const title = props.item.title || '';
  // 兼容之前 provider 的 subtitle 形如 “https://... · Profile” 的情况，只取 URL 部分
  let url = props.item.subtitle || '';
  const dot = url.indexOf(' · ');
  if (dot > 0) url = url.slice(0, dot);
  return h('div', { class: 'bi' }, [
    h('div', { class: 'bi-title', title }, ['🔗 ', title]),
    h('div', { class: 'bi-url', title: url }, middleEllipsis(url, 80)),
  ]);
};

/** GitHubItem：两行
 *  第一行：图标 + 仓库名 + 小徽章区（星数/语言）
 *  第二行：描述（单行省略）
 */
const GitHubItem = (props) => {
  const t = props.item.title || ''; // owner/repo
  const sub = props.item.subtitle || ''; // “★ 1234 · TS · desc”
  const m = sub.match(/^★\s*([\d,._]+)\s*·\s*([^\s·]+)(?:\s*·\s*(.*))?$/);
  const stars = m ? m[1] : '';
  const lang = m ? m[2] : '';
  const desc = m ? m[3] || '' : sub;

  return h('div', { class: 'gh' }, [
    h('div', { class: 'gh-top', title: t }, [
      h('span', { class: 'gh-icon' }, '🐙'),
      h('span', { class: 'gh-title' }, t),
      h('span', { class: 'gh-badges' }, [
        stars ? h('span', { class: 'gh-badge' }, `★ ${stars}`) : null,
        lang ? h('span', { class: 'gh-badge gh-lang' }, lang) : null,
      ]),
    ]),
    h('div', { class: 'gh-desc', title: desc }, desc),
  ]);
};
/** FileItem：两行（文件名 + 路径中间省略）+ 右侧小按钮 */
const FileItem = (props) => {
  const title = props.item.title || '';
  const full = props.item.subtitle || ''; // fullPath
  return h('div', { class: 'fi' }, [
    h('div', { class: 'fi-top' }, [
      h('span', { class: 'fi-icon' }, '📄'),
      h('span', { class: 'fi-title', title }, title),
      h('span', { class: 'fi-actions' }, [
        MiniBtn('打开', () => window.spotlightApi.open({ ...props.item, action: 'open' })),
        MiniBtn('位置', () => window.spotlightApi.open({ ...props.item, action: 'reveal' })),
      ]),
    ]),
    h('div', { class: 'fi-path', title: full }, middleEllipsis(full, 80)),
  ]);
};

const CmdItem = (props) =>
  h('div', { class: 'cmd' }, [
    h('div', { class: 'cmd-title', title: props.item.title }, ['⚡ ', props.item.title]),
    h('div', { class: 'cmd-actions' }, [
      MiniBtn('运行', () => window.spotlightApi.open({ ...props.item, action: 'run' })),
      MiniBtn('终端', () => window.spotlightApi.open({ ...props.item, action: 'terminal' })),
      MiniBtn('复制', () => window.spotlightApi.open({ ...props.item, action: 'copy' })),
    ]),
  ]);

const componentMap = { LocalItem, SearchItem, BookmarkItem, GitHubItem, FileItem, CmdItem };
function componentFor(item) {
  return componentMap[item.view] || LocalItem;
}

// —— 执行 —— //
async function run(item) {
  // 本地命令
  if (item.view === 'LocalItem') {
    window.spotlightApi.executeCommand(item.type, item.command);
    await window.spotlightApi.hide();
    return;
  }
  // Provider 返回项
  await window.spotlightApi.open(item);
  await window.spotlightApi.hide();
}

function execute() {
  if (!renderList.value.length) return;
  const it = renderList.value[selected.value];

  // CmdItem：回车默认打开终端
  if (it.view === 'CmdItem') {
    window.spotlightApi.open({ ...it, action: 'terminal' });
    window.spotlightApi.hide();
    return;
  }

  // 其他类型沿用原逻辑
  run(it);
}

// —— 输入监听：有 keyword+空格 则走远端查询；否则 local 模式 —— //
watch(
  () => query.value,
  (val) => {
    selected.value = 0;
    clearTimeout(timer);
    // 是否为 <keyword><空格><内容>
    if (/^\s*[a-zA-Z]{1,8}\s+.+/.test(val)) {
      timer = setTimeout(async () => {
        const res = (await window.spotlightApi.query(val)) || {};
        remoteMode.value = res.mode || 'unknown';
        remoteItems.value = Array.isArray(res.items) ? res.items : [];
      }, 160);
    } else {
      remoteMode.value = 'local';
      remoteItems.value = [];
    }
  },
);

/** —— 选中项滚动进视区（可选增强） —— */
watch(
  () => selected.value,
  async () => {
    await nextTick();
    const list = document.querySelector('.result-list');
    const act = document.querySelector('.result-item.active');
    if (!list || !act) return;
    const top = act.offsetTop;
    const bottom = top + act.offsetHeight;
    const vTop = list.scrollTop;
    const vBottom = vTop + list.clientHeight;
    if (top < vTop) list.scrollTop = top;
    else if (bottom > vBottom) list.scrollTop = bottom - list.clientHeight;
  },
);

// —— 维持你原来的高度自适应逻辑 —— //
watch([renderList, query], ([list, q]) => {
  const baseHeight = 70;
  const itemHeight = 48; // 和 .result-item 的高度一致
  const maxListHeight = 400;
  let listHeight = 0;
  if (list.length > 0) listHeight = Math.min(list.length * itemHeight, maxListHeight);
  else if (q.length > 0) listHeight = itemHeight;

  sListHeight.value = listHeight;
  window.spotlightApi.resizeWindow(baseHeight + listHeight);
});

// 键盘导航/聚焦
onMounted(() => {
  window.addEventListener('focus', () => {
    searchInput.value && searchInput.value.focus();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.spotlightApi.hide();
    if (e.key === 'ArrowDown' && renderList.value.length) {
      selected.value = (selected.value + 1) % renderList.value.length;
      e.preventDefault();
    }
    if (e.key === 'ArrowUp' && renderList.value.length) {
      selected.value = (selected.value - 1 + renderList.value.length) % renderList.value.length;
      e.preventDefault();
    }
  });
});
</script>

<style scoped>
/* 保留你的样式（略），不再重复 */
.spotlight-box {
  width: 600px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  padding: 12px;
}

.input-wrapper {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.icon {
  margin-right: 10px;
  font-size: 18px;
  color: #666;
}

/* 列表：仅纵向滚动 */
.result-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
  /* 禁止横向滚动条 */
}

/* 每项：固定40px，内容容器自己做两行布局；隐藏溢出避免遮挡 */
.result-item {
  height: 40px;
  /* 统一40px */
  padding: 4px 10px;
  /* 竖向小一点，塞下两行 */
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.18s;
  display: flex;
  align-items: center;
  overflow: hidden;
  /* 防止内容挤出横向滚动 */
}

.result-item:hover,
.result-item.active {
  background: rgba(0, 120, 255, 0.1);
}

.result-item.disabled {
  color: #aaa;
  cursor: default;
  pointer-events: none;
}

/* 单行容器（Local/Search第一行） */
.one-line {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.li-title {
  font-weight: 600;
  color: #111;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* —— SearchItem —— */
.si-icon {
  width: 18px;
  text-align: center;
  opacity: 0.9;
  flex: 0 0 auto;
}

.si-title {
  font-weight: 600;
  color: #111;
  overflow: hidden;
  text-overflow: ellipsis;
}

.si-sub {
  color: #8a8f98;
  margin-left: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* —— BookmarkItem：两行（各自单行省略）—— */
.bi {
  display: grid;
  grid-template-rows: 1fr 1fr;
  /* 两行 */
  row-gap: 0px;
  /* 40px布局要紧凑 */
  width: 100%;
  min-width: 0;
}

.bi-title {
  line-height: 18px;
  /* 两行 = 18 + 18 + padding(4+4) ≈ 40 */
  font-weight: 600;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bi-url {
  line-height: 18px;
  color: #6b7280;
  white-space: nowrap;
  /* 我们输出的是中间省略文本，不要再尾省略 */
  overflow: hidden;
}

/* —— GitHubItem：两行（标题行 + 描述行）—— */
.gh {
  display: grid;
  grid-template-rows: 1fr 1fr;
  row-gap: 0px;
  width: 100%;
  min-width: 0;
}

.gh-top {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  /* 图标 | 标题 | 徽章 */
  column-gap: 6px;
  align-items: center;
  min-width: 0;
  line-height: 18px;
}

.gh-icon {
  text-align: center;
  opacity: 0.9;
}

.gh-title {
  font-weight: 600;
  color: #111;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gh-badges {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  overflow: hidden;
}

.gh-badge {
  font-size: 12px;
  padding: 0 6px;
  line-height: 16px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #eef2ff;
  color: #374151;
  white-space: nowrap;
  user-select: none;
}

.gh-badge.gh-lang {
  background: #ecfeff;
}

.gh-desc {
  line-height: 18px;
  color: #6b7280;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 输入框，避免横向滚动 */
.spotlight-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 16px;
  line-height: 20px;
  padding: 6px 0;
  overflow: hidden;
}
/* —— FileItem —— */
.fi {
  display: grid;
  grid-template-rows: 1fr 1fr; /* 两行 */
  width: 100%;
  min-width: 0;
  row-gap: 0;
}

.fi-top {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto; /* 图标 | 标题 | 按钮区 */
  column-gap: 6px;
  align-items: center;
  line-height: 18px;
  min-width: 0;
}

.fi-icon {
  text-align: center;
  opacity: 0.9;
}

.fi-title {
  font-weight: 600;
  color: #111;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.fi-actions {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.mini-btn {
  font-size: 11px;
  padding: 0 6px;
  line-height: 16px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  white-space: nowrap;
  cursor: pointer;
}
.mini-btn:hover {
  background: #f3f4f6;
}

.fi-path {
  line-height: 18px;
  color: #6b7280;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: clip; /* 我们自己做中间省略 */
}

/* CmdItem：单行，左右分栏 */
.cmd {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto; /* 标题 | 按钮组 */
  align-items: center;
  width: 100%;
  min-width: 0;
  column-gap: 8px;
}
.cmd-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 600;
  color: #111;
}
.cmd-actions {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
</style>

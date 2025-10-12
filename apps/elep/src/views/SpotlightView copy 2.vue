<template>
  <div class="spotlight-box">
    <div class="input-wrapper">
      <span class="icon">🔍</span>
      <input
        ref="searchInput"
        v-model="query"
        class="spotlight-input"
        placeholder="搜索或输入命令…（输入 ch 空格 开启书签搜索）"
        @keydown.enter="execute"
      />
    </div>

    <ul class="result-list">
      <li
        v-for="(item, i) in filtered"
        :key="i"
        :class="['result-item', { active: i === selected, disabled: item.disabled }]"
        @click="!item.disabled && run(item)"
      >
        {{ item.label }}
      </li>

      <li v-if="filtered.length === 0 && query.length > 0" class="result-item disabled">没有找到相关结果</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';

const searchInput = ref(null);
const query = ref('');
const selected = ref(0);

// —— 原有本地命令 —— //
const localItems = ref([
  { label: '打开设置', type: 'local_route', command: 'setting' },
  { label: '关于', type: 'local_route', command: 'about' },
  { label: '退出应用', type: 'local_sys', command: 'quit' },
]);

// —— 书签模式数据（从主进程 IPC 拉取）—— //
const bookmarkResults = ref([]); // 结构：[{kind, title/subtitle/url/profile}…] → 这里转成 {label, _raw}
let debounceTimer = null;

// 识别是否书签模式：以 ch␣ 开头
const isBookmarkMode = computed(() => /^ch\s+/i.test(query.value));

// 统一的渲染数据：书签模式用 bookmarkResults；非书签模式用本地命令过滤
const filtered = computed(() => {
  if (isBookmarkMode.value) {
    return bookmarkResults.value;
  }
  // 原有逻辑：模糊匹配本地命令
  return localItems.value.filter((i) => i.label.includes(query.value));
});

/** 执行“打开/运行” */
async function run(item) {
  if (!item || item.disabled) return;
  // 书签模式：交给主进程 open（第一条默认搜索；其它是书签）
  if (isBookmarkMode.value && item._raw) {
    await window.spotlightApi.open(item._raw); // <- 返回 Promise
    await window.spotlightApi.hide();
    return;
  }
  // 本地命令模式：沿用你原来的执行接口
  window.spotlightApi.executeCommand(item.type, item.command);
  window.spotlightApi.hide();
}

/** Enter：默认执行当前选中项（优先第一条） */
function execute() {
  if (!filtered.value.length) return;
  run(filtered.value[selected.value]);
}

/** 拉取书签：防抖 + 兜底 */
async function searchBookmarksSafely(text) {
  try {
    const res = await window.spotlightApi.search(text); // 需确保 preload/main return 了 Promise
    // 期望 res 是数组：[{kind:'default-search'|'bookmark', title, subtitle, url, profile}, ...]
    const list = Array.isArray(res) ? res : [];
    bookmarkResults.value = list.map((it, idx) => ({
      // UI 展示 label：第一条默认搜索在最上面
      label: it.kind === 'default-search' ? `🔎 ${it.title}` : `🔗 ${it.title}    ｜ ${it.subtitle || ''}`,
      _raw: it, // 原始对象，用于回传给 window.spotlightApi.open
      disabled: false,
      // 下面两个字段只在“本地命令模式”用到，这里给占位以统一结构
      type: 'bookmark',
      command: '',
    }));
  } catch (e) {
    console.error('spotlight search error:', e);
    bookmarkResults.value = [];
  } finally {
    selected.value = 0;
  }
}

/** 输入变化时：书签模式发起异步搜索；普通模式只做前端过滤 */
watch(
  () => query.value,
  (val) => {
    // 重置选中
    selected.value = 0;

    // 书签模式：防抖 180ms 拉取
    if (isBookmarkMode.value) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchBookmarksSafely(val);
      }, 180);
    } else {
      // 退出书签模式时清空结果
      bookmarkResults.value = [];
    }
  },
);

// 监听结果数量变化，动态调整窗口高度（原有逻辑保留）
watch([filtered, query], ([list, q]) => {
  const baseHeight = 70;
  const itemHeight = 40;
  const maxListHeight = 400;

  let listHeight = 0;
  if (list.length > 0) {
    listHeight = Math.min(list.length * itemHeight, maxListHeight);
  } else if (q.length > 0) {
    listHeight = itemHeight; // 保证“没有找到相关结果”能显示
  }

  const newHeight = baseHeight + listHeight;
  window.spotlightApi.resizeWindow(newHeight);
});

// 键盘导航（上下选择、ESC 关闭、窗口聚焦自动聚焦输入）
onMounted(() => {
  window.addEventListener('focus', () => {
    searchInput.value && searchInput.value.focus();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.spotlightApi.hide();

    if (e.key === 'ArrowDown' && filtered.value.length) {
      selected.value = (selected.value + 1) % filtered.value.length;
      e.preventDefault();
    }
    if (e.key === 'ArrowUp' && filtered.value.length) {
      selected.value = (selected.value - 1 + filtered.value.length) % filtered.value.length;
      e.preventDefault();
    }
  });
});
</script>

<style scoped>
.spotlight-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: start;
  padding-top: 15vh;
  background: rgba(0, 0, 0, 0.2);
}

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

.spotlight-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 18px;
  padding: 6px 0;
}

.result-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  height: 28px;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
}

.result-item:hover,
.result-item.active {
  background: rgba(0, 120, 255, 0.15);
}

.result-item.disabled {
  color: #aaa;
  cursor: default;
  pointer-events: none;
}
</style>

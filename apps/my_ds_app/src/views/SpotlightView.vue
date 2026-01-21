<template>

  <div class="spotlight-box">
    <div class="input-wrapper">
      <span class="icon">
        <el-icon>
          <Search />
        </el-icon>
      </span>
      <input ref="searchInput" v-model="query" class="spotlight-input" placeholder="搜索路由或命令…（如 ch 关键字 搜书签）"
        @keydown.enter="execute" />
    </div>
    <!-- Chrome 用户过滤按钮 -->
    <div v-if="mod === 'ch' && chromeProfiles.length > 0" class="profile-filters">
      <button :class="['profile-btn', { active: selectedProfile === '' }]"
        @click="selectedProfile = ''; refreshQuery()">
        全部
      </button>
      <button v-for="profile in chromeProfiles" :key="profile.dirName"
        :class="['profile-btn', { active: selectedProfile === profile.dirName }]"
        @click="selectedProfile = profile.dirName; refreshQuery()">
        {{ profile.displayName }}
      </button>
    </div>

    <!-- 动态组件展示区域 -->
    <div v-if="activeComponent" class="dynamic-component-container">
      <component :is="activeComponent.component" :query="query" />
    </div>

    <ul class="result-list">
      <li v-for="(item, i) in renderList" :key="i"
        :class="['result-item', { active: i === selected, disabled: item.disabled }]"
        @click="!item.disabled && run(item)">
        <component :is="componentFor(item)" :item="item" />
      </li>
      <li v-if="renderList.length === 0 && query.length > 0 && !activeComponent" class="result-item disabled">
        没有找到相关结果
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { Search } from '@element-plus/icons-vue'
import router from '../router/index';
import LocalItem from '../components/Spotlight/LocalItem.vue';
import SearchItem from '../components/Spotlight/SearchItem.vue';
import BookmarkItem from '../components/Spotlight/BookmarkItem.vue';
import GitHubItem from '../components/Spotlight/GitHubItem.vue';
import FileItem from '../components/Spotlight/FileItem.vue';
import CmdItem from '../components/Spotlight/CmdItem.vue';
import { findMatchingComponent } from '../components/Spotlight/componentManager';

// —— 动态组件管理 —— //
const activeComponent = ref(null);

// —— 自定义系统命令 —— //
const customSysCommands = ref([
  { label: 'IP信息', type: 'local_sys', command: 'ip' },
  { label: '退出应用', type: 'local_sys', command: 'quit' },
]);

// —— 从路由配置提取可搜索的路由 —— //
function getSearchableRoutes() {
  return router.getRoutes()
    .filter(route => route.meta?.display === true)
    .map(route => ({
      label: route.meta?.title || route.name || route.path,
      type: 'local_route',
      command: route.name || route.path,
      path: route.path,
      name: route.name,
      searchText: `${route.meta?.title || route.name || route.path}${route.path}`.toLowerCase()
    }));
}

// —— Spotlight 远端结果 —— //
const remoteMode = ref('local'); // 'local' | keyword | 'unknown'
const remoteItems = ref([]); // provider 返回的 items（含 view / provider / title / subtitle 等）
const sListHeight = ref(0);
const mod = ref(''); // 当前模式标识
// 输入与选中
const query = ref('');
const selected = ref(0);
const searchInput = ref(null);
let timer = null;

// —— Chrome 用户过滤 —— //
const chromeProfiles = ref([]); // Chrome 用户列表
const selectedProfile = ref(''); // 当前选中的用户，空字符串表示"全部"

// —— 渲染数据汇总 —— //
const renderList = computed(() => {
  if (remoteMode.value === 'local') {
    // 本地模式：搜索路由和自定义命令
    const searchQuery = query.value.toLowerCase().trim();
    const searchableRoutes = getSearchableRoutes();

    if (!searchQuery) {
      return [];
    }

    // 先搜索路由
    const routeResults = searchableRoutes
      .filter(route => route.searchText.includes(searchQuery))
      .map(route => ({ view: 'LocalItem', ...route }));

    // 再搜索自定义命令
    const commandResults = customSysCommands.value
      .filter(cmd => cmd.label.toLowerCase().includes(searchQuery))
      .map(cmd => ({ view: 'LocalItem', ...cmd }));

    return [...routeResults, ...commandResults];
  }
  return remoteItems.value;
});

const componentMap = { LocalItem, SearchItem, BookmarkItem, GitHubItem, FileItem, CmdItem };
function componentFor(item) {
  const componentName = item.view || 'LocalItem';
  return componentMap[componentName] || LocalItem;
}

// —— 执行 —— //
async function run(item) {
  // 本地命令
  if (item.view === 'LocalItem') {
    console.log('run local item', item);
    window.spotlightApi.executeCommand(item.type, item.command);
    await window.spotlightApi.hide();
    return;
  }
  // Provider 返回项
  // 创建只包含必要属性的可序列化对象
  const serializableItem = {
    provider: item.provider,
    kind: item.kind,
    view: item.view,
    title: item.title,
    subtitle: item.subtitle,
    url: item.url,
    profile: item.profile,
    fullPath: item.fullPath,
    query: item.query,
    action: item.action
  };
  await window.spotlightApi.open(serializableItem);
  await window.spotlightApi.hide();
}

function execute() {
  if (!renderList.value.length) return;
  const it = renderList.value[selected.value];

  // CmdItem：回车默认打开终端
  if (it.view === 'CmdItem') {
    // 创建只包含必要属性的可序列化对象
    const serializableItem = {
      provider: it.provider,
      kind: it.kind,
      view: it.view,
      title: it.title,
      action: 'terminal'
    };
    window.spotlightApi.open(serializableItem);
    window.spotlightApi.hide();
    return;
  }

  // 其他类型沿用原逻辑
  run(it);
}

// —— 获取 Chrome 用户列表 —— //
async function loadChromeProfiles() {
  try {
    const res = (await window.spotlightApi.query('ch:profiles')) || {};
    chromeProfiles.value = Array.isArray(res.profiles) ? res.profiles : [];
  } catch (err) {
    console.error('Failed to load Chrome profiles:', err);
  }
}

function init() {
  query.value = ''
}

// —— 刷新查询（用于用户过滤） —— //
function refreshQuery() {
  const val = query.value;
  if (!/^\s*[a-zA-Z]{1,8}\s+.+/.test(val)) return;

  selected.value = 0;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const res = (await window.spotlightApi.query(val, selectedProfile.value)) || {};
    remoteMode.value = res.mode || 'unknown';
    remoteItems.value = Array.isArray(res.items) ? res.items : [];
    mod.value = res.mode || '';
  }, 160);
}

// —— 输入监听：有 keyword+空格 则走远端查询；否则 local 模式 —— //
watch(
  () => query.value,
  (val) => {
    selected.value = 0;
    clearTimeout(timer);
    // 检查是否匹配组件
    const lowerVal = val.toLowerCase().trim();
    const matchingComponent = findMatchingComponent(lowerVal);
    if (matchingComponent) {
      activeComponent.value = matchingComponent;
      remoteMode.value = 'local';
      remoteItems.value = [];
      mod.value = '';
    } else {
      activeComponent.value = null;
      // 是否为 <keyword><空格><内容>
      if (/^\s*[a-zA-Z]{1,8}\s+.+/.test(val)) {
        // 如果是 ch 关键词，加载用户列表
        const keyword = val.trim().split(/\s+/)[0];
        if (keyword === 'ch' && chromeProfiles.value.length === 0) {
          loadChromeProfiles();
        }
        remoteMode.value = 'keyword';
        timer = setTimeout(async () => {
          const res = (await window.spotlightApi.query(val, selectedProfile.value)) || {};
          remoteMode.value = res.mode || 'unknown';
          remoteItems.value = Array.isArray(res.items) ? res.items : [];
          mod.value = res.mode || '';
        }, 160);
      } else {
        remoteMode.value = 'local';
        remoteItems.value = [];
        mod.value = '';
      }
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
watch([renderList, query, activeComponent], ([list, q, activeComp]) => {
  const baseHeight = 70;
  const itemHeight = 60; // 和 .result-item 的高度一致
  const maxListHeight = 430;
  let listHeight = 0;
  if (list.length > 0) listHeight = Math.min(list.length * itemHeight, maxListHeight);
  else if (q.length > 0 && !activeComp) listHeight = itemHeight;

  // 如果显示了用户过滤按钮，加上它的高度
  let profileHeight = 0;
  if (remoteMode.value === 'keyword' && chromeProfiles.value.length > 0) {
    profileHeight = 44; // profile-filters 的高度约 44px（padding 8+8=16，按钮高 28）
  }

  // 如果显示了动态组件，加上它的高度
  let componentHeight = 0;
  if (activeComp) {
    componentHeight = 100; // 动态组件的高度约 100px
  }

  // sListHeight.value = listHeight;
  // window.spotlightApi.resizeWindow(baseHeight + listHeight + profileHeight + componentHeight);
});

const numberIndex = ref(0)

// 键盘导航/聚焦
onMounted(() => {
  window.spotlightApi.onFocusInput(() => {
    query.value = '';
    selected.value = 0;
    remoteMode.value = 'local';
    remoteItems.value = [];
    mod.value = '';
    activeComponent.value = null;
    selectedProfile.value = '';
    nextTick(() => {
      searchInput.value && searchInput.value.focus();
    });
  });
  window.spotlightApi.onFocusInput(() => {
    query.value = '';
    selected.value = 0;
    remoteMode.value = 'local';
    remoteItems.value = [];
    mod.value = '';
    activeComponent.value = null;
    selectedProfile.value = '';
    nextTick(() => {
      searchInput.value && searchInput.value.focus();
    });
  });
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
.spotlight-box {
  width: 700px;
  border-radius: 30px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.3);

  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  padding: 8px 10px;
  -webkit-app-region: drag;
}

.input-wrapper {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0px 10px;
  font-size: 18px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.icon {
  margin-right: 10px;
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
  -webkit-app-region: no-drag;
}

/* 每项：固定40px，内容容器自己做两行布局；隐藏溢出避免遮挡 */
.result-item {
  height: 40px;
  padding: 10px 10px;
  cursor: pointer;
  border-radius: 15px;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.result-item:hover,
.result-item.active {
  background: rgba(255, 255, 255, 0.3);
}

.result-item.disabled {
  color: #aaa;
  cursor: default;
  pointer-events: none;
}

/* 输入框，避免横向滚动 */
.spotlight-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 24px;
  line-height: 24px;
  overflow: hidden;
  color: #fff;
  -webkit-app-region: no-drag;

  &::placeholder {
    color: rgba(255, 255, 255, .6);
  }
}

/* Chrome 用户过滤按钮区 */
.profile-filters {
  display: flex;
  gap: 6px;
  margin: 8px 0px;
  height: 24px;
  overflow-x: auto;
  -webkit-app-region: no-drag;
}

.profile-btn {
  border: transparent;
  border-radius: 10px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, .15);
  color: #fff;
  font-size: 14px;
  line-height: 20px;
  height: 24px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.18s;
}

.profile-btn:hover {
  background: rgba(0, 120, 255, 0.1);
}

.profile-btn.active {
  background: rgba(0, 120, 255, 0.15);
  border-color: #0078ff;
}
</style>

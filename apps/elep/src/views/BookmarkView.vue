<template>
  <div class="p-4">
    <div class="toolbar">
      <el-select v-model="profile" placeholder="选择 Chrome Profile" @change="load" style="width: 240px">
        <el-option v-for="p in profiles" :key="p" :label="p" :value="p" />
      </el-select>
      <el-input v-model="keyword" placeholder="搜索名称或链接" clearable style="width: 320px; margin-left: 12px" />
      <el-button type="primary" style="margin-left: 12px" @click="load">刷新</el-button>
    </div>

    <el-tree
      v-if="data.length"
      :data="filtered"
      node-key="id"
      :props="treeProps"
      :default-expand-all="false"
      highlight-current
      class="mt-3"
    >
      <template #default="{ node, data }">
        <span class="custom-node">
          <el-icon v-if="data.type === 'folder'">
            <Folder />
          </el-icon>
          <el-icon v-else>
            <Link />
          </el-icon>
          <span class="label" :title="data.label">{{ data.label }}</span>
          <el-link v-if="data.url" type="primary" @click.stop="open(data.url)" style="margin-left: 8px">打开</el-link>
          <span v-if="data.url" class="url" :title="data.url">{{ data.url }}</span>
        </span>
      </template>
    </el-tree>

    <el-empty v-else description="没有读取到书签"></el-empty>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Folder, Link } from '@element-plus/icons-vue';

const profiles = ref([]);
const profile = ref('Default');
const data = ref([]);
const keyword = ref('');

const treeProps = { children: 'children', label: 'label' };

async function load() {
  try {
    const res = await window.bookmarksApi.load(profile.value);
    data.value = res?.tree || [];
  } catch (e) {
    console.error(e);
    ElMessage.error('读取书签失败');
  }
}

function flatten(arr, acc = []) {
  for (const it of arr) {
    acc.push(it);
    if (it.children?.length) flatten(it.children, acc);
  }
  return acc;
}

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return data.value;
  // 简单过滤：把节点拷贝成只包含命中的分支
  const matchNode = (node) => {
    const hit = (node.label || '').toLowerCase().includes(kw) || (node.url || '').toLowerCase().includes(kw);
    const children = (node.children || []).map(matchNode).filter(Boolean);
    if (hit || children.length) return { ...node, children };
    return null;
  };
  return data.value.map(matchNode).filter(Boolean);
});

function open(url) {
  window.bookmarksApi.openExternal(url);
}

onMounted(async () => {
  try {
    profiles.value = await window.bookmarksApi.listProfiles();
    if (profiles.value.length && !profiles.value.includes(profile.value)) {
      profile.value = profiles.value[0];
    }
    await load();
  } catch (e) {
    console.error(e);
    ElMessage.error('初始化失败');
  }
});
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
}

.custom-node {
  display: flex;
  align-items: center;
  gap: 6px;
}

.custom-node .label {
  max-width: 380px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-node .url {
  color: #909399;
  margin-left: 8px;
  max-width: 520px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mt-3 {
  margin-top: 12px;
}

.p-4 {
  padding: 16px;
}
</style>

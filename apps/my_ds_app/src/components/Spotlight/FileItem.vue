<template>
  <div class="fi">
    <div class="fi-top">
      <span class="fi-icon">📄</span>
      <span class="fi-title" :title="item.title || ''">{{ item.title || '' }}</span>
      <span class="fi-actions">
        <button class="mini-btn" @click="handleOpen">打开</button>
        <button class="mini-btn" @click="handleReveal">位置</button>
      </span>
    </div>
    <div class="fi-path" :title="fullPath">{{ middleEllipsis(fullPath, 80) }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const fullPath = computed(() => props.item.subtitle || '')

function middleEllipsis(str = '', max = 68) {
  const s = String(str)
  if (s.length <= max) return s
  const keep = Math.max(1, Math.floor((max - 1) / 2))
  return s.slice(0, keep) + '…' + s.slice(-keep)
}

function handleOpen() {
  const serializableItem = {
    provider: props.item.provider,
    kind: props.item.kind,
    view: props.item.view,
    title: props.item.title,
    subtitle: props.item.subtitle,
    fullPath: props.item.fullPath,
    action: 'open'
  }
  window.spotlightApi.open(serializableItem)
}

function handleReveal() {
  const serializableItem = {
    provider: props.item.provider,
    kind: props.item.kind,
    view: props.item.view,
    title: props.item.title,
    subtitle: props.item.subtitle,
    fullPath: props.item.fullPath,
    action: 'reveal'
  }
  window.spotlightApi.open(serializableItem)
}
</script>

<style scoped>
.fi {
  display: grid;
  grid-template-rows: 1fr 1fr;
  width: 100%;
  min-width: 0;
  row-gap: 0;
}

.fi-top {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
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
  text-overflow: clip;
}
</style>

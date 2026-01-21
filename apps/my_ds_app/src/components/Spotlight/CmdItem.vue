<template>
  <div class="cmd">2
    <div class="cmd-title" :title="item.title">
      ⚡ {{ item.title }}
    </div>
    <div class="cmd-actions">
      <button class="mini-btn" @click="handleRun">运行</button>
      <button class="mini-btn" @click="handleTerminal">终端</button>
      <button class="mini-btn" @click="handleCopy">复制</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

function handleRun() {
  const serializableItem = {
    provider: props.item.provider,
    kind: props.item.kind,
    view: props.item.view,
    title: props.item.title,
    action: 'run'
  }
  window.spotlightApi.open(serializableItem)
}

function handleTerminal() {
  const serializableItem = {
    provider: props.item.provider,
    kind: props.item.kind,
    view: props.item.view,
    title: props.item.title,
    action: 'terminal'
  }
  window.spotlightApi.open(serializableItem)
}

function handleCopy() {
  const serializableItem = {
    provider: props.item.provider,
    kind: props.item.kind,
    view: props.item.view,
    title: props.item.title,
    action: 'copy'
  }
  window.spotlightApi.open(serializableItem)
}
</script>

<style scoped>
.cmd {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
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
</style>

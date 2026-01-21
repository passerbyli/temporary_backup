<template>
  <div class="one-line" :title="`${item.title}   ${item.subtitle || ''}`">
    <span class="si-icon">🔎</span>
    <span class="si-title">{{ item.title || '' }}</span>
    <span v-if="item.subtitle" class="si-sub">{{ item.subtitle }}</span>
  </div>
</template>

<script setup>
defineProps({
  item: {
    type: Object,
    required: true
  }
})
</script>

<style scoped>
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

.si-icon {
  width: 18px;
  text-align: center;
  opacity: 0.9;
  flex: 0 0 auto;
}

.si-title {
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
}

.si-sub {
  color: #999;
  margin-left: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

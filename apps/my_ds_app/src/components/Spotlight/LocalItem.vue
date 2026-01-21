<template>
  <div class="one-line" :title="item.label">
    <span class="li-title">{{ item.label }}</span>
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

.li-title {
  font-weight: 600;
  color: #111;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

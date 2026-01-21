<template>
  <div class="bi">
    <div class="bi-title" :title="title">
       {{ title }} <el-tag>{{ displayName }}</el-tag>
    </div>
    <div class="bi-url" :title="url">{{ middleEllipsis(url, 80) }}</div>
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

const displayName = computed(() => props.item.displayName || '')
const title = computed(() => props.item.title || '')
const url = computed(() => {
  let u = props.item.subtitle || ''
  const dot = u.indexOf(' · ')
  if (dot > 0) u = u.slice(0, dot)
  return u
})

function middleEllipsis(str = '', max = 68) {
  const s = String(str)
  if (s.length <= max) return s
  const keep = Math.max(1, Math.floor((max - 1) / 2))
  return s.slice(0, keep) + '…' + s.slice(-keep)
}
</script>

<style scoped>
.bi {
  display: grid;
  grid-template-rows: 1fr 1fr;
  row-gap: 0px;
  width: 100%;
  min-width: 0;
}

.bi-title {
  line-height: 20px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bi-url {
  line-height: 20px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
}
</style>

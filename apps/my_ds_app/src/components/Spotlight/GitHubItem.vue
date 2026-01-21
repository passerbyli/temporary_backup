<template>
  <div class="gh">3
    <div class="gh-top" :title="item.title || ''">
      <span class="gh-icon">🐙</span>
      <span class="gh-title">{{ item.title || '' }}</span>
      <span class="gh-badges">
        <span v-if="stars" class="gh-badge">★ {{ stars }}</span>
        <span v-if="lang" class="gh-badge gh-lang">{{ lang }}</span>
      </span>
    </div>
    <div class="gh-desc" :title="desc">{{ desc }}</div>
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

const stars = computed(() => {
  const sub = props.item.subtitle || ''
  const m = sub.match(/^★\s*([\d,._]+)\s*·\s*([^\s·]+)(?:\s*·\s*(.*))?$/)
  return m ? m[1] : ''
})

const lang = computed(() => {
  const sub = props.item.subtitle || ''
  const m = sub.match(/^★\s*([\d,._]+)\s*·\s*([^\s·]+)(?:\s*·\s*(.*))?$/)
  return m ? m[2] : ''
})

const desc = computed(() => {
  const sub = props.item.subtitle || ''
  const m = sub.match(/^★\s*([\d,._]+)\s*·\s*([^\s·]+)(?:\s*·\s*(.*))?$/)
  return m ? m[3] || '' : sub
})
</script>

<style scoped>
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
</style>

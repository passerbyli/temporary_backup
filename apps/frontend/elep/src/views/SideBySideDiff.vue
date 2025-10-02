<template>
    <div class="diff-wrapper">
        <div class="block">
            <h4>测试环境</h4>
            <div class="diff-content" v-html="diffTest" />
        </div>
        <div class="block">
            <h4>生产环境</h4>
            <div class="diff-content" v-html="diffProd" />
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import DiffMatchPatch from 'diff-match-patch'

const props = defineProps({
    left: { type: [String, Object], required: true },  // test 数据
    right: { type: [String, Object], required: true } // prod 数据
})

const dmp = new DiffMatchPatch()

function normalize(value) {
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2)
    }
    return String(value)
}

const diffResult = computed(() => {
    const leftStr = normalize(props.left)
    const rightStr = normalize(props.right)
    const diffs = dmp.diff_main(leftStr, rightStr)
    dmp.diff_cleanupSemantic(diffs)
    return diffs
})

const diffTest = computed(() => {
    return diffResult.value.map(([op, data]) => {
        if (op === 0 || op === -1) return `<span>${escapeHtml(data)}</span>`
        if (op === 1) return `<ins class='added'>${escapeHtml(data)}</ins>`
    }).join('')
})

const diffProd = computed(() => {
    return diffResult.value.map(([op, data]) => {
        if (op === 0 || op === 1) return `<span>${escapeHtml(data)}</span>`
        if (op === -1) return `<del class='deleted'>${escapeHtml(data)}</del>`
    }).join('')
})

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
}
</script>

<style scoped>
.diff-wrapper {
    display: flex;
    gap: 20px;
    padding: 12px;
}

.block {
    flex: 1;
    border: 1px solid #ccc;
    background: #f9f9f9;
    padding: 12px;
    overflow-x: auto;
    max-height: 600px;
}

.diff-content {
    white-space: pre-wrap;
    font-family: Menlo, monospace;
    font-size: 13px;
    line-height: 1.5;
}

ins.added {
    background-color: #e6ffed;
    text-decoration: none;
}

del.deleted {
    background-color: #ffeef0;
    text-decoration: line-through;
}
</style>
  

<template>
    <div class="json-diff-container">
        <div class="editor-panel">
            <el-input v-model="leftText" :rows="18" type="textarea" placeholder="左侧 JSON 粘贴区" />
            <el-input v-model="rightText" :rows="18" type="textarea" placeholder="右侧 JSON 粘贴区" />
        </div>

        <div class="btn-panel">
            <el-button type="primary" @click="handleCompare">格式化并对比</el-button>
            <el-button @click="clear">清空</el-button>
        </div>

        <div class="diff-view" v-if="diffHtml">
            <div class="diff-result" v-html="diffHtml"></div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import * as jsondiffpatch from 'jsondiffpatch'

const leftText = ref('')
const rightText = ref('')
const diffHtml = ref('')

// 使用 jsondiffpatch.create() 会有更完整配置支持
const diffpatcher = jsondiffpatch.create({
    arrays: { detectMove: false }, // 不分析移动，仅比较内容
    textDiff: { minLength: 60 },
})

function deepSort(obj) {
    if (Array.isArray(obj)) {
        return obj.map(deepSort).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    } else if (obj && typeof obj === 'object') {
        const sorted = {}
        Object.keys(obj).sort().forEach(key => {
            sorted[key] = deepSort(obj[key])
        })
        return sorted
    }
    return obj
}

function handleCompare() {
    try {
        const left = deepSort(JSON.parse(leftText.value || '{}'))
        const right = deepSort(JSON.parse(rightText.value || '{}'))

        const delta = diffpatcher.diff(left, right)
        diffHtml.value = jsondiffpatch.formatters.html.format(delta, left)
    } catch (e) {
        diffHtml.value = `<div style="color:red;">无效的 JSON 格式</div>`
    }
}

function clear() {
    leftText.value = ''
    rightText.value = ''
    diffHtml.value = ''
}
</script>

<style scoped>
.json-diff-container {
    padding: 20px;
}

.editor-panel {
    display: flex;
    gap: 10px;
}

.editor-panel .el-input {
    flex: 1;
}

.btn-panel {
    margin: 15px 0;
}

.diff-view {
    border: 1px solid #ccc;
    padding: 10px;
    background: #fafafa;
    max-height: 600px;
    overflow: auto;
}

.diff-result {
    font-family: monospace;
    font-size: 14px;
}
</style>

<!-- 外部样式（可放 main.ts 中全局引入） -->
<style>
/* @import "jsondiffpatch/public/formatters-styles/html.css"; */
</style>
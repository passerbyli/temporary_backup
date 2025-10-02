<template>
    <div class="copyable-textarea">
        <div class="header">
            <span class="label" v-if="label">{{ label }}</span>
            <el-button type="primary" size="small" @click="copySelectedOrAll" icon="CopyDocument" plain>
                复制
            </el-button>
        </div>

        <div class="code-block" :style="{ maxHeight: height }">
            <div class="line-numbers">
                <div class="line-number" v-for="(_, index) in lines" :key="index">
                    {{ index + 1 }}
                </div>
            </div>
            <pre class="code-content" ref="codeRef" v-html="highlightedCode"></pre>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('sql', sql)

const props = defineProps({
    content: { type: String, required: true },
    label: { type: String, default: '' },
    height: { type: String, default: '200px' }
})

const codeRef = ref(null)

const lines = computed(() => props.content?.split('\n'))

const highlightedCode = computed(() =>
    hljs.highlight(props.content||'', { language: 'sql' }).value
)

const copySelectedOrAll = async () => {
    const selection = window.getSelection()
    let text = ''

    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const container = codeRef.value

        if (container && container.contains(range.commonAncestorContainer)) {
            // 只复制 code-content 里的内容
            text = selection.toString()
        }
    }

    if (!text) {
        text = props.content // 如果没选中，则复制全部
    }

    try {
        await navigator.clipboard.writeText(text)
        ElMessage.success(text === props.content ? '已复制全部内容' : '已复制选中内容')
    } catch (e) {
        ElMessage.error('复制失败，请手动复制')
    }
}
</script>

<style scoped>
.copyable-textarea {
    width: 100%;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}

.label {
    font-weight: bold;
    font-size: 14px;
}

.code-block {
    display: flex;
    background: #f9f9f9;
    border: 1px solid #ccc;
    font-family: monospace;
    font-size: 13px;
    overflow: auto;
}

.line-numbers {
    background: #f0f0f0;
    padding: 8px 6px;
    text-align: right;
    color: #999;
    user-select: none;
}

.line-number {
    line-height: 1.6;
}

.code-content {
    padding: 8px;
    margin: 0;
    line-height: 1.6;
    white-space: pre;
}
</style>
<template>
    <div class="diff-split">
        <div class="diff-block">
            <div class="diff-title">旧版本（{{ leftTitle }}）</div>
            <pre class="diff-view" v-html="diffLeft" />
        </div>
        <div class="diff-block">
            <div class="diff-title">新版本（{{ rightTitle }}）</div>
            <pre class="diff-view" v-html="diffRight" />
        </div>
    </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { diff_match_patch, DIFF_INSERT, DIFF_DELETE, DIFF_EQUAL } from 'diff-match-patch'

const props = defineProps({
    oldText: { type: String, required: true },
    newText: { type: String, required: true },
    leftTitle: { type: String, default: '旧版本' },
    rightTitle: { type: String, default: '新版本' }
})

const diffLeft = ref('')
const diffRight = ref('')

const escapeHtml = (str) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const renderDiff = () => {
    const oldLines = props.oldText.split('\n')
    const newLines = props.newText.split('\n')
    const maxLines = Math.max(oldLines.length, newLines.length)

    const dmp = new diff_match_patch()
    const leftHtml = []
    const rightHtml = []

    for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i] ?? ''
        const newLine = newLines[i] ?? ''
        const lineNumber = i + 1

        let oldStyled = ''
        let newStyled = ''

        if (oldLine !== newLine) {
            const diffs = dmp.diff_main(oldLine, newLine)
            dmp.diff_cleanupSemantic(diffs)

            oldStyled = diffs.map(([op, text]) => {
                if (op === DIFF_DELETE) return `<del>${escapeHtml(text)}</del>`
                if (op === DIFF_EQUAL) return `<span>${escapeHtml(text)}</span>`
                return '' // INSERT 不显示在旧版本
            }).join('')

            newStyled = diffs.map(([op, text]) => {
                if (op === DIFF_INSERT) return `<ins>${escapeHtml(text)}</ins>`
                if (op === DIFF_EQUAL) return `<span>${escapeHtml(text)}</span>`
                return '' // DELETE 不显示在新版本
            }).join('')
        } else {
            oldStyled = newStyled = `<span>${escapeHtml(oldLine)}</span>`
        }

        leftHtml.push(`<span class="line-num">${lineNumber}</span> ${oldStyled}`)
        rightHtml.push(`<span class="line-num">${lineNumber}</span> ${newStyled}`)
    }

    diffLeft.value = leftHtml.join('\n')
    diffRight.value = rightHtml.join('\n')
}

watch(() => [props.oldText, props.newText], renderDiff, { immediate: true })
</script>

<style scoped>
.diff-split {
    display: flex;
    gap: 16px;
}

.diff-block {
    flex: 1;
    border: 1px solid #ccc;
    background: #f9f9f9;
    overflow: auto;
}

.diff-title {
    padding: 8px;
    background: #f0f0f0;
    font-weight: bold;
    border-bottom: 1px solid #ccc;
}

pre.diff-view {
    font-family: monospace;
    padding: 8px;
    white-space: pre-wrap;
    line-height: 1.6;
}

.line-num {
    display: inline-block;
    width: 2em;
    color: #999;
    text-align: right;
    margin-right: 0.5em;
}

.diff-view del {
    background-color: #ffecec;
    color: #c00;
    text-decoration: none;
}

.diff-view ins {
    background-color: #d4fcdc;
    color: #080;
    text-decoration: none;
}
</style>
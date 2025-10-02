<template>
    <div class="inline-copy">
        <span v-if="label" class="label">{{ label }}：</span>
        <span class="text">{{ text }}</span>
        <el-icon class="copy-icon" @click="copyText" :title="'复制'">
            <CopyDocument />
        </el-icon>
    </div>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'

const props = defineProps({
    text: { type: String, required: true },
    label: { type: String, default: '' }
})

const copyText = async () => {
    try {
        await navigator.clipboard.writeText(props.text)
        ElMessage.success('已复制到剪贴板')
    } catch (e) {
        ElMessage.error('复制失败')
    }
}
</script>

<style scoped>
.inline-copy {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    user-select: text;
}

.label {
    font-weight: 500;
}

.text {
    color: #333;
    font-family: monospace;
}

.copy-icon {
    cursor: pointer;
    color: #999;
    transition: color 0.2s;
}

.copy-icon:hover {
    color: #409eff;
}
</style>
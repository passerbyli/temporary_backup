<template>
    <div class="title-bar" @dblclick="handleDoubleClick">
        <div class="drag-region"></div>
        <div class="control-buttons">
            <el-button type="text" @click="minimize">
                <el-icon>
                    <Minus />
                </el-icon>
            </el-button>
            <el-button type="text" icon="CopyDocument" @click="maximize">
                <el-icon>
                    <CopyDocument />
                </el-icon>
            </el-button>
            <el-button type="text" icon="Close" @click="minimize">
                <el-icon>
                    <Close />
                </el-icon>
            </el-button>
        </div>
    </div>
</template>

<script setup>
import { ElButton } from 'element-plus'
import { Close, Minus, CopyDocument } from '@element-plus/icons-vue'

defineExpose({ ElButton, Close, Minus, CopyDocument })
function minimize() {
    window.electronAPI?.minimize()
}
function maximize() {
    window.electronAPI?.maximize()
}
function handleDoubleClick() {
    window.electronAPI?.toggleMaximize()
}
</script>

<style scoped>
.title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 36px;
    padding: 0 10px;
    background-color: #2c3e50;
    color: white;
    -webkit-app-region: drag;
    /* 可拖动区域 */
    user-select: none;
}

.control-buttons {
    display: flex;
    gap: 4px;
    -webkit-app-region: no-drag;
    /* 按钮不可拖动 */
}
</style>
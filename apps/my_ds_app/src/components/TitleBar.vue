<template>
    <div class="toolbar">
        <div class="title no-drag">
            <span class="title-dot"></span>
            My Ds App
        </div>
        <div class="drag-spacer"></div>
        <div class="win-operate no-drag">
            <button class="win-operate-btn" type="button" @click="max()">
                <el-icon>
                    <Plus />
                </el-icon>
            </button>
            <button class="win-operate-btn" type="button" @click="min()">
                <el-icon>
                    <CloseBold />
                </el-icon>
            </button>
        </div>
    </div>
</template>

<script setup>
import { ElButton } from 'element-plus';
import { Close, Minus, CopyDocument, CloseBold, Plus } from '@element-plus/icons-vue';

defineExpose({ ElButton, Close, Minus, CopyDocument });
function min() {
    window.electronAPI?.minimize();
}
function max() {
    window.electronAPI?.maximize();
}
</script>

<style scoped>
.toolbar {
    height: 44px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    background: linear-gradient(90deg, rgba(var(--color2-rgb), 0.95), rgba(var(--color3-rgb), 0.92));
    -webkit-app-region: drag;
}

.toolbar .title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--ink-900);
}

.title-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color4), var(--color2));
    box-shadow: 0 0 0 6px rgba(var(--color2-rgb), 0.18);
}

.drag-spacer {
    flex: 1;
    height: 100%;
}

.no-drag {
    -webkit-app-region: no-drag;
}

.win-operate {
    display: flex;
    gap: 8px;
}

.win-operate-btn {
    width: 28px;
    height: 28px;
    border-radius: 9px;
    border: 1px solid rgba(var(--color4-rgb), 0.18);
    background: rgba(255, 255, 255, 0.75);
    color: var(--ink-700);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.win-operate-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(var(--color4-rgb), 0.18);
    background: #fff;
}
</style>

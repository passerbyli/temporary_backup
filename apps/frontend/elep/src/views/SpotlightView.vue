<template>
    <div class="spotlight-box">
        <div class="input-wrapper">
            <span class="icon">🔍</span>

            <input ref="searchInput" v-model="query" class="spotlight-input" placeholder="搜索或输入命令…"
                @keydown.enter="execute" />
        </div>
        <ul class="result-list">
            <li v-for="(item, i) in filtered" :key="i" :class="['result-item', { active: i === selected }]"
                @click="run(item)">
                {{ item.label }}
            </li>
            <li v-if="filtered.length === 0 && query.length > 0" class="result-item disabled">
                没有找到相关结果
            </li>
        </ul>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
const searchInput = ref(null)
const query = ref('')
const selected = ref(0)
const items = ref([
    { label: '打开设置', command: 'setting' },
    { label: '跳转首页', command: 'home' },
    { label: '新建笔记1', command: 'new-note' },
    { label: '新建任务2', command: 'new-task' },
    { label: '新建任务3', command: 'new-task' },
    { label: '新建任务4', command: 'new-task' },
    { label: '新建任务5', command: 'new-task' },
    { label: '新建任务6', command: 'new-task' },
    { label: '新建任务7', command: 'new-task' },
    { label: '新建任务8', command: 'new-task' },
    { label: '新建任务9', command: 'new-task' },
    { label: '新建任务10', command: 'new-task' },
    { label: '新建任务11', command: 'new-task' },
    { label: '新建任务12', command: 'new-task' },
    { label: '新建任务13', command: 'new-task' },
    { label: '新建任务14', command: 'new-task' },
    { label: '新建任务15', command: 'new-task' },
    { label: '新建日记', command: 'new-journal' },
    { label: '打开帮助', command: 'help' },
    { label: '退出应用', command: 'quit' }
])

const filtered = computed(() =>
    items.value.filter(i => i.label.includes(query.value))
)

function run(item) {
    window.spotlightApi.executeCommand(item.command)
    window.spotlightApi.hide()
}

function execute() {
    if (filtered.value.length) run(filtered.value[selected.value])
}

// 监听结果数量变化，动态调整窗口高度
watch([filtered, query], ([list, q]) => {
    const baseHeight = 70
    const itemHeight = 40
    const maxListHeight = 400

    let listHeight = 0
    if (list.length > 0) {
        listHeight = Math.min(list.length * itemHeight, maxListHeight)
    } else if (q.length > 0) {
        listHeight = itemHeight // 保证“没有找到相关结果”能显示
    }

    const newHeight = baseHeight + listHeight
    window.spotlightApi.resizeWindow(newHeight)
})


onMounted(() => {
    // 当窗口获得焦点时自动聚焦输入框
    window.addEventListener('focus', () => {
        if (searchInput.value) {
            searchInput.value.focus()
        }
    })
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.spotlightApi.hide()
        if (e.key === 'ArrowDown') {
            selected.value = (selected.value + 1) % filtered.value.length
        }
        if (e.key === 'ArrowUp') {
            selected.value =
                (selected.value - 1 + filtered.value.length) % filtered.value.length
        }
    })
})
</script>

<style scoped>
.spotlight-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: start;
    padding-top: 15vh;
    background: rgba(0, 0, 0, 0.2);
    /* 半透明遮罩 */
}

.spotlight-box {
    width: 600px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(16px);
    /* 毛玻璃效果 */
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
    padding: 12px;
}

.input-wrapper {
    height: 40px;
    display: flex;
    align-items: center;
    padding: 6px 10px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.icon {
    margin-right: 10px;
    font-size: 18px;
    color: #666;
}

.spotlight-input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-size: 18px;
    padding: 6px 0;
}

.result-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 400px;
    overflow-y: auto;
}

.result-item {
    height: 28px;
    padding: 6px 12px;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.2s;
}

.result-item:hover,
.result-item.active {
    background: rgba(0, 120, 255, 0.15);
}

.result-item.disabled {
    color: #aaa;
    cursor: default;
    pointer-events: none;
    /* 禁止点击 */
}
</style>
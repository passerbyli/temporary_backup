<template>
    <div>
        <!-- 角色切换 -->
        <el-select v-model="role" placeholder="选择角色" style="margin-bottom: 20px; width: 200px">
            <el-option label="开发" value="开发" />
            <el-option label="测试" value="测试" />
        </el-select>

        <!-- 表格 -->
        <el-table :data="filteredData" border style="width: 100%" :row-style="getRowStyle"> <!-- 名称列 -->
            <el-table-column prop="name" label="名称" sortable :filters="getFilters('name')"
                :filter-method="filterHandler" />

            <!-- 状态列 -->
            <el-table-column prop="status" label="状态" sortable :filters="getFilters('status')"
                :filter-method="filterHandler" />

            <!-- transferTime 列 -->
            <el-table-column prop="transferTime" label="开发交付时间" sortable :filters="getFilters('transferTime')"
                :filter-method="filterHandler" />

            <!-- testCompletionTime 列 -->
            <el-table-column prop="testCompletionTime" label="测试完成时间" sortable
                :filters="getFilters('testCompletionTime')" :filter-method="filterHandler" />
        </el-table>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const role = ref('测试') // 当前角色

// 原始数据
const rawList = [
    { name: '1', status: '开发完成', transferTime: '2025-06-27', testCompletionTime: '2025-06-28' },
    { name: '1', status: '待上线', transferTime: '2025-06-28', testCompletionTime: '2025-06-27' },
    { name: '1', status: '开发完成', transferTime: '2025-06-28', testCompletionTime: '2025-06-29' },
    { name: '1', status: '开发完成', transferTime: '2025-06-24', testCompletionTime: '2025-06-26' },
    { name: '1', status: '开发中', transferTime: '2025-06-26', testCompletionTime: '2025-06-29' },
    { name: '1', status: '开发完成', transferTime: '2025-06-21', testCompletionTime: '2025-06-29' },
    { name: '1', status: '概设', transferTime: '2025-06-21', testCompletionTime: '2025-06-29' },
    { name: '1', status: 'UAT测试', transferTime: '2025-06-21', testCompletionTime: '2025-06-24' },
    { name: '1', status: '待上线', transferTime: '2025-06-21', testCompletionTime: '2025-06-24' },
    { name: '1', status: '待上线', transferTime: '2025-06-29', testCompletionTime: '2025-06-30' }
]

// 状态列表
const devStatus = ["草稿", "评审", "概设", "开发中", "开发完成"]
const testStatus = ["开发完成", "sit测试中", "sit测试完成", "UAT测试", "UAT完成"]
const toBeLaunchedStatus = ["待上线"]
const finishStatus = ["完成"]
function getRowStyle({ row }) {
    if (!row._highlight) return {}

    let statusColorMap = {
        '草稿': '#f5f5f5',
        '评审': '#fff1f0',
        '概设': '#fffbe6',
        '开发中': '#e6f7ff',
        '开发完成': '#f6ffed'
    }

    // if (role.value === '测试') {
    //     statusColorMap = {
    //         '开发完成': '#e6f7ff',
    //         'sit测试中': '#fff1f0',
    //         'UAT测试': '#e6f7ff',
    //         'UAT完成': '#f6ffed'
    //     }
    // }

    const color = statusColorMap[row.status] || '#ffffff'

    return { backgroundColor: color }
}
// 处理数据列表：排序 + 标记高亮
function processList(list, role) {
    const today = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '-')

    let statusList, sortKey, excludeStatus
    if (role === '开发') {
        statusList = devStatus
        sortKey = 'transferTime'
        excludeStatus = []
    } else {
        statusList = testStatus
        sortKey = 'testCompletionTime'
        excludeStatus = [...toBeLaunchedStatus, ...finishStatus]
    }

    return list
        .map(item => {
            const statusIndex = statusList.indexOf(item.status)
            const dateValue = item[sortKey]
            const isPast = dateValue <= today
            const isIncluded = statusIndex >= 0

            const highlight = isPast && isIncluded // ✅ 关键：小于等于今天 && 状态在角色状态内

            let order = 999
            if (role === '开发') {
                if (highlight) order = 0
                else if (isIncluded) order = 1
                else order = 9
            } else {
                if (highlight) order = 0
                else if (isIncluded) order = 1
                else if (excludeStatus.includes(item.status)) order = 9
                else order = 5
            }

            return {
                ...item,
                _order: order,
                _highlight: highlight
            }
        })
        .sort((a, b) => {
            if (a._order !== b._order) return a._order - b._order
            const key = role === '开发' ? 'transferTime' : 'testCompletionTime'
            return new Date(a[key]) - new Date(b[key])
        })
}

// 最终表格数据
const tableData = computed(() => processList(rawList, role.value))

// 获取筛选项
function getFilters(prop) {
    const values = Array.from(new Set(tableData.value.map(item => item[prop])))
    return values.map(v => ({ text: v, value: v }))
}

// 筛选逻辑
function filterHandler(value, row, column) {
    return row[column.property] === value
}

// 行样式（高亮未完成任务）
function getRowClass({ row }) {
    return row._highlight ? 'highlight-row' : ''
}

const filteredData = computed(() => tableData.value)
</script>

<style>

</style>
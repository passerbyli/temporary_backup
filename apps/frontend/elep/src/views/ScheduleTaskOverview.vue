<template>
    <div class="schedule-task-overview">
        <!-- 筛选栏 -->
        <div class="filter-bar">
            <el-input v-model="searchText" placeholder="搜索任务名" clearable class="filter-input" />
            <el-select v-model="selectedPlatform" placeholder="平台" clearable class="filter-select">
                <el-option v-for="p in platforms" :key="p" :label="p" :value="p" />
            </el-select>
            <el-select v-model="selectedOwner" placeholder="负责人" clearable class="filter-select">
                <el-option v-for="o in owners" :key="o" :label="o" :value="o" />
            </el-select>
        </div>

        <!-- 表格展示 -->
        <el-table :data="filteredTasks" border stripe size="small">
            <el-table-column prop="task_name" label="任务名称" width="200" />
            <el-table-column prop="platform" label="来源平台" width="140" />
            <el-table-column prop="task_type" label="类型" width="100" />
            <el-table-column prop="owner" label="负责人" width="100" />
            <el-table-column prop="cron" label="调度周期" width="160" />
            <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">
                    <el-tag :type="row.status === 'active' ? 'success' : 'info'">
                        {{ row.status === 'active' ? '启用' : '禁用' }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
                <template #default="{ row }">
                    <el-button size="small" @click="viewDetail(row)">详情</el-button>
                </template>
            </el-table-column>
        </el-table>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const searchText = ref('')
const selectedPlatform = ref('')
const selectedOwner = ref('')

// 可配置的平台
const platforms = ['DolphinScheduler', 'Airflow', '自研平台A', '自研平台B']
const owners = ['张三', '李四', '王五']

// 模拟任务数据
const tasks = ref([
    {
        task_name: 'load_user_summary',
        platform: 'DolphinScheduler',
        task_type: 'ETL',
        owner: '张三',
        cron: '0 2 * * *',
        status: 'active',
    },
    {
        task_name: 'export_order_data',
        platform: 'Airflow',
        task_type: 'EXPORT',
        owner: '李四',
        cron: '0 3 * * *',
        status: 'inactive',
    },
    {
        task_name: 'sync_user_api',
        platform: '自研平台A',
        task_type: 'API_ETL',
        owner: '王五',
        cron: '0 */1 * * *',
        status: 'active',
    },
])

// 筛选后的结果
const filteredTasks = computed(() => {
    return tasks.value.filter((t) => {
        const matchText = !searchText.value || t.task_name.includes(searchText.value)
        const matchPlatform = !selectedPlatform.value || t.platform === selectedPlatform.value
        const matchOwner = !selectedOwner.value || t.owner === selectedOwner.value
        return matchText && matchPlatform && matchOwner
    })
})

// 跳转详情页
const viewDetail = (task) => {
    router.push({ name: 'ScheduleTaskDetail', params: { taskName: task.task_name } })
}
</script>

<style scoped>
.schedule-task-overview {
    padding: 20px;
}

.filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
}

.filter-input {
    width: 200px;
}

.filter-select {
    width: 160px;
}
</style>
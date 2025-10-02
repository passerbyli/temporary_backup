<template>
    <div class="procedure-asset-overview">
        <!-- 筛选栏 -->
        <div class="filter-bar">
            <el-input v-model="searchText" placeholder="搜索过程名 / 别名" clearable class="filter-input" />
            <el-select v-model="selectedType" placeholder="类型" clearable class="filter-select">
                <el-option label="接口调用 (API)" value="API" />
                <el-option label="数据加工 (ETL)" value="ETL" />
            </el-select>
            <el-select v-model="selectedDb" placeholder="数据库" clearable class="filter-select">
                <el-option v-for="item in dbList" :key="item" :label="item" :value="item" />
            </el-select>
            <el-select v-model="selectedSchema" placeholder="Schema" clearable class="filter-select">
                <el-option v-for="item in schemaList" :key="item" :label="item" :value="item" />
            </el-select>
            <el-select v-model="selectedOwner" placeholder="负责人" clearable class="filter-select">
                <el-option v-for="item in owners" :key="item" :label="item" :value="item" />
            </el-select>
        </div>

        <!-- 表格区域 -->
        <el-table :data="filteredProcedures" stripe border size="small">
            <el-table-column prop="proc_name" label="过程名" width="180" />
            <el-table-column prop="alias" label="别名" width="160" />
            <el-table-column prop="proc_type" label="类型" width="100">
                <template #default="{ row }">
                    <el-tag :type="row.proc_type === 'API' ? 'success' : 'warning'">
                        {{ row.proc_type }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="database" label="数据库" width="120" />
            <el-table-column prop="schema" label="Schema" width="100" />
            <el-table-column prop="owner" label="负责人" width="100" />
            <el-table-column label="接口地址" width="220">
                <template #default="{ row }">
                    <span v-if="row.proc_type === 'API'">{{ row.api_uri || '-' }}</span>
                    <span v-else>-</span>
                </template>
            </el-table-column>

            <el-table-column label="调度周期" width="120">
                <template #default="{ row }">
                    <span v-if="row.proc_type === 'ETL'">{{ row.schedule || '-' }}</span>
                    <span v-else>-</span>
                </template>
            </el-table-column>
            <el-table-column prop="score" label="评分" width="100">
                <template #default="{ row }">
                    <el-rate :model-value="row.score" disabled />
                </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
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

// 筛选条件
const searchText = ref('')
const selectedType = ref('')
const selectedDb = ref('')
const selectedSchema = ref('')
const selectedOwner = ref('')

// 模拟元数据
const dbList = ['db1', 'db2']
const schemaList = ['public', 'etl']
const owners = ['张三', '李四']

const procedures = ref([
    {
        proc_name: 'p_get_user_info',
        alias: '获取用户信息',
        proc_type: 'API',
        database: 'db1',
        schema: 'public',
        owner: '张三',
        api_uri: '/api/user/info',
        score: 4.8,
    },
    {
        proc_name: 'p_load_user_order',
        alias: '加载用户订单',
        proc_type: 'ETL',
        database: 'db2',
        schema: 'etl',
        owner: '李四',
        schedule: '每日 02:00',
        score: 4.2,
    },
])

const filteredProcedures = computed(() => {
    return procedures.value.filter((p) => {
        const matchText = !searchText.value || p.proc_name.includes(searchText.value) || p.alias.includes(searchText.value)
        const matchType = !selectedType.value || p.proc_type === selectedType.value
        const matchDb = !selectedDb.value || p.database === selectedDb.value
        const matchSchema = !selectedSchema.value || p.schema === selectedSchema.value
        const matchOwner = !selectedOwner.value || p.owner === selectedOwner.value
        return matchText && matchType && matchDb && matchSchema && matchOwner
    })
})

// 跳转逻辑
const viewDetail = (row) => {
    router.push({ name: 'ProcedureDetail', params: { name: row.proc_name } })
}

</script>

<style scoped>
.procedure-asset-overview {
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
    width: 140px;
}
</style>
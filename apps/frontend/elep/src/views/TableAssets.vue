<template>
    <div class="table-asset-overview">
        <el-form :inline="true" :model="filters" class="mb-4">
            <el-form-item label="关键词">
                <el-input v-model="filters.keyword" placeholder="表名 / 描述" clearable />
            </el-form-item>
            <el-form-item label="数据库">
                <el-select v-model="filters.dataSource" placeholder="全部" clearable>
                    <el-option v-for="item in optionLists.dataSources" :key="item" :label="item" :value="item" />
                </el-select>
            </el-form-item>
            <el-form-item label="Schema">
                <el-select v-model="filters.schema" placeholder="全部" clearable>
                    <el-option v-for="item in optionLists.schemas" :key="item" :label="item" :value="item" />
                </el-select>
            </el-form-item>
            <el-form-item label="分层">
                <el-select v-model="filters.layer" placeholder="全部" clearable>
                    <el-option v-for="item in optionLists.layers" :key="item" :label="item" :value="item" />
                </el-select>
            </el-form-item>
            <el-form-item>
                <el-button type="primary" @click="loadTables">搜索</el-button>
                <el-button @click="resetFilters">重置</el-button>
                <el-button type="success" @click="exportAll" :disabled="tableList.length === 0">导出</el-button>
            </el-form-item>
        </el-form>
        <el-button type="primary" @click="handleExport">导出 Excel</el-button>

        <!-- 表格区域 -->
        <el-table :data="tableList" stripe border size="small" v-loading="loading">
            <el-table-column prop="uuid" label="uuid" width="270" />
            <el-table-column prop="table_name" label="表名" width="180" />
            <el-table-column prop="table_alias" label="中文名" width="180" />
            <el-table-column prop="database" label="数据库" width="120" />
            <el-table-column prop="schema" label="Schema" width="120" />
            <el-table-column prop="table_layer" label="分层" width="100" />
            <el-table-column prop="field" label="领域" width="100" />
            <el-table-column prop="tags" label="标签" width="180">
                <template #default="{ row }">
                    <el-tag v-for="tag in row.tags" :key="tag" class="tag" size="small" type="info">
                        {{ tag }}
                    </el-tag>
                </template>
            </el-table-column>

            <el-table-column label="操作" fixed="right" width="140">
                <template #default="scope">
                    <el-button type="primary" size="small" @click="viewDetail(scope.row)">
                        详情
                    </el-button>
                </template>
            </el-table-column>
        </el-table>
        <!-- 分页 -->
        <div class="text-right mt-4">
            <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize"
                :total="pagination.total" layout="prev, pager, next, jumper" @current-change="loadTables" />
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
const router = useRouter()



const loading = ref(false)
const filters = reactive({ keyword: '', dataSource: '', schema: '', layer: '' })
const optionLists = reactive({ dataSources: [], schemas: [], layers: [] })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const tableList = ref([])

const loadOptions = async () => {
    const res = await window.dbAPI.tableDistinctOptions()
    console.log(res)
    optionLists.dataSources = res.dataSources
    optionLists.schemas = res.schemas
    optionLists.layers = res.layers
}
async function handleExport() {
    const result = await window.electronAPI.invoke('export-excel', {
        list: data,
        headers
    })

    if (result.success) {
        ElMessage.success('导出成功: ' + result.path)
    } else {
        ElMessage.warning('导出失败: ' + result.message)
    }
}
const loadTables = async () => {
    loading.value = true
    try {
        let res = await window.dbAPI.tableQueryAll({
            filters: {
                keyword: filters.keyword,
                dataSource: filters.dataSource,
                schema: filters.schema,
                layer: filters.schema,
            },
            page: pagination.page,
            pageSize: pagination.pageSize,
        })
        tableList.value = res.data
        pagination.total = res.total
    } catch (e) {
        ElMessage.error('加载失败', e)
    } finally {
        loading.value = false
    }
}

const resetFilters = () => {
    filters.keyword = ''
    filters.dataSource = ''
    filters.schema = ''
    filters.layer = ''
    pagination.page = 1
    loadTables()
}


const viewDetail = (row) => {
    router.push({ name: 'tableDetail', params: { id: row.id } })
}
const exportAll = async () => {
    const result = await window.dbAPI.exportToFile({ ...filters })
    if (result) {
        ElMessage.success('导出成功：' + result)
    } else {
        ElMessage.warning('取消导出')
    }
}

onMounted(() => {
    loadOptions()
    loadTables()
})
</script>

<style scoped>
.table-asset-overview {
    padding: 20px;
}

.filter-bar {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 20px;
}

.filter-input {
    width: 200px;
}

.filter-select {
    width: 140px;
}

.tag {
    margin-right: 4px;
}
</style>
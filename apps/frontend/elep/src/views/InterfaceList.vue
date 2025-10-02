<template>
    <div class="p-4 space-y-4">
        <!-- Filters -->
        <el-form :inline="true" :model="f" @keyup.enter="fetch">
            <el-form-item label="接口名称">
                <el-input v-model="f.nameLike" placeholder="模糊搜索" />
            </el-form-item>
            <el-form-item label="路由">
                <el-input v-model="f.routeLike" placeholder="模糊搜索" />
            </el-form-item>
            <el-form-item label="接口地址">
                <el-input v-model="f.urlLike" placeholder="模糊搜索" />
            </el-form-item>
            <el-form-item label="实现">
                <el-select v-model="f.impl" placeholder="全部" clearable>
                    <el-option label="Java" value="java" />
                    <el-option label=".NET" value="netCore" />
                </el-select>
            </el-form-item>
            <el-form-item label="领域">
                <el-select v-model="f.domain" placeholder="全部" clearable>
                    <el-option v-for="d in domains" :key="d" :label="d" :value="d" />
                </el-select>
            </el-form-item>
            <el-form-item label="认证">
                <el-select v-model="f.authType" placeholder="全部" clearable>
                    <el-option v-for="a in authTypes" :key="a" :label="a" :value="a" />
                </el-select>
            </el-form-item>
            <el-form-item>
                <el-button type="primary" @click="fetch">查询</el-button>
                <el-button @click="reset">重置</el-button>
            </el-form-item>
        </el-form>

        <!-- Table -->
        <el-table :data="list" border height="calc(100vh - 260px)" @row-dblclick="toDetail">
            <el-table-column prop="route_id" label="Route ID" width="120" />
            <el-table-column prop="route_name" label="路由名称" min-width="160" />
            <el-table-column label="API ID">
                <template #default="{ row }">
                    <span v-if="row.prod_api_id === row.test_api_id">{{ row.prod_api_id }}</span>
                    <span v-else>
                        <el-tag type="danger">测试:{{ row.test_api_id || '—' }}</el-tag>
                        <el-tag type="success">生产:{{ row.prod_api_id || '—' }}</el-tag>
                    </span>
                </template>
            </el-table-column>
            <el-table-column label="接口名称">
                <template #default="{ row }">
                    <span v-if="row.prod_name === row.test_name">{{ row.prod_name }}</span>
                    <span v-else>
                        <el-tag type="danger">测试:{{ row.test_name || '—' }}</el-tag>
                        <el-tag type="success">生产:{{ row.prod_name || '—' }}</el-tag>
                    </span>
                </template>
            </el-table-column>
            <el-table-column label="接口地址">
                <template #default="{ row }">
                    <div>测试: {{ row.test_url || '—' }}</div>
                    <div>生产: {{ row.prod_url || '—' }}</div>
                </template>
            </el-table-column>
            <el-table-column prop="impl" label="实现" width="90" />
            <el-table-column prop="domain" label="领域" width="120" />
            <el-table-column prop="auth_type" label="认证" width="100" />
            <el-table-column label="描述">
                <template #default="{ row }">
                    <span v-if="row.prod_name === row.test_name">{{ row.description }}</span>
                    <span v-else>
                        <el-tag type="danger">测试:{{ row.description }}</el-tag>
                        <el-tag type="success">生产:{{ row.description }}</el-tag>
                    </span>
                </template>
            </el-table-column>
        </el-table>

        <!-- Pagination -->
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50]"
            :total="total" layout="total, sizes, prev, pager, next, jumper" @size-change="fetch"
            @current-change="fetch" />
    </div>
</template>


<script setup>
import { ref, onMounted } from 'vue'
import { queryApiListByRoute } from '../services/interfaceApi'
import { useRouter } from 'vue-router'

const f = ref({
    nameLike: '', routeLike: '', urlLike: '',
    impl: '', domain: '', authType: ''
})
const page = ref(1)
const pageSize = ref(20)
const list = ref([])
const total = ref(0)
const domains = ['用户中心', '订单系统', '支付系统']
const authTypes = ['OAuth2', 'Token', 'None']
const router = useRouter()

async function fetch() {
    const { list: rows, total: cnt } = await queryApiListByRoute({ ...f.value, page: page.value, pageSize: pageSize.value })
    list.value = rows
    total.value = cnt
}
function reset() {
    Object.assign(f.value, { nameLike: '', routeLike: '', urlLike: '', impl: '', domain: '', authType: '' })
    fetch()
}

function toDetail(row) {
    router.push({ name: 'InterfaceDetail', params: { route_id: row.route_id } })
}


onMounted(fetch)
</script>

<!-- 
<script setup>
import { ref, onMounted } from 'vue'
import { queryApiListByRoute, getDomainList, getAuthTypes } from '../services/interfaceApi'
import { useRouter } from 'vue-router'

const router = useRouter()
const filters = ref({ name: '', url: '', impl: '', domain: '', authType: '', desc: '' })
const data = ref([])
const domains = ref([])
const authTypes = ref([])

async function fetchList() {
    data.value = await queryApiListByRoute({
        page: 1,
        pageSize: 10,
        nameLike: '',
        routeLike: '',
        urlLike: '',
        domain: '',
        authType: '',
        impl: '',
    })

    console.log(data.value)
}

function handleSearch() {
    fetchList()
}

function resetFilters() {
    filters.value = { name: '', url: '', impl: '', domain: '', authType: '', desc: '' }
    fetchList()
}

function toDetail(row) {
    router.push({ name: 'InterfaceDetail', params: { id: row.id } })
}

onMounted(async () => {
    domains.value = await getDomainList()
    authTypes.value = await getAuthTypes()
    fetchList()
})
</script>

<style scoped>
/* minimal styling */
</style> -->
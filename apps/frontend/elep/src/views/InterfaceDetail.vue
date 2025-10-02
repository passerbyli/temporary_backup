<template>
    <div class="p-6 space-y-6">
        <el-page-header @back="$router.back()" content="接口详情对比" />

        <!-- 基本信息 -->
        <el-descriptions v-if="prod || test" border :column="2">
            <el-descriptions-item label="API ID">
                <DiffField :prod="prod?.api_id" :test="test?.api_id" />
            </el-descriptions-item>
            <el-descriptions-item label="接口名称">
                <DiffField :prod="prod?.name" :test="test?.name" />
            </el-descriptions-item>
            <el-descriptions-item label="接口地址" :span="2">
                <DiffField :prod="prod?.url" :test="test?.url" />
            </el-descriptions-item>
            <el-descriptions-item label="接口描述" :span="2">
                <DiffField :prod="prod?.description" :test="test?.description" />
            </el-descriptions-item>
        </el-descriptions>

        <!-- 入参定义 -->
        <el-card header="入参定义" v-if="mergedInput.length">
            <el-table :data="mergedInput" border>
                <el-table-column prop="name" label="字段名">
                    <template #default="{ row }">
                        {{ row.name }}
                        <el-tag type="danger" v-if="!row.prod">测试</el-tag>
                        <el-tag type="success" v-if="!row.test">生产</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="类型">
                    <template #default="{ row }">
                        {{ row.test?.type || row.prod?.type || '-' }}
                    </template>
                </el-table-column>
                <el-table-column label="必填" width="80">
                    <template #default="{ row }">
                        {{ row.test?.required ?? row.prod?.required ?? '-' }}
                    </template>
                </el-table-column>
                <el-table-column label="描述">
                    <template #default="{ row }">
                        {{ row.test?.desc || row.prod?.desc || '-' }}
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <!-- 出参定义 -->
        <el-card header="出参定义" v-if="mergedOutput.length">
            <el-table :data="mergedOutput" border>
                <el-table-column prop="name" label="字段名">
                    <template #default="{ row }">
                        {{ row.name }}
                        <el-tag type="danger" v-if="!row.prod">测试</el-tag>
                        <el-tag type="success" v-if="!row.test">生产</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="类型">
                    <template #default="{ row }">
                        {{ row.test?.type || row.prod?.type || '-' }}
                    </template>
                </el-table-column>
                <el-table-column label="描述">
                    <template #default="{ row }">
                        {{ row.test?.desc || row.prod?.desc || '-' }}
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <!-- 后端脚本 -->
        <el-card header="后端脚本" v-if="showScript">
            <SideBySideDiff :left="test?.backend_script" :right="prod?.backend_script" />
        </el-card>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getApiDetailByRouteId } from '@/services/interfaceApi'
import DiffField from './DiffText.vue'
import SideBySideDiff from './SideBySideDiff.vue'

const route = useRoute()
const rid = route.params.route_id

const prod = ref(null)
const test = ref(null)

function mergeParams(prodArr = [], testArr = []) {
    const map = new Map()
    prodArr.forEach(p => map.set(p.name, { name: p.name, prod: p }))
    testArr.forEach(t => {
        if (!map.has(t.name)) map.set(t.name, { name: t.name })
        map.get(t.name).test = t
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const mergedInput = computed(() => mergeParams(prod.value?.input_params, test.value?.input_params))
const mergedOutput = computed(() => mergeParams(prod.value?.output_params, test.value?.output_params))
const showScript = computed(() => prod.value?.backend_script || test.value?.backend_script)

onMounted(async () => {
    const res = await getApiDetailByRouteId(rid)
    prod.value = res?.prod || null
    test.value = res?.test || null
})
</script>

<style scoped>
.el-tag+.el-tag {
    margin-left: 4px;
}
</style>
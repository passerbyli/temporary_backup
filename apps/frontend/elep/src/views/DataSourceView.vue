<template>
    <el-card>
        <div style="margin-bottom: 12px">
            <el-button type="primary" @click="openAdd">新增数据源</el-button>
        </div>

        <el-table :data="sources" style="width: 100%">
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="type" label="类型" />
            <el-table-column prop="host" label="主机" />
            <el-table-column prop="port" label="端口" />
            <el-table-column fixed="right" label="操作" width="160">
                <template #default="{ row, $index }">
                    <el-button @click="edit(row, $index)" size="mini">编辑</el-button>
                    <el-button @click="remove($index)" size="mini" type="danger">删除</el-button>
                </template>
            </el-table-column>
        </el-table>


        <el-dialog v-model="showDialog" :title="dialogTitle" width="500px">
            <el-form :model="form" label-width="80px">
                <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
                <el-form-item label="类型">
                    <el-select v-model="form.type">
                        <el-option label="MySQL" value="MySQL" />
                        <el-option label="PostgreSQL" value="PostgreSQL" />
                    </el-select>
                </el-form-item>
                <el-form-item label="主机"><el-input v-model="form.host" /></el-form-item>
                <el-form-item label="端口"><el-input-number v-model="form.port" :min="1" /></el-form-item>
                <el-form-item label="用户名"><el-input v-model="form.username" /></el-form-item>
                <el-form-item label="密码"><el-input v-model="form.password" type="password" /></el-form-item>
                <el-form-item label="数据库"><el-input v-model="form.database" /></el-form-item>
            </el-form>

            <template #footer>
                <el-button @click="test">测试连接</el-button>
                <el-button @click="showDialog = false">取消</el-button>
                <el-button type="primary" @click="save">保存</el-button>
            </template>
        </el-dialog>
    </el-card>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { listSources, saveSources, testSource } from '@/services/dataSourceService'
import { ElMessage } from 'element-plus'

const sources = ref([])
const form = reactive({ name: '', type: '', host: '', port: 3306, username: '', password: '', database: '' })
const editingIndex = ref(-1)
const showDialog = ref(false)
const dialogTitle = ref('新增数据源')
onMounted(async () => {
    sources.value = await listSources()
})

function save() {
    if (!form.name || !form.host) {
        ElMessage.warning('请填写完整信息')
        return
    }

    if (editingIndex.value >= 0) {
        sources.value.splice(editingIndex.value, 1, { ...form })
        editingIndex.value = -1
    } else {
        sources.value.push({ ...form })
    }

    saveSources(sources.value).then(() => {
        ElMessage.success('已保存')
        showDialog.value = false
        reset()
    })
}

function openAdd() {
    dialogTitle.value = '新增数据源'
    reset()
    showDialog.value = true
}

function edit(row, index) {
    dialogTitle.value = '编辑数据源'
    Object.assign(form, row)
    editingIndex.value = index
    showDialog.value = true
}

function remove(index) {
    sources.value.splice(index, 1)
    saveSources(sources.value)
    ElMessage.success('已删除')
}

function reset() {
    Object.assign(form, { name: '', type: '', host: '', port: 3306, username: '', password: '', database: '' })
    editingIndex.value = -1
}

async function test() {
    const result = await testSource(form)
    if (result.success) {
        ElMessage.success(result.message)
    } else {
        ElMessage.error(result.message)
    }
}
</script>
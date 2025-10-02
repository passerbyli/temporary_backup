<template>
    <div class="export-page p-6">
        <!-- 顶部工具栏 -->
        <div class="toolbar flex justify-between items-center mb-6">
            <div class="flex items-center gap-4">
                <el-button type="primary" @click="dialogVisible = true">配置数据源</el-button>
                <el-select v-model="selectedDb" placeholder="选择数据库" style="width: 220px">
                    <el-option v-for="db in dbList" :key="db.id" :label="db.name" :value="db.id" />
                </el-select>
            </div>
        </div>

        <!-- 主操作区域 -->
        <el-card class="mb-6">
            <el-form label-width="100px">
                <el-form-item label="操作类型">
                    <el-radio-group v-model="mode">
                        <el-radio-button label="insert">Insert</el-radio-button>
                        <el-radio-button label="update">Update</el-radio-button>
                    </el-radio-group>
                </el-form-item>

                <el-form-item label="表名">
                    <el-input v-model="tableName" placeholder="请输入表名" />
                </el-form-item>

                <el-form-item label="记录 ID">
                    <el-input v-model="recordId" placeholder="请输入记录主键值" />
                </el-form-item>
            </el-form>
        </el-card>

        <!-- 底部操作 -->
        <div class="text-center">
            <el-button type="success" size="large" @click="handleExport" :disabled="!selectedDb || !tableName">
                导出 SQL
            </el-button>
        </div>

        <!-- 配置弹窗 -->
        <el-dialog title="配置 MySQL 数据源" v-model="dialogVisible" width="500px">
            <el-form :model="dbForm" label-width="100px">
                <el-form-item label="名称">
                    <el-input v-model="dbForm.name" />
                </el-form-item>
                <el-form-item label="地址">
                    <el-input v-model="dbForm.host" />
                </el-form-item>
                <el-form-item label="端口">
                    <el-input v-model="dbForm.port" />
                </el-form-item>
                <el-form-item label="用户名">
                    <el-input v-model="dbForm.user" />
                </el-form-item>
                <el-form-item label="密码">
                    <el-input v-model="dbForm.password" show-password />
                </el-form-item>
                <el-form-item label="数据库">
                    <el-input v-model="dbForm.database" />
                </el-form-item>
            </el-form>

            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" @click="handleSaveDb">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const dialogVisible = ref(false)
const selectedDb = ref('')
const mode = ref('insert')
const tableName = ref('')
const recordId = ref('')

// 模拟数据源列表
const dbList = ref([
    { id: 'db1', name: '测试数据库1' },
    { id: 'db2', name: '生产库A' }
])

const dbForm = ref({
    name: '',
    host: '',
    port: '3306',
    user: '',
    password: '',
    database: ''
})

const handleSaveDb = () => {
    if (!dbForm.value.name || !dbForm.value.host) {
        ElMessage.warning('请填写必要信息')
        return
    }
    dbList.value.push({
        id: `db${Date.now()}`,
        name: dbForm.value.name,
        ...dbForm.value
    })
    ElMessage.success('数据源已保存')
    dialogVisible.value = false
}

const handleExport = () => {
    const sql =
        mode.value === 'insert'
            ? `INSERT INTO ${tableName.value} (...) VALUES (...);`
            : `UPDATE ${tableName.value} SET ... WHERE id = '${recordId.value}';`
    console.log('导出的 SQL:', sql)
    ElMessage.success('SQL 已生成，控制台查看')
}
</script>

<style scoped>
.export-page {
    max-width: 800px;
    margin: 0 auto;
}
</style>
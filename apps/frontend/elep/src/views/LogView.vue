<template>
    <div class="log-table-viewer">
        <h2>日志查看（表格 + 过滤 + 出入参）</h2>
        <div style="margin-bottom: 10px">
            <el-date-picker v-model="selectedDate" type="date" format="YYYY-MM-DD" @change="loadData" />
            <el-button @click="loadData" style="margin-left: 10px">刷新</el-button>

            <el-input v-model="keyword" placeholder="关键词过滤（URL、标签、错误）" style="margin-left: 20px; width: 300px"
                clearable />
        </div>

        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[10, 50, 100]"
            layout="total, prev, pager, next" :total="total" @size-change="handleSizeChange"
            @current-change="handleCurrentChange" />
        <el-table :data="filteredLogs" style="width: 100%" max-height="450" border stripe row-key="time">
            <el-table-column type="index" :index="indexMethod" />
            <el-table-column prop="time" label="时间" width="180" />
            <el-table-column prop="type" label="类型" width="120" />
            <el-table-column prop="tag" label="标签" width="150" />
            <el-table-column prop="method" label="方法" width="80" />
            <el-table-column prop="url" label="URL" />
            <el-table-column prop="status" label="状态码" width="100" />
            <el-table-column prop="error" label="错误信息" />
        </el-table>
        <el-alert v-if="error" type="error" :closable="false" :title="error" />
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { sysReadLogs } from '../services/configService'

const selectedDate = ref(new Date())
const logList = ref([])
const error = ref('')
const keyword = ref('')
const currentPage = ref(1)
const total = ref(0)
const pageSize = ref(10)
const formatDate = (date) => date.toISOString().split('T')[0]
const allList = ref([])
const indexMethod = (index) => {
    return index + 1
}
const handleSizeChange = (val) => {
    pageSize.value = val

    currentPage.value = 1
    logList.value = allList.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * (pageSize.value))
}
const handleCurrentChange = (val) => {
    currentPage.value = val
    logList.value = allList.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * (pageSize.value))
}

const loadData = async () => {
    error.value = ''
    logList.value = []
    sysReadLogs({ date: formatDate(selectedDate.value) }).then(res => {
        if (res.success) {
            total.value = res.data.length
            allList.value = res.data
            logList.value = allList.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * (pageSize.value))
        } else {
            error.value = res.message
        }
    })

}


// 搜索过滤（模糊匹配）
const filteredLogs = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    if (!kw) return logList.value

    return logList.value.filter(log =>
        log.url?.toLowerCase().includes(kw) ||
        log.tag?.toLowerCase().includes(kw) ||
        log.error?.toLowerCase().includes(kw)
    )
})

loadData()
</script>

<style scoped></style>
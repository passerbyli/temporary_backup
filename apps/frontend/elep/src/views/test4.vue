<template>
    <div class="p-4 space-y-4">
        <el-button type="primary" @click="handleSelect">选择 SQL 或 JSON 文件</el-button>

        <el-input v-model="replaceFrom" placeholder="要替换的内容" />
        <el-input v-model="replaceTo" placeholder="替换成的内容" />
{{ filePath }}
        <el-button type="success" @click="handleReplace" :disabled="!fileContent">
            替换并保存
        </el-button>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const fileContent = ref('')
const filePath = ref('')
const replaceFrom = ref('')
const replaceTo = ref('')

const handleSelect = async () => {

    window.ipc.sendInvoke('toMain', { event: 'selectFile' }).then(result =>{
        if (result) {
            filePath.value = result.filePath
            fileContent.value = result.content
            ElMessage.success('文件读取成功')
        } else {
            ElMessage.warning('文件选择取消')
        }
    })
}

const handleReplace = async () => {
    if (!replaceFrom.value) {
        ElMessage.warning('请输入替换内容')
        return
    }

    const newContent = fileContent.value.replaceAll(replaceFrom.value, replaceTo.value)
    const savedPath = await window.electronAPI.saveFile({
        originalPath: filePath.value,
        newContent
    })

    if (savedPath) {
        ElMessage.success(`已保存新文件：${savedPath}`)
    } else {
        ElMessage.warning('未保存文件')
    }
}
</script>
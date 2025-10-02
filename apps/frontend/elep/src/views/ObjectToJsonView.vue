<template>
    <div class="object-json-tool">
        <el-tabs v-model="activeTab" type="border-card">
            <!-- Tab 1: JS 对象转 JSON -->
            <el-tab-pane label="JS对象 ➝ JSON" name="js2json">
                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-card header="输入 JS 对象">
                            <el-input type="textarea" v-model="jsInput" :rows="18"
                                placeholder="请输入 JS 对象，如：{ name: '张三', age: 18 }" />
                            <el-button type="primary" style="margin-top: 10px" @click="convertJs">转换为 JSON</el-button>
                        </el-card>
                    </el-col>
                    <el-col :span="12">
                        <el-card header="输出 JSON">
                            <el-input type="textarea" v-model="jsOutput" :rows="18" readonly />
                            <el-button style="margin-top: 10px" @click="copy(jsOutput)">复制结果</el-button>
                        </el-card>
                    </el-col>
                </el-row>
            </el-tab-pane>

            <!-- Tab 2: JSON 排序 -->
            <el-tab-pane label="JSON字段排序" name="sortjson">
                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-card header="输入 JSON 字符串">
                            <el-input type="textarea" v-model="jsonInput" :rows="18"
                                placeholder='请输入合法 JSON，如：{"z":1,"a":2}' />
                            <el-button type="primary" style="margin-top: 10px" @click="sortJson">排序</el-button>
                        </el-card>
                    </el-col>
                    <el-col :span="12">
                        <el-card header="排序后的 JSON">
                            <el-input type="textarea" v-model="jsonSorted" :rows="18" readonly />
                            <el-button style="margin-top: 10px" @click="copy(jsonSorted)">复制结果</el-button>
                        </el-card>
                    </el-col>
                </el-row>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { parseJsObjectToJson } from '../utils/parseJsObjectToJson'

const activeTab = ref('js2json')

// Tab1
const jsInput = ref('')
const jsOutput = ref('')

function convertJs() {
    try {
        jsOutput.value = parseJsObjectToJson(jsInput.value, false)
        ElMessage.success('转换成功')
    } catch (err) {
        ElMessage.error(err.message)
        jsOutput.value = ''
    }
}

// Tab2
const jsonInput = ref('')
const jsonSorted = ref('')

function sortJson() {
    try {
        const obj = JSON.parse(jsonInput.value)
        const sorted = deepSortObject(obj)
        jsonSorted.value = JSON.stringify(sorted, null, 2)
        ElMessage.success('排序成功')
    } catch (err) {
        ElMessage.error('JSON 格式错误：' + err.message)
    }
}

// 通用
function copy(text) {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
        ElMessage.success('已复制到剪贴板')
    })
}

// 递归排序
function deepSortObject(obj) {
    if (Array.isArray(obj)) return obj.map(deepSortObject)
    if (obj && typeof obj === 'object') {
        return Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = deepSortObject(obj[key])
            return acc
        }, {})
    }
    return obj
}
</script>

<style scoped>
.object-json-tool {
    padding: 20px;
}
</style>
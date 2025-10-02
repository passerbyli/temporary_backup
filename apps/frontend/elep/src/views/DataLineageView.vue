<template>
    <el-button @click="selectFolder">选择文件夹</el-button>
    <p>绝对路径：{{ path }}</p>
    <el-button type="" v-if="path" @click="analysisBtn">分析</el-button>
    <p v-if="outputPath">{{ outputPath }}</p>
    <div id="table-graph" class="w-full h-full"></div>
</template>

<script>
import { defineComponent, toRefs, reactive, ref, onMounted } from 'vue'
import * as G6 from '@antv/g6'

export default defineComponent({
    name: 'DataLineageView',
    setup() {
        onMounted(() => {

        })
        const path = ref('/Users/lihaomin/projects/GitHub/test/scripts/sqlParse/data')
        const outputPath = ref('')
        const selectFolder = async () => {

        }

        const dataMap = reactive({
            analysisBtn: async () => {

            },
            selectFolder,
            path,
            outputPath,
        })

        return {
            ...toRefs(dataMap),
        }
    },
})
</script>
<style scoped>
#table-graph {
    width: 100%;
    height: 100vh;
    background: #f5f5f5;
}
</style>

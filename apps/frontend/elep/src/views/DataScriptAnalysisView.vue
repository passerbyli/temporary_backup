<template>
    <div id="about">
        <el-row>
            <el-col :span="24">
                数据库：
                <el-select v-model="selectedDatabase" placeholder="请选择数据库" @change="loadTablesAndRoutines"
                    style="width: 200px">
                    <el-option v-for="db in databases" :key="db.Database" :label="db.Database"
                        :value="db.Database"></el-option>
                </el-select>
            </el-col>
        </el-row>

        <el-row>
            <el-col :span="12">
                <p>Table</p>
                <el-select v-model="selectedTable" placeholder="请选择数据库" @change="loadTableData" style="width: 200px">
                    <el-option v-for="table in tables" :key="table" :label="table" :value="table"></el-option>
                </el-select>
            </el-col>

            <el-col :span="12">
                <p>Procedure</p>
                <el-select v-model="selectedProcedure" placeholder="请选择数据库" @change="loadProcedureDefinition"
                    style="width: 200px">
                    <el-option v-for="routine in routines" :key="routine" :label="routine" :value="routine"></el-option>
                </el-select>
            </el-col>
        </el-row>

        <div v-if="tableData.length">
            <h3>数据</h3>
            <el-table :data="tableData">
                <el-table-column v-for="(header, index) in tableHeaders" :key="index" :label="header" :prop="header" />
            </el-table>
        </div>

        <div v-if="procedureDefinition">
            <h3>存储过程内容</h3>
            <pre>{{ procedureDefinition }}</pre>
        </div>
    </div>
</template>

<script>
import { defineComponent, ref, onMounted, toRefs, reactive } from 'vue'

export default defineComponent({
    setup() {
        // 获取数据库列表
        const loadDatabases = async () => {

        }

        // 获取表列表和存储过程列表
        const loadTablesAndRoutines = async () => {
            if (!selectedDatabase.value) return


        }

        // 获取表数据
        const loadTableData = async (table) => {

        }

        // 获取存储过程内容
        const loadProcedureDefinition = async (proc) => {

        }

        onMounted(() => {
            loadDatabases()
        })

        const databases = ref([])
        const tables = ref([])
        const routines = ref([])
        const selectedDatabase = ref('')
        const selectedTable = ref('')
        const selectedProcedure = ref('')

        const tableData = ref([])
        const tableHeaders = ref([])
        const procedureDefinition = ref('')

        const dataMap = reactive({
            databases,
            tables,
            routines,
            selectedDatabase,
            selectedTable,
            selectedProcedure,
            tableData,
            tableHeaders,
            procedureDefinition,
            loadTablesAndRoutines,
            loadTableData,
            loadProcedureDefinition,
        })

        return {
            ...toRefs(dataMap),
        }
    },
})
</script>

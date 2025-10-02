<template>
    <el-card class="procedure-detail">
        <template #header>
            <div class="card-header">
                <span>{{ procedure?.proc_name }}（{{ procedure?.alias }}）</span>
                <el-button type="primary" @click="goBack">返回</el-button>
            </div>
        </template>

        <el-tabs v-model="activeTab" v-if="procedure">
            <!-- 基本信息 -->
            <el-tab-pane label="基本信息" name="info">
                <el-descriptions title="过程信息" :column="2" border>
                    <el-descriptions-item label="过程名">{{ procedure.proc_name }}</el-descriptions-item>
                    <el-descriptions-item label="别名">{{ procedure.alias }}</el-descriptions-item>
                    <el-descriptions-item label="类型">
                        <el-tag :type="procedure.proc_type === 'API' ? 'success' : 'warning'">
                            {{ procedure.proc_type }}
                        </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="数据库">{{ procedure.database }}</el-descriptions-item>
                    <el-descriptions-item label="Schema">{{ procedure.schema }}</el-descriptions-item>
                    <el-descriptions-item label="分层">{{ procedure.layer }}</el-descriptions-item>
                    <el-descriptions-item label="负责人">{{ procedure.owner }}</el-descriptions-item>
                    <el-descriptions-item label="评分">
                        <el-rate :model-value="procedure.score" disabled show-score />
                    </el-descriptions-item>
                    <el-descriptions-item label="标签">
                        <el-tag v-for="tag in procedure.tags" :key="tag" type="info" class="tag">
                            {{ tag }}
                        </el-tag>
                    </el-descriptions-item>

                    <!-- 类型特有信息 -->
                    <el-descriptions-item v-if="procedure.proc_type === 'API'" label="接口地址">
                        {{ procedure.api_uri || '无' }}
                    </el-descriptions-item>
                    <el-descriptions-item v-if="procedure.proc_type === 'ETL'" label="调度周期">
                        {{ procedure.schedule || '无' }}
                    </el-descriptions-item>
                    <el-descriptions-item v-if="procedure.proc_type === 'ETL'" label="调度任务">
                        {{ procedure.schedule_job || '无' }}
                    </el-descriptions-item>
                </el-descriptions>

                <!-- 参数 -->
                <el-divider>参数列表</el-divider>
                <el-table :data="procedure.params" size="small" border>
                    <el-table-column prop="name" label="参数名" />
                    <el-table-column prop="type" label="数据类型" />
                    <el-table-column prop="direction" label="方向" />
                    <el-table-column prop="description" label="描述" />
                </el-table>

                <!-- 输出字段（仅 API 类型） -->
                <template v-if="procedure.proc_type === 'API'">
                    <el-divider>输出字段结构</el-divider>
                    <el-table :data="procedure.output_fields || []" size="small" border>
                        <el-table-column prop="name" label="字段名" />
                        <el-table-column prop="type" label="类型" />
                        <el-table-column prop="description" label="描述" />
                    </el-table>
                </template>
            </el-tab-pane>

            <!-- SQL 定义 -->
            <el-tab-pane label="SQL 定义" name="sql">
                <CopyableTextarea :content="procedure.definition" label="" height="280px" />
            </el-tab-pane>

            <!-- 血缘图 -->
            <el-tab-pane label="血缘关系" name="lineage">
                <div id="lineage-container" class="lineage-container">
                    <p style="color: #999;">[此处接入血缘图组件]</p>
                </div>
            </el-tab-pane>

            <!-- 版本记录 -->
            <el-tab-pane label="版本记录" name="version">
                <el-table :data="procedure.versions" border size="small">
                    <el-table-column prop="version_no" label="版本号" width="100" />
                    <el-table-column prop="create_time" label="创建时间" />
                    <el-table-column prop="created_by" label="创建人" />
                    <el-table-column label="对比">
                        <template #default="{ row }">
                            <el-checkbox v-model="compareSelection" :label="row.version_no"
                                :disabled="compareSelection.length >= 2 && !compareSelection.includes(row.version_no)" />
                        </template>
                    </el-table-column>
                </el-table>
                <el-button type="primary" class="mt-3" :disabled="compareSelection.length !== 2"
                    @click="compareVersions">
                    对比选中版本
                </el-button>

                <div v-if="diffResult" class="diff-result">
                    <el-divider>版本差异</el-divider>
                    <pre class="sql-diff">{{ diffResult }}</pre>
                </div>
            </el-tab-pane>
        </el-tabs>

        <el-empty v-else description="加载中..." />
    </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
// import axios from 'axios'

const route = useRoute()
const router = useRouter()
const procName = route.params.procName

import CopyableTextarea from '../components/CopyableTextarea.vue'
const procedure = ref(null)
const activeTab = ref('info')
const compareSelection = ref([])
const diffResult = ref('')

// 加载存储过程详情
const loadProcedureDetail = async () => {
    try {
        // const res = await axios.get(`/api/procedure/detail?name=${procName}`)
        const res = {
            data: {
                "proc_name": "p_get_user_info",
                "alias": "获取用户信息",
                "proc_type": "ETL",
                "database": "db1",
                "schema": "public",
                "layer": "DWD",
                "owner": "张三",
                "tags": ["核心", "接口"],
                "score": 4.6,
                "api_uri": "/api/user/info",
                "schedule": null,
                "schedule_job": null,
                "params": [{ "name": "user_id", "type": "INT", "direction": "IN", "description": "用户ID" }],
                "output_fields": [
                    { "name": "user_name", "type": "VARCHAR", "description": "用户名" },
                    { "name": "age", "type": "INT", "description": "年龄" }
                ],
                "definition": `CREATE OR REPLACE PROCEDURE ct_cms.etl_user_orders(target_date DATE)
      LANGUAGE plpgsql AS $$
      BEGIN
      -- 阶段1：在临时Schema中创建临时表
      CREATE TEMP TABLE tmp_raw_orders ON COMMIT DROP AS
      SELECT
      o.order_id,
      u.user_id,
      o.amount::NUMERIC(12,2) AS amount,
      o.order_time
      FROM ct_cms.orders o -- 源表带Schema‌:ml-citation{ref="6" data="citationList"}
      JOIN ct_cms.users u USING (user_id)
      WHERE o.order_date = target_date;

      -- 阶段2：使用多层WITH处理
      WITH user_stats AS (
      SELECT
      user_id,
      COUNT(*) AS order_count,
      SUM(amount) AS total_amount
      FROM tmp_raw_orders
      GROUP BY user_id
      ),
      latest_orders AS (
      SELECT DISTINCT ON (user_id)
      user_id,
      order_time AS last_order
      FROM tmp_raw_orders
      ORDER BY user_id, order_time DESC
      )
      truncate table ct_cms.user_orders_wide_a;
      -- 阶段3：写入目标Schema的物理表
      INSERT INTO ct_cms.user_orders_wide_a
      SELECT
      u.user_id,
      u.username,
      s.order_count,
      s.total_amount,
      l.last_order
      FROM ct_cms.users u -- 显式指定源Schema‌:ml-citation{ref="3" data="citationList"}
      LEFT JOIN user_stats s USING (user_id)
      LEFT JOIN latest_orders l USING (user_id)
      WHERE u.created_at <= target_date;
        public.p_rename_table('ct_cms','user_orders_wide_a','ct_cms','user_orders_wide') -- 清理临时表（ON COMMIT DROP自动处理）
        EXCEPTION WHEN others THEN RAISE NOTICE 'ETL失败: %' , SQLERRM; ROLLBACK; END; $$;
`,
                "versions": [
                    { "version_no": 1, "create_time": "2024-01-01", "created_by": "张三", "definition": "..." },
                    { "version_no": 2, "create_time": "2024-02-01", "created_by": "张三", "definition": "..." }
                ]
            }
        }
        procedure.value = res.data
    } catch (e) {
        ElMessage.error('加载失败')
    }
}

onMounted(loadProcedureDetail)


const compareVersions = () => {
    const [v1, v2] = compareSelection.value
    const def1 = procedure.value.versions.find(v => v.version_no === v1)?.definition || ''
    const def2 = procedure.value.versions.find(v => v.version_no === v2)?.definition || ''
    diffResult.value = generateLineDiff(def1, def2)
}

function generateLineDiff(a, b) {
    const aLines = a.split('\n')
    const bLines = b.split('\n')
    const maxLines = Math.max(aLines.length, bLines.length)
    const result = []

    for (let i = 0; i < maxLines; i++) {
        const lineA = aLines[i] || ''
        const lineB = bLines[i] || ''
        if (lineA !== lineB) {
            result.push(`- ${lineA}`)
            result.push(`+ ${lineB}`)
        } else {
            result.push(`  ${lineA}`)
        }
    }
    return result.join('\n')
}

const goBack = () => router.back()
</script>

<style scoped>
.procedure-detail {
    padding: 20px;
}

.card-header {
    display: flex;
    justify-content: space-between;
    font-weight: bold;
}

.sql-block {
    background: #f5f5f5;
    padding: 16px;
    white-space: pre-wrap;
    border-radius: 4px;
}

.sql-diff {
    background: #f0f9ff;
    padding: 10px;
    white-space: pre-wrap;
    border-left: 4px solid #409eff;
}

.lineage-container {
    height: 400px;
    border: 1px dashed #ccc;
    background-color: #fafafa;
    margin-top: 10px;
    padding: 10px;
}

.tag {
    margin-right: 4px;
}
</style>
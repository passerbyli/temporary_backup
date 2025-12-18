<template>
    <div class="p-4">
        <el-card shadow="never">
            <template #header>
                <div class="flex items-center justify-between">
                    <span>JSON → Excel</span>
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-gray">压缩(扁平化)</span>
                        <el-switch v-model="flatten" />
                    </div>
                </div>
            </template>

            <el-input v-model="jsonText" type="textarea" :rows="12"
                placeholder="粘贴 JSON：支持数组 [] 或对象 {}（若对象里包含数组，会自动找第一个数组）" />

            <div class="mt-3 flex gap-2">
                <el-button type="primary" :loading="working" @click="handleProcess">
                    开始处理
                </el-button>
                <el-button :disabled="!result" @click="downloadExcel">
                    下载 Excel
                </el-button>
                <el-button plain @click="fillDemo">示例</el-button>
                <el-button plain type="warning" @click="clearAll">清空</el-button>
            </div>

            <el-alert v-if="errorMsg" class="mt-3" type="error" show-icon :title="errorMsg" />

            <el-divider class="mt-3" />

            <div class="text-sm text-gray mb-2">
                预览（前 {{ previewLimit }} 行）｜行数：{{ result?.rows.length ?? 0 }}｜列数：{{ result?.columns.length ?? 0 }}
            </div>

            <el-table v-if="result" :data="result.rows.slice(0, previewLimit)" border height="420">
                <el-table-column v-for="c in result.columns" :key="c" :prop="c" :label="c" min-width="160"
                    show-overflow-tooltip />
            </el-table>

            <div v-else class="text-sm text-gray">暂无数据</div>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import * as XLSX from "xlsx";
import { ElMessage } from "element-plus";

type Row = Record<string, any>;
type Result = { columns: string[]; rows: Row[] };

const jsonText = ref("");
const flatten = ref(true);
const working = ref(false);
const errorMsg = ref("");
const result = ref<Result | null>(null);

const previewLimit = 50;

function parseJson(text: string) {
    const t = text.trim();
    if (!t) throw new Error("请输入 JSON");
    return JSON.parse(t);
}

function findFirstArray(root: any): any[] | null {
    if (Array.isArray(root)) return root;
    const seen = new Set<any>();
    const q = [root];
    while (q.length) {
        const cur = q.shift();
        if (cur == null || typeof cur !== "object") continue;
        if (seen.has(cur)) continue;
        seen.add(cur);

        if (Array.isArray(cur)) return cur;
        for (const v of Object.values(cur)) q.push(v);
    }
    return null;
}

function flattenObj(input: any, prefix = "", out: Row = {}) {
    if (input == null) {
        if (prefix) out[prefix] = input;
        return out;
    }
    if (Array.isArray(input)) {
        out[prefix] = JSON.stringify(input);
        return out;
    }
    if (typeof input !== "object") {
        out[prefix] = input;
        return out;
    }
    for (const [k, v] of Object.entries(input)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v != null && typeof v === "object" && !Array.isArray(v)) {
            flattenObj(v, key, out);
        } else if (Array.isArray(v)) {
            out[key] = JSON.stringify(v);
        } else {
            out[key] = v;
        }
    }
    return out;
}

/** ✅ 新增：把对象/数组安全 stringify，让不扁平化也能预览/导出 */
function stringifyCellValue(v: any) {
    if (v == null) return "";
    if (typeof v === "bigint") return v.toString();
    if (typeof v === "object") {
        try {
            return JSON.stringify(v);
        } catch {
            return String(v);
        }
    }
    return v;
}

/** ✅ 新增：仅一层处理（不改变结构，只让每个字段值可展示） */
function stringifyRowShallow(row: Row): Row {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) out[k] = stringifyCellValue(v);
    return out;
}

function buildColumnsUnion(rows: Row[]): string[] {
    const set = new Set<string>();
    for (const r of rows) Object.keys(r).forEach((k) => set.add(k));
    return Array.from(set);
}

function normalizeRows(rows: Row[], columns: string[]): Row[] {
    return rows.map((r) => {
        const o: Row = {};
        for (const c of columns) o[c] = r[c] ?? "";
        return o;
    });
}

function handleProcess() {
    errorMsg.value = "";
    result.value = null;
    working.value = true;

    try {
        const data = parseJson(jsonText.value);
        const list = findFirstArray(data);
        if (!list) throw new Error("未找到可转换的数组：请确保 JSON 是数组，或对象中包含数组。");
        if (!list.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
            throw new Error("数组元素必须是对象（形如 [{...}, {...}]）");
        }

        // ✅ 关键改动：flatten=false 时 shallow stringify 一层
        const rows = list.map((item: any) => {
            if (flatten.value) return flattenObj(item);
            return stringifyRowShallow(item); // 不扁平化也能显示嵌套对象/数组
        });

        const columns = buildColumnsUnion(rows);
        const normalized = normalizeRows(rows, columns);

        result.value = { columns, rows: normalized };
        ElMessage.success("处理完成");
    } catch (e: any) {
        errorMsg.value = e?.message || String(e);
    } finally {
        working.value = false;
    }
}

function downloadExcel() {
    if (!result.value) return;
    const ws = XLSX.utils.json_to_sheet(result.value.rows, { header: result.value.columns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "json2excel.xlsx");
}
</script>

<style scoped>
.p-4 {
    padding: 16px;
}

.flex {
    display: flex;
}

.items-center {
    align-items: center;
}

.justify-between {
    justify-content: space-between;
}

.gap-2 {
    gap: 8px;
}

.mt-3 {
    margin-top: 12px;
}

.mb-2 {
    margin-bottom: 8px;
}

.text-sm {
    font-size: 14px;
}

.text-gray {
    color: #6b7280;
}
</style>
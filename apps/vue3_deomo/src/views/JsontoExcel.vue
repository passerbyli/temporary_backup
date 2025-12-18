<template>
    <div class="p-4">
        <el-row :gutter="16">
            <el-col :span="12">
                <el-card shadow="never">
                    <template #header>
                        <div class="flex items-center justify-between">
                            <span>输入 JSON（粘贴 / 上传文件）</span>
                            <el-tag type="info">离线处理</el-tag>
                        </div>
                    </template>

                    <el-upload drag multiple :auto-upload="false" :show-file-list="true"
                        accept=".json,.txt,application/json,text/plain" :on-change="onFilesChange">
                        <el-icon>
                            <UploadFilled />
                        </el-icon>
                        <div class="el-upload__text">拖拽文件到此处或点击选择（可多选）</div>
                        <template #tip>
                            <div class="el-upload__tip">
                                粘贴 JSON = 单处理；上传多个文件 = 批量处理并打包 ZIP
                            </div>
                        </template>
                    </el-upload>

                    <el-divider />

                    <el-input v-model="jsonText" :rows="14" type="textarea"
                        placeholder="粘贴 JSON（支持 JSON 数组 或 包装对象，配合 JSONPath/路径提取列表）" />

                    <div class="mt-3 flex gap-2">
                        <el-button @click="loadDemo">填充示例</el-button>
                        <el-button @click="clearAll" type="warning" plain>清空</el-button>
                    </div>
                </el-card>
            </el-col>

            <el-col :span="12">
                <el-card shadow="never">
                    <template #header>
                        <span>转换设置</span>
                    </template>

                    <el-form label-width="110px" :model="form" class="max-w-full">
                        <el-form-item label="JSONPath/路径">
                            <el-input v-model="form.jsonPath" placeholder="例如：$.data.list 或 data.list；为空则自动寻找第一个数组" />
                        </el-form-item>

                        <el-form-item label="保留字段">
                            <el-input v-model="form.keepFields" placeholder="可选：用英文逗号分隔，如 id,name,meta.a" />
                            <div class="text-xs text-gray-500 mt-1">
                                留空：自动收集所有扁平化字段作为列；填写：按你给的列与顺序输出
                            </div>
                        </el-form-item>

                        <el-form-item label="压缩(扁平化)">
                            <el-switch v-model="form.flatten" />
                            <div class="text-xs text-gray-500 ml-2">
                                开启后：嵌套对象会变成 a.b.c 形式列
                            </div>
                        </el-form-item>

                        <el-form-item label="空值替换">
                            <el-input v-model="form.nullAs" placeholder="默认空字符串" />
                        </el-form-item>

                        <el-form-item label="Excel文件名">
                            <el-input v-model="form.baseName" placeholder="单处理导出文件名" />
                        </el-form-item>
                    </el-form>

                    <div class="mt-2 flex gap-2">
                        <el-button type="primary" :loading="working" @click="startProcess">
                            开始处理
                        </el-button>
                        <el-button :disabled="!singleResult" @click="downloadSingleXlsx">
                            下载 Excel
                        </el-button>
                        <el-button :disabled="zipFiles.length === 0" @click="downloadZip">
                            下载 ZIP（批量）
                        </el-button>
                    </div>

                    <el-divider />

                    <el-alert v-if="errorMsg" type="error" :title="errorMsg" show-icon class="mb-3" />

                    <el-alert v-if="successMsg" type="success" :title="successMsg" show-icon class="mb-3" />

                    <div v-if="working" class="mb-3">
                        <el-progress :percentage="progress" />
                    </div>

                    <el-tabs v-model="activeTab" class="mt-2">
                        <el-tab-pane label="预览" name="preview">
                            <el-table v-if="singleResult?.rows?.length" :data="singleResult.rows.slice(0, 50)"
                                height="380" border>
                                <el-table-column v-for="c in singleResult.columns" :key="c" :prop="c" :label="c"
                                    min-width="140" show-overflow-tooltip />
                            </el-table>
                            <div v-else class="text-gray-500 text-sm">暂无预览数据</div>
                            <div class="text-xs text-gray-500 mt-2" v-if="singleResult?.rows?.length">
                                仅预览前 50 行；导出包含全部
                            </div>
                        </el-tab-pane>

                        <el-tab-pane label="批量结果" name="batch">
                            <el-table v-if="zipFiles.length" :data="zipFiles" height="380" border>
                                <el-table-column prop="name" label="文件名" min-width="220" />
                                <el-table-column prop="rows" label="行数" width="100" />
                                <el-table-column prop="cols" label="列数" width="100" />
                            </el-table>
                            <div v-else class="text-gray-500 text-sm">未产生批量结果</div>
                        </el-tab-pane>
                    </el-tabs>
                </el-card>
            </el-col>
        </el-row>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { ElMessage } from "element-plus";
import { UploadFilled } from "@element-plus/icons-vue";

import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import JSON5 from "json5";
import JSONbig from "json-bigint";

type AnyObj = Record<string, any>;
type SingleResult = { columns: string[]; rows: AnyObj[]; fileName: string };

const jsonText = ref("");
const working = ref(false);
const progress = ref(0);
const errorMsg = ref("");
const successMsg = ref("");
const activeTab = ref<"preview" | "batch">("preview");

const form = reactive({
    jsonPath: "",
    keepFields: "",
    flatten: true,
    nullAs: "",
    baseName: "json2excel",
});

const files = ref<File[]>([]);
const singleResult = ref<SingleResult | null>(null);
const zipFiles = ref<{ name: string; rows: number; cols: number; blob: Blob }[]>([]);

function clearAll() {
    jsonText.value = "";
    files.value = [];
    singleResult.value = null;
    zipFiles.value = [];
    errorMsg.value = "";
    successMsg.value = "";
    progress.value = 0;
    ElMessage.success("已清空");
}

function loadDemo() {
    jsonText.value = JSON.stringify(
        {
            code: 0,
            data: {
                list: [
                    { id: 1, name: "Alice", meta: { a: 10, b: "x" } },
                    { id: 2, name: "Bob", meta: { a: 20, b: "y" }, tags: ["t1", "t2"] },
                ],
            },
        },
        null,
        2
    );
    form.jsonPath = "$.data.list";
    form.keepFields = "id,name,meta.a,meta.b,tags";
    form.flatten = true;
    ElMessage.info("已填充示例");
}

function onFilesChange(uploadFile: any) {
    // element-plus UploadFile: uploadFile.raw is File
    if (uploadFile?.raw) {
        files.value = dedupeFiles([...files.value, uploadFile.raw]);
    }
}

function dedupeFiles(arr: File[]) {
    const map = new Map<string, File>();
    arr.forEach((f) => map.set(`${f.name}_${f.size}_${f.lastModified}`, f));
    return Array.from(map.values());
}

/** 解析：优先 JSONbig（保大数），失败再 JSON5（容错非标准），最后 JSON.parse */
function parseAnyJson(text: string): any {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("JSON 内容为空");

    // json-bigint：用 storeAsString 确保大整数变字符串
    try {
        return JSONbig({ storeAsString: true }).parse(trimmed);
    } catch { }

    // JSON5：兼容非标准 JSON
    try {
        return JSON5.parse(trimmed);
    } catch { }

    // 标准 JSON
    return JSON.parse(trimmed);
}

/** 支持 $.a.b 或 a.b 形式 */
function getByPath(obj: any, path: string): any {
    const p = path.trim();
    if (!p) return obj;
    const norm = p.startsWith("$.") ? p.slice(2) : p.startsWith("$") ? p.slice(1) : p;
    const parts = norm.split(".").filter(Boolean);
    let cur = obj;
    for (const key of parts) {
        if (cur == null) return undefined;
        cur = cur[key];
    }
    return cur;
}

/** 若没给 path 且顶层不是数组：智能找第一个数组 */
function findFirstArray(root: any): any[] | null {
    if (Array.isArray(root)) return root;

    const seen = new Set<any>();
    const queue: any[] = [root];

    while (queue.length) {
        const cur = queue.shift();
        if (cur == null) continue;
        if (seen.has(cur)) continue;
        seen.add(cur);

        if (Array.isArray(cur)) return cur;
        if (typeof cur === "object") {
            for (const v of Object.values(cur)) queue.push(v);
        }
    }
    return null;
}

/** 扁平化：嵌套对象 => dot key；数组 => JSON 字符串（避免列爆炸） */
function flattenObj(input: any, prefix = "", out: AnyObj = {}) {
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

/** 规范化 rows：可选 flatten；并按 keepFields 生成 columns */
function buildRowsAndColumns(list: any[], opts: {
    flatten: boolean;
    keepFields: string[];
    nullAs: string;
}): { rows: AnyObj[]; columns: string[] } {
    const rows = list.map((item) => {
        const base = opts.flatten ? flattenObj(item) : item;
        const normalized: AnyObj = {};
        if (opts.keepFields.length) {
            for (const f of opts.keepFields) {
                const v = opts.flatten ? base?.[f] : getByPath(base, f);
                normalized[f] = v == null ? opts.nullAs : v;
            }
            return normalized;
        } else {
            // 自动列：扁平化后取 union keys
            return normalizeNulls(base, opts.nullAs, opts.flatten);
        }
    });

    let columns: string[] = [];
    if (opts.keepFields.length) {
        columns = opts.keepFields;
    } else {
        const set = new Set<string>();
        for (const r of rows) Object.keys(r).forEach((k) => set.add(k));
        columns = Array.from(set);
    }

    // 补齐缺失列
    const fixedRows = rows.map((r) => {
        const obj: AnyObj = {};
        for (const c of columns) obj[c] = r[c] == null ? opts.nullAs : r[c];
        return obj;
    });

    return { rows: fixedRows, columns };
}

function normalizeNulls(obj: any, nullAs: string, alreadyFlat: boolean) {
    if (!alreadyFlat) return obj; // 不扁平化就不动结构（但导表时列会难处理，建议开启 flatten）
    const out: AnyObj = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
        out[k] = v == null ? nullAs : v;
    }
    return out;
}

function toXlsxBlob(columns: string[], rows: AnyObj[], sheetName = "Sheet1"): Blob {
    const ws = XLSX.utils.json_to_sheet(rows, { header: columns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const array = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([array], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
}

async function startProcess() {
    errorMsg.value = "";
    successMsg.value = "";
    singleResult.value = null;
    zipFiles.value = [];
    progress.value = 0;
    working.value = true;

    try {
        const keepFields = form.keepFields
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        // 单处理：优先粘贴文本；否则如果只上传了一个文件也可以当单处理
        const hasText = !!jsonText.value.trim();
        const isBatch = files.value.length > 1 || (!hasText && files.value.length === 1 && false);

        if (files.value.length > 0 && !hasText) {
            // 文件模式
            if (files.value.length === 1) {
                const file = files.value[0];
                const text = await file.text();
                const result = processOne(text, file.name, keepFields);
                singleResult.value = result;
                activeTab.value = "preview";
                successMsg.value = `转换完成：${result.rows.length} 行，${result.columns.length} 列`;
            } else {
                // 批量
                const outputs: { name: string; rows: number; cols: number; blob: Blob }[] = [];
                for (let i = 0; i < files.value.length; i++) {
                    progress.value = Math.round((i / files.value.length) * 100);
                    const f = files.value[i];
                    const text = await f.text();
                    const result = processOne(text, f.name, keepFields);
                    const blob = toXlsxBlob(result.columns, result.rows, "Sheet1");
                    const safeName = (stripExt(f.name) || `file_${i + 1}`) + ".xlsx";
                    outputs.push({ name: safeName, rows: result.rows.length, cols: result.columns.length, blob });
                }
                progress.value = 100;
                zipFiles.value = outputs;
                activeTab.value = "batch";
                successMsg.value = `批量转换完成：${outputs.length} 个文件`;
            }
        } else {
            // 粘贴文本模式
            const result = processOne(jsonText.value, form.baseName + ".json", keepFields);
            singleResult.value = result;
            activeTab.value = "preview";
            successMsg.value = `转换完成：${result.rows.length} 行，${result.columns.length} 列`;
        }
    } catch (e: any) {
        errorMsg.value = e?.message || String(e);
    } finally {
        working.value = false;
    }
}

function processOne(text: string, fileName: string, keepFields: string[]): SingleResult {
    const data = parseAnyJson(text);

    let list: any[] | null = null;
    if (form.jsonPath.trim()) {
        const got = getByPath(data, form.jsonPath);
        if (!Array.isArray(got)) {
            throw new Error("JSONPath/路径定位结果不是数组，请检查路径是否正确");
        }
        list = got;
    } else {
        list = findFirstArray(data);
        if (!list) throw new Error("未找到可转换的数组列表；请填写 JSONPath/路径 指向数组");
    }

    const { rows, columns } = buildRowsAndColumns(list, {
        flatten: form.flatten,
        keepFields,
        nullAs: form.nullAs ?? "",
    });

    return {
        columns,
        rows,
        fileName: stripExt(fileName) + ".xlsx",
    };
}

function stripExt(name: string) {
    return name.replace(/\.[^/.]+$/, "");
}

function downloadSingleXlsx() {
    if (!singleResult.value) return;
    const blob = toXlsxBlob(singleResult.value.columns, singleResult.value.rows, "Sheet1");
    saveAs(blob, singleResult.value.fileName || "json2excel.xlsx");
}

async function downloadZip() {
    if (!zipFiles.value.length) return;
    const zip = new JSZip();
    zipFiles.value.forEach((f) => zip.file(f.name, f.blob));
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${form.baseName || "json2excel"}_batch.zip`);
}
</script>

<style scoped>
.p-4 {
    padding: 16px;
}

.mt-1 {
    margin-top: 4px;
}

.mt-2 {
    margin-top: 8px;
}

.mt-3 {
    margin-top: 12px;
}

.flex {
    display: flex;
}

.gap-2 {
    gap: 8px;
}

.items-center {
    align-items: center;
}

.justify-between {
    justify-content: space-between;
}

.text-xs {
    font-size: 12px;
}

.text-sm {
    font-size: 14px;
}

.text-gray-500 {
    color: #6b7280;
}

.ml-2 {
    margin-left: 8px;
}

.mb-3 {
    margin-bottom: 12px;
}
</style>
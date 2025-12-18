<template>
    <div class="p-4">
        <el-card shadow="never">
            <template #header>
                <div class="flex items-center justify-between">
                    <span>JS 对象 → JSON</span>
                    <div class="flex items-center gap-3">
                        <el-tooltip content="从代码中提取所有 { ... } 对象并转换为 JSON 数组" placement="bottom">
                            <div class="flex items-center gap-2">
                                <span class="text-sm text-gray">提取全部对象</span>
                                <el-switch v-model="extractAll" />
                            </div>
                        </el-tooltip>
                        <el-tooltip content="输出 JSON 是否美化（2 空格缩进）" placement="bottom">
                            <div class="flex items-center gap-2">
                                <span class="text-sm text-gray">美化</span>
                                <el-switch v-model="pretty" />
                            </div>
                        </el-tooltip>
                    </div>
                </div>
            </template>

            <el-row :gutter="16">
                <el-col :span="12">
                    <div class="text-sm text-gray mb-2">输入 JS 代码（可含注释、其它代码）</div>
                    <el-input v-model="input" type="textarea" :rows="18" placeholder="例如：
const a = 1;
// config:
const cfg = {
  // 注释
  id: 123,
  name: 'Alice',
  meta: { ok: true },
  arr: [1,2,3],
};
function x() {}" />
                    <div class="mt-3 flex gap-2">
                        <el-button type="primary" :loading="working" @click="convert">开始转换</el-button>
                        <el-button plain @click="fillDemo">示例</el-button>
                        <el-button plain type="warning" @click="clearAll">清空</el-button>
                    </div>

                    <el-alert v-if="errorMsg" class="mt-3" type="error" show-icon :title="errorMsg" />
                    <el-alert v-if="infoMsg" class="mt-3" type="success" show-icon :title="infoMsg" />
                </el-col>

                <el-col :span="12">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm text-gray">输出 JSON</div>
                        <el-button size="small" :disabled="!output.trim()" @click="copyOutput">
                            复制结果
                        </el-button>
                    </div>

                    <el-input v-model="output" type="textarea" :rows="18" readonly placeholder="转换结果会显示在这里" />

                    <div class="text-xs text-gray mt-2" v-if="stats">
                        提取对象数：{{ stats.count }} ｜ 输出类型：{{ stats.type }}
                    </div>
                </el-col>
            </el-row>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import JSON5 from "json5";

const input = ref("");
const output = ref("");
const errorMsg = ref("");
const infoMsg = ref("");
const working = ref(false);

const extractAll = ref(false);
const pretty = ref(true);

const stats = ref<{ count: number; type: string } | null>(null);

/**
 * 从一段 JS 代码里提取对象字面量 { ... }
 * 关键：要正确跳过字符串、模板字符串、正则（简单跳过）、以及注释。
 * 这里用“轻量扫描 + 栈匹配”，足够应付工具场景（非完整 JS AST 解析器）。
 */
function extractObjectLiterals(code: string): string[] {
    const res: string[] = [];
    const n = code.length;

    let i = 0;
    let inS = false; // '
    let inD = false; // "
    let inT = false; // `
    let inLineComment = false;
    let inBlockComment = false;
    let escape = false;

    function isAt(idx: number, s: string) {
        return code.slice(idx, idx + s.length) === s;
    }

    while (i < n) {
        const ch = code[i];

        // 注释状态
        if (inLineComment) {
            if (ch === "\n") inLineComment = false;
            i++;
            continue;
        }
        if (inBlockComment) {
            if (isAt(i, "*/")) {
                inBlockComment = false;
                i += 2;
                continue;
            }
            i++;
            continue;
        }

        // 字符串状态
        if (inS || inD || inT) {
            if (escape) {
                escape = false;
                i++;
                continue;
            }
            if (ch === "\\") {
                escape = true;
                i++;
                continue;
            }
            if (inS && ch === "'") inS = false;
            else if (inD && ch === '"') inD = false;
            else if (inT && ch === "`") inT = false;

            i++;
            continue;
        }

        // 进入注释
        if (isAt(i, "//")) {
            inLineComment = true;
            i += 2;
            continue;
        }
        if (isAt(i, "/*")) {
            inBlockComment = true;
            i += 2;
            continue;
        }

        // 进入字符串
        if (ch === "'") {
            inS = true;
            i++;
            continue;
        }
        if (ch === '"') {
            inD = true;
            i++;
            continue;
        }
        if (ch === "`") {
            inT = true;
            i++;
            continue;
        }

        // 找到一个对象字面量开头：'{'
        if (ch === "{") {
            const start = i;
            let depth = 0;

            // 内部扫描也要跳过字符串/注释
            let j = i;
            let _inS = false, _inD = false, _inT = false;
            let _inLC = false, _inBC = false;
            let _esc = false;

            while (j < n) {
                const c = code[j];

                if (_inLC) {
                    if (c === "\n") _inLC = false;
                    j++;
                    continue;
                }
                if (_inBC) {
                    if (code.slice(j, j + 2) === "*/") {
                        _inBC = false;
                        j += 2;
                        continue;
                    }
                    j++;
                    continue;
                }

                if (_inS || _inD || _inT) {
                    if (_esc) {
                        _esc = false;
                        j++;
                        continue;
                    }
                    if (c === "\\") {
                        _esc = true;
                        j++;
                        continue;
                    }
                    if (_inS && c === "'") _inS = false;
                    else if (_inD && c === '"') _inD = false;
                    else if (_inT && c === "`") _inT = false;
                    j++;
                    continue;
                }

                if (code.slice(j, j + 2) === "//") {
                    _inLC = true;
                    j += 2;
                    continue;
                }
                if (code.slice(j, j + 2) === "/*") {
                    _inBC = true;
                    j += 2;
                    continue;
                }

                if (c === "'") { _inS = true; j++; continue; }
                if (c === '"') { _inD = true; j++; continue; }
                if (c === "`") { _inT = true; j++; continue; }

                if (c === "{") depth++;
                if (c === "}") depth--;

                j++;

                if (depth === 0) {
                    const raw = code.slice(start, j);
                    res.push(raw);
                    i = j; // 主循环跳到对象结束处之后
                    break;
                }
            }

            // 没匹配到闭合，直接退出
            if (depth !== 0) break;

            continue;
        }

        i++;
    }

    return res;
}

/** 把对象字面量字符串解析为 JS 值（JSON5 可吃注释/单引号/未引号 key/尾逗号） */
function parseObjectLiteral(objText: string): any {
    // 去掉可能的 "export default " 或赋值前缀等（这里只处理纯 {..}，但有些人会粘贴 "const a = {...}"）
    // 若传进来已经是 "{...}"，JSON5 直接 parse。
    return JSON5.parse(objText);
}

function convert() {
    errorMsg.value = "";
    infoMsg.value = "";
    output.value = "";
    stats.value = null;
    working.value = true;

    try {
        const code = input.value;
        if (!code.trim()) throw new Error("请输入 JS 代码");

        const objects = extractObjectLiterals(code);
        if (objects.length === 0) throw new Error("未在代码中找到 { ... } 对象字面量");

        if (extractAll.value) {
            const parsed = objects.map(parseObjectLiteral);
            output.value = JSON.stringify(parsed, null, pretty.value ? 2 : 0);
            stats.value = { count: parsed.length, type: "JSON 数组" };
            infoMsg.value = `已提取并转换 ${parsed.length} 个对象`;
        } else {
            const parsed = parseObjectLiteral(objects[0]);
            output.value = JSON.stringify(parsed, null, pretty.value ? 2 : 0);
            stats.value = { count: 1, type: "JSON 对象" };
            infoMsg.value = "已提取并转换第 1 个对象（如需全部对象，打开“提取全部对象”）";
        }
    } catch (e: any) {
        errorMsg.value = e?.message || String(e);
    } finally {
        working.value = false;
    }
}

async function copyOutput() {
    try {
        await navigator.clipboard.writeText(output.value);
        ElMessage.success("已复制");
    } catch {
        // 兼容旧浏览器
        const ta = document.createElement("textarea");
        ta.value = output.value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        ElMessage.success("已复制");
    }
}

function fillDemo() {
    input.value = `// 这里是一段业务代码
const a = 1;

/** 配置对象（包含注释、单引号、未引号 key、尾逗号） */
const cfg = {
  id: 123,
  name: 'Alice',
  meta: { ok: true, note: 'hi' }, // inline comment
  arr: [1, 2, 3,],
};

/* 另一个对象 */
function foo() {}
const cfg2 = { x: 1, y: { z: 2 } };
`;
}

function clearAll() {
    input.value = "";
    output.value = "";
    errorMsg.value = "";
    infoMsg.value = "";
    stats.value = null;
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

.gap-3 {
    gap: 12px;
}

.text-sm {
    font-size: 14px;
}

.text-xs {
    font-size: 12px;
}

.text-gray {
    color: #6b7280;
}

.mt-2 {
    margin-top: 8px;
}

.mt-3 {
    margin-top: 12px;
}

.mb-2 {
    margin-bottom: 8px;
}
</style>
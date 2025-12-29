#!/usr/bin/env node
/**
 * 遍历并改造 .vue 文件：
 * 1) 替换依赖：
 *    '@hhui/vue' -> '@hhui/vue3'
 *    '@hhui/vue-icon' -> '@hhui/vue3-icon'
 * 2) 对 @eioc import：整段逐行加 // 注释（不打标记）
 *    - 支持跨行/乱缩进/逗号换行等怪异写法
 * 3) 对 components: { ... } 中引用到 @eioc 导入标识符的项：逐项加 // 注释
 *    - 支持同一行多个项（如 moneyHander, openLogDir）
 *    - 过程中会把 components 内部重排成多行，保证稳定
 * 4) 生成 vue3-eioc-disabled.txt：记录哪些文件发生了 @eioc 注释（相对路径）
 *
 * 用法：
 *   node scripts/upgrade-vue-sfc.js
 *   node scripts/upgrade-vue-sfc.js --dry-run
 *   node scripts/upgrade-vue-sfc.js --dir src/cards
 */

const fs = require("fs/promises");
const path = require("path");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

function getArgValue(flag, defaultValue) {
  const idx = args.indexOf(flag);
  if (idx === -1) return defaultValue;
  return args[idx + 1] || defaultValue;
}

const projectRoot = process.cwd();
const scanDir = path.resolve(projectRoot, getArgValue("--dir", "src"));
const RECORD_FILE = path.join(projectRoot, "vue3-eioc-disabled.txt");

const affectedFiles = new Set();

/* ------------------ utils ------------------ */

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, list = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (["node_modules", ".git", "dist", "build"].includes(e.name)) continue;
      await walk(path.join(dir, e.name), list);
    } else if (e.isFile() && e.name.endsWith(".vue")) {
      list.push(path.join(dir, e.name));
    }
  }
  return list;
}

function replaceHhui(content) {
  return content
    .replace(/(['"])@hhui\/vue\1/g, "$1@hhui/vue3$1")
    .replace(/(['"])@hhui\/vue-icon\1/g, "$1@hhui/vue3-icon$1");
}

/* ------------------ parsing helpers ------------------ */

/**
 * 从 import 子句中抽取标识符（default + named）
 * 支持：
 * - import A from ...
 * - import { a, b as c } from ...
 * - import A, { a, b as c } from ...
 * - import { \n a,\n b as c \n } from ...
 */
function extractImportNames(importClause) {
  const names = new Set();
  const clause = importClause.trim();

  // default import
  const def = clause.match(/^([A-Za-z_$][\w$]*)\s*(,|$)/);
  if (def) names.add(def[1]);

  // named import
  const named = clause.match(/\{([\s\S]*?)\}/);
  if (named) {
    named[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((seg) => {
        const m = seg.match(
          /^([A-Za-z_$][\w$]*)(\s+as\s+([A-Za-z_$][\w$]*))?$/
        );
        if (m) names.add(m[3] || m[1]);
      });
  }

  return Array.from(names);
}

/**
 * 注释 @eioc import（支持跨行），并在过程中返回被 import 的标识符列表
 *
 * 关键点：先抽取 names，再注释；避免“注释后再匹配”导致遗漏。
 */
function commentEiocImportsAndCollectNames(script) {
  let changed = false;
  const allNames = new Set();

  const importRegex =
    /^[ \t]*import[\s\S]*?from\s+(['"])(@eioc\/[^'"]+)\1[ \t]*;?[ \t]*(?:\r?\n|$)/gm;

  const out = script.replace(importRegex, (statement) => {
    changed = true;

    // 去掉末尾换行，便于解析
    const stmtNoNL = statement.replace(/\r?\n$/, "");

    // 解析 import 子句：import <CLAUSE> from '@eioc/...'
    const m = stmtNoNL.match(
      /import\s+([\s\S]*?)\s+from\s+['"]@eioc\/[^'"]+['"]/
    );
    if (m) {
      const names = extractImportNames(m[1]);
      names.forEach((n) => allNames.add(n));
    }

    // 逐行注释（不打标记）
    return (
      stmtNoNL
        .split("\n")
        .map((l) => `// ${l}`)
        .join("\n") + "\n"
    );
  });

  return { out, changed, names: Array.from(allNames) };
}

/**
 * 找到 components: { ... } 的对象字面量范围，返回 {start,end,inner}
 * start 指向 '{' 的位置，end 指向匹配的 '}' 位置
 */
function findComponentsObject(script) {
  const idx = script.search(/\bcomponents\s*:\s*\{/);
  if (idx === -1) return null;

  const braceStart = script.indexOf("{", idx);
  if (braceStart === -1) return null;

  let i = braceStart;
  let depth = 0;
  let inS = false,
    inD = false,
    inT = false;
  let esc = false;

  for (; i < script.length; i++) {
    const ch = script[i];

    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }

    if (!inD && !inT && ch === "'") inS = !inS;
    else if (!inS && !inT && ch === '"') inD = !inD;
    else if (!inS && !inD && ch === "`") inT = !inT;

    if (inS || inD || inT) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) break;
    }
  }

  if (depth !== 0) return null;

  const braceEnd = i;
  const inner = script.slice(braceStart + 1, braceEnd);
  return { braceStart, braceEnd, inner };
}

/**
 * 顶层逗号分割 components 对象内部：
 * - 忽略字符串/模板字符串
 * - 忽略嵌套对象/数组/括号
 */
function splitTopLevelByComma(inner) {
  const items = [];
  let buf = "";

  let d = 0;
  let inS = false,
    inD = false,
    inT = false;
  let esc = false;

  for (let k = 0; k < inner.length; k++) {
    const ch = inner[k];

    if (esc) {
      buf += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      buf += ch;
      esc = true;
      continue;
    }

    if (!inD && !inT && ch === "'") inS = !inS;
    else if (!inS && !inT && ch === '"') inD = !inD;
    else if (!inS && !inD && ch === "`") inT = !inT;

    if (!inS && !inD && !inT) {
      if (ch === "{" || ch === "[" || ch === "(") d++;
      else if (ch === "}" || ch === "]" || ch === ")") d--;

      if (ch === "," && d === 0) {
        items.push(buf);
        buf = "";
        continue;
      }
    }

    buf += ch;
  }

  if (buf.trim()) items.push(buf);
  return items.map((s) => s.trim()).filter(Boolean);
}

/**
 * 在 components: { ... } 中，把引用到 targets 的项逐项用 // 注释掉。
 * - 支持 EiocBanner: eiocBanner
 * - 支持 shorthand：moneyHander
 * - 支持同一行多个项：moneyHander, openLogDir
 * - 会把 components 内容重排为多行（稳定 & 不遗漏）
 */
function commentComponentsEntries(script, targets) {
  if (!targets || targets.length === 0) return { out: script, changed: false };

  const comp = findComponentsObject(script);
  if (!comp) return { out: script, changed: false };

  const targetSet = new Set(targets);

  const items = splitTopLevelByComma(comp.inner);
  if (!items.length) return { out: script, changed: false };

  let changed = false;

  const rebuilt = items.map((item) => {
    // 已经注释的不再动
    if (item.startsWith("//")) return item;

    // key: value
    const colonIdx = item.indexOf(":");
    if (colonIdx !== -1) {
      const key = item.slice(0, colonIdx).trim();
      const value = item.slice(colonIdx + 1).trim();
      const valueToken = value.match(/^([A-Za-z_$][\w$]*)/)?.[1];

      if (valueToken && targetSet.has(valueToken)) {
        changed = true;
        return `// ${key}: ${value.trim().replace(/,\s*$/, "")}`;
      }
      return item;
    }

    // shorthand
    const token = item.match(/^([A-Za-z_$][\w$]*)/)?.[1];
    if (token && targetSet.has(token)) {
      changed = true;
      return `// ${item.replace(/,\s*$/, "")}`;
    }

    return item;
  });

  const newInner = rebuilt
    .map((x) => `    ${x.replace(/,\s*$/, "")},`)
    .join("\n");

  // 去掉最后一个多余逗号（保持风格更干净）
  const newInnerFixed = newInner.replace(/,\s*$/m, "");

  const out =
    script.slice(0, comp.braceStart + 1) +
    "\n" +
    newInnerFixed +
    "\n" +
    script.slice(comp.braceEnd);

  return { out, changed };
}

/* ------------------ per-file transform ------------------ */

function replaceFirstScriptBlock(vueText, newScriptContent) {
  return vueText.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/i,
    `<script>\n${newScriptContent.trim()}\n</script>`
  );
}

async function processVueFile(filePath) {
  const before = await fs.readFile(filePath, "utf8");
  let after = replaceHhui(before);

  const scriptMatch = after.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  if (!scriptMatch) return;

  let script = scriptMatch[1];

  // 1) 注释 @eioc imports + 收集 names
  const {
    out: s1,
    changed: importChanged,
    names,
  } = commentEiocImportsAndCollectNames(script);

  if (!importChanged) {
    // 没有 @eioc，不写记录，不改 components
    if (after !== before && !DRY_RUN)
      await fs.writeFile(filePath, after, "utf8");
    return;
  }

  // 2) 注释 components 中引用到这些 names 的项（逐项，不遗漏）
  const { out: s2 } = commentComponentsEntries(s1, names);

  after = replaceFirstScriptBlock(after, s2);

  affectedFiles.add(path.relative(projectRoot, filePath));

  if (!DRY_RUN) {
    await fs.writeFile(filePath, after, "utf8");
  }
}

/* ------------------ main ------------------ */

(async function main() {
  if (!(await exists(scanDir))) {
    console.error(`[upgrade-vue-sfc] scan dir not found: ${scanDir}`);
    process.exit(1);
  }

  const files = await walk(scanDir);

  for (const f of files) {
    await processVueFile(f);
  }

  if (!DRY_RUN) {
    await fs.writeFile(
      RECORD_FILE,
      Array.from(affectedFiles).sort().join("\n") +
        (affectedFiles.size ? "\n" : ""),
      "utf8"
    );
  }

  console.log(
    DRY_RUN
      ? "[upgrade-vue-sfc] done (dry-run)"
      : `[upgrade-vue-sfc] done, wrote ${
          affectedFiles.size
        } affected files. record: ${path.relative(projectRoot, RECORD_FILE)}`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

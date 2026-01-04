#!/usr/bin/env node
/**
 * 批量给含 i18n.messages 的 Vue SFC (Options API) 注入 mixin：
 * - 自动添加 import componentI18nMixin
 * - 自动在 export default { ... } 的 mixins: [...] 中加入 componentI18nMixin
 * - 若没有 mixins 字段则新增 mixins: [componentI18nMixin],
 *
 * 兼容：已有其它 mixins（数组）
 * 跳过：<script setup>、没有 export default、mixins 非数组字面量
 *
 * 用法：
 *   node scripts/inject-i18n-mixin.js --dir src
 *   node scripts/inject-i18n-mixin.js --dir src/cards --dry-run
 *
 * 参数：
 *   --dir <path>          扫描目录（默认 src）
 *   --import <string>     import 路径（默认 @/i18n/componentI18nMixin）
 *   --dry-run             只输出，不写文件
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
const importPath = getArgValue("--import", "@/i18n/componentI18nMixin");

const REPORT_INJECTED = path.join(projectRoot, "i18n-mixin-injected.txt");
const REPORT_SKIPPED = path.join(projectRoot, "i18n-mixin-skipped.txt");

const injected = [];
const skipped = [];

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

function extractFirstScriptBlock(vueText) {
  const m = vueText.match(/<script\b([^>]*)>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  const attrs = m[1] || "";
  const content = m[2] || "";
  const full = m[0];
  return { full, attrs, content };
}

function hasScriptSetup(attrs) {
  return /\bsetup\b/i.test(attrs);
}

/**
 * 从 "export default" 后找对象字面量 { ... } 的范围
 * 返回 { startBrace, endBrace, objectText, before, after }
 */
function findExportDefaultObject(script) {
  const idx = script.indexOf("export default");
  if (idx === -1) return null;

  const braceStart = script.indexOf("{", idx);
  if (braceStart === -1) return null;

  let i = braceStart;
  let depth = 0;

  let inS = false,
    inD = false,
    inT = false;
  let esc = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (; i < script.length; i++) {
    const ch = script[i];
    const next = script[i + 1];

    // comment state
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    // start comment (only if not in string)
    if (!inS && !inD && !inT) {
      if (ch === "/" && next === "/") {
        inLineComment = true;
        i++;
        continue;
      }
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    // string state
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

  const endBrace = i;
  const objectText = script.slice(braceStart, endBrace + 1);
  return {
    startBrace: braceStart,
    endBrace,
    objectText,
    before: script.slice(0, braceStart),
    after: script.slice(endBrace + 1),
  };
}

/** 只要有 i18n: { ... messages: ... } 就认为需要注入 */
function hasLocalI18nMessages(exportObjectText) {
  // 尽量保守：要求同时出现 "i18n" 和 "messages"
  // 不做完整 AST，避免过度复杂
  return /\bi18n\s*:\s*\{[\s\S]*?\bmessages\s*:\s*\{[\s\S]*?\}/m.test(
    exportObjectText
  );
}

/** 确保 import 存在（若已有就不加） */
function ensureMixinImport(script, importPath) {
  const importLine = `import componentI18nMixin from '${importPath}'`;

  // 已经有同名 import
  if (/\bimport\s+componentI18nMixin\s+from\s+['"][^'"]+['"]/.test(script)) {
    return { out: script, changed: false };
  }

  // 找到最后一个 import 语句，插到其后；若没有 import，则插到开头
  const importRegex = /^\s*import[\s\S]*?;?\s*$/gm;
  let lastMatch = null;
  let m;
  while ((m = importRegex.exec(script)) !== null) {
    // 仅匹配真正的 import 行（以 import 开头）
    if (/^\s*import\b/.test(m[0])) lastMatch = m;
  }

  if (lastMatch) {
    const insertPos = lastMatch.index + lastMatch[0].length;
    const out =
      script.slice(0, insertPos) +
      `\n${importLine}\n` +
      script.slice(insertPos);
    return { out, changed: true };
  } else {
    const out = `${importLine}\n` + script;
    return { out, changed: true };
  }
}

/** 往 mixins: [ ... ] 里加入 componentI18nMixin；如果没有 mixins，则新增 */
function ensureMixinsInExportObject(objectText) {
  // 已经包含 componentI18nMixin 就不动
  if (
    /\bcomponentI18nMixin\b/.test(objectText) &&
    /\bmixins\s*:/.test(objectText)
  ) {
    return { out: objectText, changed: false, skipped: false };
  }

  // 找 mixins:
  const mixinsPropMatch = objectText.match(/\bmixins\s*:\s*/);
  if (!mixinsPropMatch) {
    // 没有 mixins：在 { 后面插入一行 mixins
    const out = objectText.replace(
      /^\{\s*/m,
      "{\n  mixins: [componentI18nMixin],\n  "
    );
    return { out, changed: true, skipped: false };
  }

  // 有 mixins:，要求它是数组字面量：mixins: [ ... ]
  const idx = objectText.search(/\bmixins\s*:\s*\[/);
  if (idx === -1) {
    // mixins 不是数组字面量（比如 mixins: foo / mixins: getMixins()）
    return { out: objectText, changed: false, skipped: true };
  }

  // 找到 mixins 数组的 [ ... ] 区间
  const bracketStart = objectText.indexOf("[", idx);
  if (bracketStart === -1)
    return { out: objectText, changed: false, skipped: true };

  let i = bracketStart;
  let depth = 0;

  let inS = false,
    inD = false,
    inT = false;
  let esc = false;

  for (; i < objectText.length; i++) {
    const ch = objectText[i];

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

    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) break;
    }
  }

  if (depth !== 0) return { out: objectText, changed: false, skipped: true };

  const bracketEnd = i;
  const inner = objectText.slice(bracketStart + 1, bracketEnd);

  // 已经在数组里了
  if (/\bcomponentI18nMixin\b/.test(inner)) {
    return { out: objectText, changed: false, skipped: false };
  }

  // 追加一个元素：尽量保持格式
  const innerTrim = inner.trim();
  let newInner;
  if (!innerTrim) {
    newInner = "componentI18nMixin";
  } else {
    // 末尾是否有逗号不重要，补一个即可
    newInner = innerTrim.replace(/\s*$/, "") + ", componentI18nMixin";
  }

  const out =
    objectText.slice(0, bracketStart + 1) +
    newInner +
    objectText.slice(bracketEnd);

  return { out, changed: true, skipped: false };
}

async function processFile(filePath) {
  const rel = path.relative(projectRoot, filePath);
  const vueText = await fs.readFile(filePath, "utf8");

  const scriptBlock = extractFirstScriptBlock(vueText);
  if (!scriptBlock) {
    skipped.push(`${rel}  (no <script>)`);
    return;
  }
  if (hasScriptSetup(scriptBlock.attrs)) {
    skipped.push(`${rel}  (<script setup> - skipped)`);
    return;
  }

  let script = scriptBlock.content;

  const exp = findExportDefaultObject(script);
  if (!exp) {
    skipped.push(`${rel}  (no export default object)`);
    return;
  }

  if (!hasLocalI18nMessages(exp.objectText)) {
    // 没有本地 i18n.messages，不需要注入
    return;
  }

  // 1) 先确保 export default 里有 mixins: [componentI18nMixin]
  const ensured = ensureMixinsInExportObject(exp.objectText);
  if (ensured.skipped) {
    skipped.push(`${rel}  (mixins exists but not array literal - skipped)`);
    return;
  }

  // 2) 确保 import 存在
  //    注意：如果只改了 export default，但没加 import，会编译失败
  let newScript = exp.before + ensured.out + exp.after;
  const imp = ensureMixinImport(newScript, importPath);
  newScript = imp.out;

  // 如果没变化就不写
  if (newScript === script) return;

  const newVueText = vueText.replace(
    scriptBlock.full,
    `<script>\n${newScript.trim()}\n</script>`
  );

  if (DRY_RUN) {
    injected.push(`${rel}`);
    return;
  }

  await fs.writeFile(filePath, newVueText, "utf8");
  injected.push(`${rel}`);
}

(async function main() {
  if (!(await exists(scanDir))) {
    console.error(`[inject-i18n-mixin] dir not found: ${scanDir}`);
    process.exit(1);
  }

  const files = await walk(scanDir);

  for (const f of files) {
    await processFile(f);
  }

  // 输出报告
  if (!DRY_RUN) {
    await fs.writeFile(
      REPORT_INJECTED,
      injected.sort().join("\n") + (injected.length ? "\n" : ""),
      "utf8"
    );
    await fs.writeFile(
      REPORT_SKIPPED,
      skipped.sort().join("\n") + (skipped.length ? "\n" : ""),
      "utf8"
    );
  }

  console.log(
    DRY_RUN
      ? `[inject-i18n-mixin] dry-run done. would inject: ${injected.length}, skipped: ${skipped.length}`
      : `[inject-i18n-mixin] done. injected: ${injected.length}, skipped: ${skipped.length}\n` +
          `  report injected: ${path.relative(
            projectRoot,
            REPORT_INJECTED
          )}\n` +
          `  report skipped:  ${path.relative(projectRoot, REPORT_SKIPPED)}`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

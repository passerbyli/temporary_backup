#!/usr/bin/env node
/**
 * 批量升级 src/cards 下组件结构与文件内容（JS脚本版）
 *
 * 目标结构：
 * src/
 * ├── cards/
 * │   ├── my-test-card/
 * │   │   ├── custom-panel/
 * │   │   │   ├── my-test-card-custom-panel.vue
 * │   │   ├── index.ts
 * │   │   ├── my-test-card.json
 * │   │   ├── my-test-card.vue
 * │   ├── ...
 * └── index.ts
 *
 * 规则：
 * 1) 修改 manifest json：
 *    - 如果有 customPanel 字段，其值为自定义面板的引入路径（通常 ./custom-panel/index.js）
 *    - 读取该 index.js，解析 import ... from './xxx.vue' 得到面板主 vue 文件路径（后续用于 index.ts 的 panel import）
 *    - 删除 main / customPanel 字段
 *    - 新增 entryName：组件主 vue 文件名（不含扩展名）转小驼峰
 *
 * 2) 每个组件目录新增 index.ts：
 *    export default { manifest, entry, panel?: () => import('...') }
 *    - 若无面板则不写 panel 字段
 *
 * 3) 面板主 vue 文件中若使用 content-renderer：
 *    - 删除 template 中的 <content-renderer :content="content"></content-renderer>（整段移除）
 *    - 删除 import ContentRenderer
 *    - 删除 components 注册里的 ContentRenderer
 *
 * 4) 删除旧文件：
 *    - 组件目录下 index.js
 *    - custom-panel/index.js
 *
 * 5) 生成 src/index.ts：
 *    export { default as myTestCard } from './cards/my-test-card/index'
 *    - as 后面的名字必须是小驼峰，并与 json.entryName 一致
 *
 * 运行：
 *   node scripts/upgrade-cards.js --dry-run
 *   node scripts/upgrade-cards.js
 *
 * 可跳步：
 *   --skip-json
 *   --skip-card-index
 *   --skip-panel-vue
 *   --skip-clean
 *   --skip-root-index
 */

const fsp = require("fs/promises");
const path = require("path");

// ========== CLI 参数 ==========
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const SKIP_JSON = args.includes("--skip-json");
const SKIP_CARD_INDEX = args.includes("--skip-card-index");
const SKIP_PANEL_VUE = args.includes("--skip-panel-vue");
const SKIP_CLEAN = args.includes("--skip-clean");
const SKIP_ROOT_INDEX = args.includes("--skip-root-index");

// ========== 项目路径 ==========
const projectRoot = process.cwd();
const SRC_DIR = path.join(projectRoot, "src");
const CARDS_DIR = path.join(SRC_DIR, "cards");

// ========== 工具函数 ==========
function log(...msg) {
  console.log("[upgrade-cards]", ...msg);
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readText(p) {
  return await fsp.readFile(p, "utf8");
}

async function writeText(p, content) {
  const rel = path.relative(projectRoot, p);
  if (DRY_RUN) {
    log(`[dry-run] write: ${rel}`);
    return;
  }
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, content, "utf8");
  log(`write: ${rel}`);
}

async function removeFile(p) {
  if (!(await exists(p))) return;
  const rel = path.relative(projectRoot, p);
  if (DRY_RUN) {
    log(`[dry-run] remove: ${rel}`);
    return;
  }
  await fsp.rm(p, { force: true });
  log(`remove: ${rel}`);
}

/**
 * my-test-card -> myTestCard
 * - 用于 json.entryName & src/index.ts 的导出名
 */
function kebabToLowerCamel(name) {
  const parts = String(name).split("-").filter(Boolean);
  if (!parts.length) return name;
  return (
    parts[0].toLowerCase() +
    parts
      .slice(1)
      .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : ""))
      .join("")
  );
}

/**
 * 从 custom-panel/index.js 解析面板主 vue 相对路径：
 *   import X from './xxx.vue'
 * 返回：'./xxx.vue'（原样）或 null
 */
function pickPanelVueFromIndexJs(indexJsContent) {
  const m = indexJsContent.match(
    /import\s+[\w${}\s,*]+\s+from\s+['"](.+?\.vue)['"]/
  );
  return m ? m[1] : null;
}

/**
 * Step3：面板 vue 里如果出现 content-renderer，则删除：
 * 1) template 中的 <content-renderer ...></content-renderer> 或自闭合
 * 2) import ContentRenderer
 * 3) components 注册里的 ContentRenderer
 *
 * 注意：这里是“删除”而不是替换；如果 <template> 变空，会补一个 <div></div>，避免模板非法。
 */
function patchPanelVueRemoveContentRenderer(vueContent) {
  if (!/content-renderer/i.test(vueContent)) return vueContent;

  let out = vueContent;

  // A) 删除成对标签 content-renderer
  out = out.replace(
    /<content-renderer\b[^>]*>[\s\S]*?<\/content-renderer>\s*/gi,
    ""
  );
  // B) 删除自闭合写法
  out = out.replace(/<content-renderer\b[^/>]*\/>\s*/gi, "");

  // 如果 template 为空，补一个 div
  out = out.replace(
    /<template>\s*<\/template>/gi,
    "<template>\n  <div></div>\n</template>"
  );

  // C) 删除 import ContentRenderer
  out = out.replace(
    /^\s*import\s+ContentRenderer\s+from\s+['"][^'"]+['"]\s*;?\s*$/gim,
    ""
  );

  // D) 删除 components: { ContentRenderer }
  out = out.replace(/components\s*:\s*\{\s*ContentRenderer\s*\}\s*,?/gim, "");

  // E) 处理 components: { A, ContentRenderer, B }
  out = out.replace(/components\s*:\s*\{([\s\S]*?)\}/gim, (full, inner) => {
    if (!/ContentRenderer/.test(inner)) return full;

    let fixed = inner
      .replace(/\bContentRenderer\b\s*,?/g, "")
      .replace(/,\s*,/g, ",")
      .replace(/^\s*,\s*/g, "")
      .replace(/\s*,\s*$/g, "")
      .trim();

    if (!fixed) return "";
    return `components: { ${fixed} }`;
  });

  // 清理多余空行
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

async function listSubDirs(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

// ========== 处理单个组件目录 ==========
async function processOneCard(cardDirName) {
  const cardDir = path.join(CARDS_DIR, cardDirName);

  // 必须存在：同名 json / 同名 vue
  const jsonPath = path.join(cardDir, `${cardDirName}.json`);
  const mainVuePath = path.join(cardDir, `${cardDirName}.vue`);

  if (!(await exists(jsonPath))) {
    log(`skip ${cardDirName}: missing ${cardDirName}.json`);
    return null;
  }
  if (!(await exists(mainVuePath))) {
    log(`skip ${cardDirName}: missing ${cardDirName}.vue`);
    return null;
  }

  // 读取 manifest
  let manifest;
  try {
    manifest = JSON.parse(await readText(jsonPath));
  } catch {
    log(`skip ${cardDirName}: invalid json`);
    return null;
  }

  // ========= 解析面板主 vue 路径（用于 Step2/Step3） =========
  // 只认 customPanel；不存在就认为没有面板
  const customPanelPathInJson = manifest.customPanel || null;

  let panelVueRelFromCardDir = null; // e.g. custom-panel/xxx.vue

  if (customPanelPathInJson) {
    const absCustomIndex = path.join(cardDir, customPanelPathInJson);

    if (await exists(absCustomIndex)) {
      const idxJs = await readText(absCustomIndex);
      const importedVueRel = pickPanelVueFromIndexJs(idxJs); // e.g. ./xxx.vue

      if (importedVueRel) {
        // importedVueRel 是相对 index.js 所在目录的路径
        const baseDir = path.dirname(absCustomIndex);
        const panelAbs = path.normalize(path.join(baseDir, importedVueRel));
        panelVueRelFromCardDir = path
          .relative(cardDir, panelAbs)
          .split(path.sep)
          .join("/");
      } else {
        log(
          `warn ${cardDirName}: cannot parse panel vue from ${path.relative(
            projectRoot,
            absCustomIndex
          )}`
        );
      }
    } else {
      log(
        `warn ${cardDirName}: customPanel points to missing file: ${customPanelPathInJson}`
      );
    }
  }

  // ========= Step1：修改 json =========
  // entryName 要与 src/index.ts 的 as 后名字一致
  const computedEntryName = kebabToLowerCamel(cardDirName);

  if (!SKIP_JSON) {
    manifest.entryName = computedEntryName;

    // 删除 main / customPanel
    delete manifest.main;
    delete manifest.customPanel;

    await writeText(jsonPath, JSON.stringify(manifest, null, 4) + "\n");
  } else {
    log(`skip step1(json) for ${cardDirName}`);
  }

  // 如果跳过了 json 修改，但 json 里已有 entryName，就用它；否则用计算值
  const entryNameForExport = manifest.entryName || computedEntryName;

  // ========= Step2：生成组件 index.ts =========
  if (!SKIP_CARD_INDEX) {
    const indexTsPath = path.join(cardDir, "index.ts");

    const panelPart = panelVueRelFromCardDir
      ? `,\n    panel: () => import('./${panelVueRelFromCardDir}')`
      : "";

    const indexTsContent = `import manifest from './${cardDirName}.json'
import entry from './${cardDirName}.vue'

export default {
    manifest,
    entry${panelPart}
}
`;

    await writeText(indexTsPath, indexTsContent);
  } else {
    log(`skip step2(card index.ts) for ${cardDirName}`);
  }

  // ========= Step3：修改面板 vue（删除 content-renderer） =========
  if (!SKIP_PANEL_VUE && panelVueRelFromCardDir) {
    const panelAbs = path.join(cardDir, panelVueRelFromCardDir);
    if (await exists(panelAbs)) {
      const before = await readText(panelAbs);
      const after = patchPanelVueRemoveContentRenderer(before);
      if (after !== before) {
        await writeText(panelAbs, after);
      } else {
        log(`panel vue unchanged: ${path.relative(projectRoot, panelAbs)}`);
      }
    } else {
      log(
        `warn ${cardDirName}: panel vue not found: ${panelVueRelFromCardDir}`
      );
    }
  } else if (SKIP_PANEL_VUE) {
    log(`skip step3(panel vue) for ${cardDirName}`);
  }

  // ========= Step4：删除旧 js 文件 =========
  if (!SKIP_CLEAN) {
    await removeFile(path.join(cardDir, "index.js"));

    // 只删 custom-panel/index.js（不再兼容 custom-panal）
    await removeFile(path.join(cardDir, "custom-panel", "index.js"));
  } else {
    log(`skip step4(clean old js) for ${cardDirName}`);
  }

  // 返回给 Step5 用
  return { cardDirName, entryName: entryNameForExport };
}

// ========== Step5：生成 src/index.ts ==========
async function writeRootIndexTs(cardInfos) {
  // 稳定排序：按 entryName
  const list = [...cardInfos].sort((a, b) =>
    a.entryName.localeCompare(b.entryName)
  );

  // as 后名字必须是小驼峰，与 json.entryName 一致
  const lines = list.map(
    (r) =>
      `export { default as ${r.entryName} } from './cards/${r.cardDirName}/index'`
  );

  await writeText(path.join(SRC_DIR, "index.ts"), lines.join("\n") + "\n");
}

// ========== 主流程 ==========
(async function main() {
  if (!(await exists(CARDS_DIR))) {
    log(`ERROR: not found: ${path.relative(projectRoot, CARDS_DIR)}`);
    process.exit(1);
  }

  const cardDirs = await listSubDirs(CARDS_DIR);

  const cardInfos = [];
  for (const dirName of cardDirs) {
    if (dirName.startsWith(".")) continue;
    const info = await processOneCard(dirName);
    if (info) cardInfos.push(info);
  }

  if (!SKIP_ROOT_INDEX) {
    await writeRootIndexTs(cardInfos);
  } else {
    log("skip step5(root index.ts)");
  }

  log(DRY_RUN ? "done (dry-run)" : "done");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

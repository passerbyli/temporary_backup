// scripts/pg-sql-format.js  (ESM)
// 强制对齐风格：适配 CREATE TABLE & COMMENT 对齐
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'sql-formatter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 可调参数 =====
const INDENT = '  ';
const INNER_INDENT = INDENT.repeat(3); // 列定义缩进
const MAX_PAD = 64; // 列名/类型最大对齐宽度
const KEEP_TRAILING_COMMA = true; // 列定义是否统一加逗号（最后一行除外）
const LINES_BETWEEN = 2;
const UPPERCASE = true;

// ====== 通用收集逻辑：兼容文件参数 / 目录参数 / 无参数（staged）======
const SQL_EXT_RE = /\.sql$/i;

function walkDir(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkDir(full, out);
    else if (SQL_EXT_RE.test(full)) out.push(full);
  }
}

function collectTargets(argv) {
  const args = argv.slice(2);
  const targets = [];

  if (args.length > 0) {
    for (const p of args) {
      const full = path.resolve(p);
      if (!fs.existsSync(full)) continue;
      const st = fs.statSync(full);
      if (st.isDirectory()) walkDir(full, targets);
      else if (st.isFile() && SQL_EXT_RE.test(full)) targets.push(full);
    }
    return Array.from(new Set(targets));
  }

  const staged = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf8',
  })
    .split('\n')
    .map((s) => s.trim())
    .filter((f) => f && SQL_EXT_RE.test(f))
    .map((f) => path.resolve(f));

  return Array.from(new Set(staged));
}

// ====== CREATE TABLE 对齐增强 ======
const CONSTRAINT_HEAD_RE = /^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK)\b/i;

// 尝试从一行列定义中抽取：name / type / rest / inlineComment
function parseColumnLine(line) {
  // 拆分 -- 注释
  const idxCom = line.indexOf('--');
  const comment = idxCom >= 0 ? line.slice(idxCom).trim() : '';
  const main = idxCom >= 0 ? line.slice(0, idxCom).trim() : line.trim();
  // 约束行直接返回
  if (CONSTRAINT_HEAD_RE.test(main)) {
    return { kind: 'constraint', main, comment };
  }
  // 匹配 列名 + 类型（类型可能带括号，如 varchar(100) / numeric(10,2) / timestamptz）
  // 采用懒惰匹配拿“第一个空白”为界
  const m = main.match(/^"?[A-Za-z_][\w$]*"?\s+[\w".]+(?:\([^()]*\))?/);
  if (!m) return { kind: 'raw', main, comment };

  const head = m[0];
  const [name, ...restArr] = head.split(/\s+/);
  const type = restArr.join(' ');
  const rest = main.slice(head.length).trimStart(); // 余下约束：NOT NULL / DEFAULT / REFERENCES ...
  return { kind: 'column', name, type, rest, comment };
}

// 对单个 CREATE TABLE 块的 body 做对齐
function alignCreateTableBody(bodyRaw) {
  // 先把 formatter 生成的块按行拆分，并清理尾部逗号
  const rawLines = bodyRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const lines = rawLines.map((l) => (l.endsWith(',') ? l.slice(0, -1) : l));

  const parsed = lines.map(parseColumnLine);

  // 统计列类行的最大宽度
  const colRows = parsed.filter((p) => p.kind === 'column');
  const namePad = Math.min(Math.max(0, ...colRows.map((p) => p.name.length)), MAX_PAD);
  const typePad = Math.min(Math.max(0, ...colRows.map((p) => p.type.length)), MAX_PAD);

  // 计算“注释对齐列”：按左侧最长长度对齐
  const leftMax = Math.max(
    0,
    ...parsed.map((p) => {
      if (p.kind === 'column') {
        const left =
          INNER_INDENT + p.name.padEnd(namePad, ' ') + ' ' + p.type.padEnd(typePad, ' ') + (p.rest ? ' ' + p.rest : '');
        return left.length;
      }
      if (p.kind === 'constraint') {
        return (INNER_INDENT + p.main).length;
      }
      return (INNER_INDENT + p.main).length;
    }),
  );
  const commentCol = Math.min(leftMax + 2, 120);

  // 重新拼装
  const out = parsed.map((p, idx) => {
    let left;
    if (p.kind === 'column') {
      left =
        INNER_INDENT + p.name.padEnd(namePad, ' ') + ' ' + p.type.padEnd(typePad, ' ') + (p.rest ? ' ' + p.rest : '');
    } else {
      left = INNER_INDENT + p.main;
    }

    // inline comment 对齐（若存在）
    if (p.comment) {
      const spaces = commentCol > left.length ? ' '.repeat(commentCol - left.length) : '  ';
      left = left + spaces + p.comment;
    }

    // 结尾逗号：最后一行不加
    if (KEEP_TRAILING_COMMA && idx !== parsed.length - 1) {
      left = left.replace(/\s+$/, '') + ',';
    }
    return left;
  });

  return out.join('\n');
}

// 在整份 SQL 文本中查找并替换所有 CREATE TABLE 块
function alignCreateTableBlocks(sql) {
  // 先用 sql-formatter 做一次基础排版（保证括号和换行更规整）
  let out = format(sql, {
    language: 'postgresql',
    uppercase: UPPERCASE,
    indent: INDENT,
    linesBetweenQueries: LINES_BETWEEN,
  });

  // 逐个匹配 CREATE TABLE ... ( ... );
  const re = /CREATE\s+TABLE[\s\S]*?\([\s\S]*?\)\s*;/gi;
  out = out.replace(re, (full) => {
    // 拆分表头与体
    const m = full.match(/^(CREATE\s+TABLE[\s\S]*?)\(([\s\S]*?)\)\s*;$/i);
    if (!m) return full;
    const head = m[1].trimEnd();
    const body = m[2];
    const alignedBody = alignCreateTableBody(body);
    return `${head}(\n${alignedBody}\n);`;
  });

  return out;
}

// ====== COMMENT 对齐 ======
function alignComments(sql) {
  // COLUMN 对齐
  const lines = sql.split('\n');
  let maxCol = 0;
  for (const l of lines) {
    const m = l.match(/^\s*COMMENT\s+ON\s+COLUMN\s+(.+?)\s+IS\s+/i);
    if (m) maxCol = Math.max(maxCol, m[1].length);
  }
  const out1 = sql.replace(
    /^\s*COMMENT\s+ON\s+COLUMN\s+(.+?)\s+IS\s+(.*);/gim,
    (_full, col, desc) => `COMMENT ON COLUMN ${col.padEnd(maxCol, ' ')} IS ${desc};`,
  );

  // TABLE 对齐（在一份文件里可有多张表）
  let maxTable = 0;
  for (const l of out1.split('\n')) {
    const m = l.match(/^\s*COMMENT\s+ON\s+TABLE\s+(.+?)\s+IS\s+/i);
    if (m) maxTable = Math.max(maxTable, m[1].length);
  }
  const out2 = out1.replace(
    /^\s*COMMENT\s+ON\s+TABLE\s+(.+?)\s+IS\s+(.*);/gim,
    (_full, tbl, desc) => `COMMENT ON TABLE ${tbl.padEnd(maxTable, ' ')} IS ${desc};`,
  );

  return out2;
}

function enhance(sql) {
  let out = alignCreateTableBlocks(sql);
  out = alignComments(out);
  // 收尾：压缩多余空行
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

// ====== 主流程 ======
async function main() {
  const files = collectTargets(process.argv);

  if (!files.length) {
    console.log('No SQL files to format.');
    return;
  }

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const out = enhance(src);
    if (src !== out) {
      fs.writeFileSync(file, out, 'utf8');
      console.log(`✨ Aligned: ${file}`);
    }
  }
  console.log('✅ Formatting done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

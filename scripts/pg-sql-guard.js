// scripts/pg-sql-guard.js
// Node >=16，ESM；与你的 "type":"module" 兼容
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PgParser, unwrapParseResult } from '@supabase/pg-parser';

// ====== 输出小工具（无第三方依赖）======
const color = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// ====== 目标文件收集：参数文件/目录 或 无参=staged ======
const SQL_EXT_RE = /\.sql$/i;

function walkDir(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkDir(full, out);
    else if (SQL_EXT_RE.test(full)) out.add(full);
  }
}

function collectTargets(argv) {
  const args = argv.slice(2);
  const files = new Set();

  if (args.length) {
    for (const p of args) {
      if (!p) continue;
      const full = path.resolve(p);
      if (!fs.existsSync(full)) continue;
      const st = fs.statSync(full);
      if (st.isDirectory()) walkDir(full, files);
      else if (st.isFile() && SQL_EXT_RE.test(full)) files.add(full);
      // 非 .sql 忽略
    }
    return [...files];
  }

  // 无参：仅检查 staged 的 .sql
  const staged = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf8',
  })
    .split('\n')
    .map((s) => s.trim())
    .filter((f) => f && SQL_EXT_RE.test(f))
    .map((f) => path.resolve(f));

  staged.forEach((f) => files.add(f));
  return [...files];
}

// ====== 安全分句：跳过注释/字符串/$$…$$ 中的分号 ======
function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inDollar = false;
  let dollarTag = null;

  const len = sql.length;
  while (i < len) {
    const ch = sql[i];
    const next = sql[i + 1];

    // 单行注释 --
    if (!inSingle && !inDouble && !inDollar && ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i + 2);
      cur += sql.slice(i, end === -1 ? len : end);
      i = end === -1 ? len : end;
      continue;
    }

    // 多行注释 /* ... */
    if (!inSingle && !inDouble && !inDollar && ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? len : end + 2;
      cur += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // dollar-quote 开始/结束：$tag$...$tag$ 或 $$...$$
    if (!inSingle && !inDouble && ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        const tag = m[0];
        if (!inDollar) {
          inDollar = true;
          dollarTag = tag;
        } else if (tag === dollarTag) {
          inDollar = false;
          dollarTag = null;
        }
        cur += tag;
        i += tag.length;
        continue;
      }
    }

    // '...' 字符串（不考虑转义，PG 用 '' 作为转义）
    if (!inDouble && !inDollar && ch === "'") {
      inSingle = !inSingle;
      cur += ch;
      i++;
      continue;
    }

    // "..." 标识符
    if (!inSingle && !inDollar && ch === '"') {
      inDouble = !inDouble;
      cur += ch;
      i++;
      continue;
    }

    // 语句结束 ;
    if (!inSingle && !inDouble && !inDollar && ch === ';') {
      if (cur.trim()) stmts.push(cur.trim());
      cur = '';
      i++;
      continue;
    }

    cur += ch;
    i++;
  }

  if (cur.trim()) stmts.push(cur.trim());
  return stmts;
}

// ====== 危险规则（正则后备）======
const RX_SELECT_STAR = /\bselect\s*\*/i;
const RX_UPDATE = /^\s*update\b/i;
const RX_DELETE = /^\s*delete\b/i;
const RX_HAS_WHERE = /\bwhere\b/i;
const RX_DROP_TABLE = /\bdrop\s+table\b/i;
const RX_TRUNCATE_TABLE = /\btruncate\s+table\b/i;

function fallbackCheck(stmt) {
  const hits = [];
  if (RX_SELECT_STAR.test(stmt)) hits.push('禁止 SELECT *');
  if (RX_UPDATE.test(stmt) && !RX_HAS_WHERE.test(stmt)) hits.push('UPDATE 必须带 WHERE');
  if (RX_DELETE.test(stmt) && !RX_HAS_WHERE.test(stmt)) hits.push('DELETE 必须带 WHERE');
  if (RX_DROP_TABLE.test(stmt)) hits.push('DROP TABLE 禁止直接提交（请走迁移/工单流程）');
  if (RX_TRUNCATE_TABLE.test(stmt)) hits.push('TRUNCATE TABLE 禁止直接提交（建议用分区清理/归档）');
  return hits;
}

// ====== 主流程 ======
async function main() {
  const strict = process.env.SQL_GUARD_STRICT === '1';
  const files = collectTargets(process.argv);

  if (!files.length) {
    console.log('No SQL files to check.');
    return;
  }

  const parser = new PgParser({ version: 17 }); // 可改 15/16/17
  const errors = [];
  const warns = [];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const stmts = splitStatements(text);

    for (const stmt of stmts) {
      // 跳过 psql 元命令（\copy, \i 等）
      if (/^\\\w+/.test(stmt)) continue;

      try {
        const tree = await unwrapParseResult(parser.parse(stmt));

        for (const s of tree.stmts ?? []) {
          const n = s.stmt;

          // 1) SELECT *
          if (n.SelectStmt) {
            const tlist = n.SelectStmt.targetList ?? [];
            const hasStar = tlist.some((t) => {
              const val = t?.ResTarget?.val;
              const fields = val?.ColumnRef?.fields;
              return Array.isArray(fields) && fields.some((f) => f?.A_Star);
            });
            if (hasStar) errors.push(`${file}  禁止 SELECT *`);
          }

          // 2) UPDATE/DELETE 必须带 WHERE
          if (n.UpdateStmt && !n.UpdateStmt.whereClause) errors.push(`${file}  UPDATE 必须带 WHERE`);
          if (n.DeleteStmt && !n.DeleteStmt.whereClause) errors.push(`${file}  DELETE 必须带 WHERE`);

          // 3) DROP/TRUNCATE
          if (n.DropStmt) errors.push(`${file}  DROP TABLE 禁止直接提交（请走迁移/工单流程）`);
          if (n.TruncateStmt) errors.push(`${file}  TRUNCATE TABLE 禁止直接提交（建议用分区清理/归档）`);
        }
      } catch (e) {
        // 解析失败：严格模式直接拦；默认回退正则
        if (strict) {
          errors.push(`${file}  解析失败：${(e && e.message) || e}`);
          continue;
        }

        const bads = fallbackCheck(stmt);
        if (bads.length) {
          bads.forEach((b) => errors.push(`${file}  ${b}`));
        } else {
          // 非阻塞警告 + 尝试提示常见 trailing comma 线索
          const msg = (e && e.message) || String(e);
          let hint = '';
          if (/syntax error at or near ","/i.test(msg)) {
            const lines = stmt.split('\n');
            const suspects = [];
            for (let i = 0; i < lines.length; i++) {
              const ln = lines[i];
              if (/,(\s*[\)\}])/i.test(ln)) suspects.push(i + 1);
            }
            if (suspects.length) {
              hint = ` 可能存在列表“尾逗号”，留意行：${suspects.join(', ')}`;
            }
          }
          warns.push(`${file}  解析失败但未命中危险规则：${msg}${hint}`);
        }
      }
    }
  }

  if (warns.length) {
    console.warn(
      color.yellow('\n⚠ 非阻塞警告（解析失败，已回退为正则检查）：\n' + warns.map((w) => ' - ' + w).join('\n')),
    );
  }

  if (errors.length) {
    console.error(color.red('\n❌ SQL Guard 拦截：\n' + errors.map((e) => ' - ' + e).join('\n') + '\n'));
    process.exit(1);
  } else {
    console.log(color.green('✅ SQL Guard 通过'));
  }
}

main().catch((e) => {
  console.error(color.red(e?.stack || e));
  process.exit(1);
});

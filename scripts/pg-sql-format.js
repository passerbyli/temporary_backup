// scripts/pg-sql-format.js

import { format } from 'sql-formatter';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const INDENT = '  ';
const MAX_PAD = 60;

// === 解析 CREATE TABLE 中列定义区域 ===
function alignCreateTable(sql) {
  return sql.replace(/CREATE\s+TABLE([\s\S]*?)\(([\s\S]*?)\)\s*;/gi, (full, before, body) => {
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // 去除最后逗号位置换行问题
    const columns = lines.map((line) => (line.endsWith(',') ? line.slice(0, -1) : line));

    // 解析每列：列名 + 类型 + 约束 + 注释
    const parsed = columns.map((line) => {
      const commentPart = line.includes('--') ? line.slice(line.indexOf('--')).trim() : '';
      const mainPart = commentPart ? line.slice(0, line.indexOf('--')).trim() : line.trim();

      const parts = mainPart.split(/\s+/);
      const colName = parts.shift();
      const colType = parts.shift() || '';
      const rest = parts.join(' ');

      return { colName, colType, rest, commentPart };
    });

    // 计算最大宽度
    const maxColName = Math.min(Math.max(...parsed.map((p) => p.colName.length)), MAX_PAD);

    const maxColType = Math.min(Math.max(...parsed.map((p) => p.colType.length)), MAX_PAD);

    // 重新组装
    const aligned = parsed
      .map((p) => {
        let out = `${INDENT.repeat(3)}${p.colName.padEnd(maxColName, ' ')} `;
        out += `${p.colType.padEnd(maxColType, ' ')}`;
        if (p.rest) out += ` ${p.rest}`;
        if (p.commentPart) out += `  ${p.commentPart}`;
        return out + ',';
      })
      .join('\n');

    return `CREATE TABLE ${before}(\n${aligned}\n);`;
  });
}

// === 对 COMMENT 语句也做对齐 ===
function alignComment(sql) {
  const commentLines = sql.split('\n').filter((l) => /COMMENT ON COLUMN/i.test(l));
  if (!commentLines.length) return sql;

  let maxColName = 0;
  commentLines.forEach((line) => {
    const m = line.match(/COMMENT ON COLUMN\s+([^ ]+)\s+IS/i);
    if (m && m[1].length > maxColName) maxColName = m[1].length;
  });

  return sql.replace(
    /COMMENT ON COLUMN\s+([^ ]+)\s+IS\s+(.*);/gi,
    (full, col, desc) => `COMMENT ON COLUMN ${col.padEnd(maxColName, ' ')} IS ${desc};`,
  );
}

// === 总 orchestrator ===
function beautify(sql) {
  let out = format(sql, {
    language: 'postgresql',
    uppercase: true,
    indent: INDENT,
  });

  out = alignCreateTable(out);
  out = alignComment(out);
  return out.replace(/\n{3,}/g, '\n\n');
}

const args = process.argv.slice(2);
let targets = [];

if (args.length > 0) {
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (full.toLowerCase().endsWith('.sql')) targets.push(full);
    }
  };
  walk(args[0]);
} else {
  targets = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.toLowerCase().endsWith('.sql'));
}

for (const file of targets) {
  const src = fs.readFileSync(file, 'utf8');
  const out = beautify(src);
  if (src !== out) {
    fs.writeFileSync(file, out, 'utf8');
    console.log(`✨ Aligned CREATE TABLE: ${file}`);
  }
}
console.log('✅ Formatting done.');

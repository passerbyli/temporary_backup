// scripts/pg-sql-guard.js
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const { PgParser, unwrapParseResult } = await import('@supabase/pg-parser');
  const args = process.argv.slice(2);

  let targets = [];

  if (args.length > 0) {
    // ✅ 指定目录
    const dir = args[0];
    const walk = (d) => {
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (full.toLowerCase().endsWith('.sql')) targets.push(full);
      }
    };
    walk(dir);
  } else {
    // ✅ 默认：仅检验 staged sql
    targets = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.toLowerCase().endsWith('.sql'));
  }

  if (!targets.length) {
    console.log('No SQL files to check.');
    return;
  }

  const parser = new PgParser({ version: 17 });
  const errors = [];

  for (const file of targets) {
    const sql = readFileSync(file, 'utf8');
    try {
      const tree = await unwrapParseResult(parser.parse(sql));

      for (const s of tree.stmts ?? []) {
        const stmt = s.stmt;
        if (stmt.SelectStmt) {
          const targets = stmt.SelectStmt.targetList ?? [];
          const hasStar = targets.some((t) => {
            const val = t?.ResTarget?.val;
            const fields = val?.ColumnRef?.fields;
            return Array.isArray(fields) && fields.some((f) => f?.A_Star);
          });
          if (hasStar) errors.push(`[${file}] 禁止 SELECT *`);
        }
        if (stmt.UpdateStmt && !stmt.UpdateStmt.whereClause) {
          errors.push(`[${file}] UPDATE 必须带 WHERE`);
        }
        if (stmt.DeleteStmt && !stmt.DeleteStmt.whereClause) {
          errors.push(`[${file}] DELETE 必须带 WHERE`);
        }
        if (stmt.DropStmt) {
          errors.push(`[${file}] 禁止 DROP TABLE`);
        }
        if (stmt.TruncateStmt) {
          errors.push(`[${file}] 禁止 TRUNCATE TABLE`);
        }
      }
    } catch (e) {
      errors.push(`[${file}] SQL 解析失败：${e.message}`);
    }
  }

  if (errors.length) {
    console.error('\n❌ SQL Guard:\n' + errors.map((e) => ' - ' + e).join('\n') + '\n');
    process.exit(1);
  } else {
    console.log('✅ SQL Guard 通过');
  }
}

main();

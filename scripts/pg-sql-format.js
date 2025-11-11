// scripts/pg-sql-format.js  (ESM, 适配 lint-staged 文件参数 & 目录参数)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'sql-formatter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      if (!p) continue;
      const full = path.resolve(p);
      if (!fs.existsSync(full)) continue;
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walkDir(full, targets);
      } else if (st.isFile() && SQL_EXT_RE.test(full)) {
        targets.push(full);
      }
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

// === 你的“对齐版”增强，这里保留基础版；若需要对齐建表样式，可替换为你之前那段增强器 ===
const INDENT = '  ';
const LINES_BETWEEN = 2;
const UPPERCASE = true;

function enhance(sql) {
  return format(sql, {
    language: 'postgresql',
    uppercase: UPPERCASE,
    indent: INDENT,
    linesBetweenQueries: LINES_BETWEEN,
  });
}

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
      console.log(`✨ Formatted: ${file}`);
    }
  }
  console.log('✅ Formatting done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

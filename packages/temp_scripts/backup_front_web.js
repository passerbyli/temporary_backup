#!/usr/bin/env node
/**
 * Backup front_web excluding node_modules (Windows friendly)
 * Usage:
 *   node backup_front_web.js "D:\work\front_web" "D:\backup"
 *
 * Output:
 *   D:\backup\front_web_YYYYMMDDHHmm\...
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const DEFAULT_EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt']);

function tsYYYYMMDDHHmm(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes());
}

// 简单并发控制（避免同时打开太多文件句柄）
function createLimiter(max) {
  let active = 0;
  const queue = [];
  const runNext = () => {
    if (active >= max || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        active--;
        runNext();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      runNext();
    });
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function copyFilePreserve(src, dst, st) {
  // 确保目标目录存在
  await ensureDir(path.dirname(dst));

  // 覆盖拷贝
  await fsp.copyFile(src, dst);

  // 尽量保留权限/时间戳（Windows 下权限不一定完全一致）
  try {
    await fsp.chmod(dst, st.mode);
  } catch {}
  try {
    await fsp.utimes(dst, st.atime, st.mtime);
  } catch {}
}

async function copyTree({ source, target, excludeDirs = DEFAULT_EXCLUDE_DIRS, concurrency = 64 }) {
  const limit = createLimiter(concurrency);

  let filesCopied = 0;
  let dirsCreated = 0;
  let skippedDirs = 0;

  async function walk(srcDir, dstDir) {
    const entries = await fsp.readdir(srcDir, { withFileTypes: true });

    // 先创建目录（保留结构）
    await ensureDir(dstDir);
    dirsCreated++;

    const tasks = [];

    for (const ent of entries) {
      const name = ent.name;

      // 排除目录
      if (ent.isDirectory() && excludeDirs.has(name)) {
        skippedDirs++;
        continue;
      }

      const srcPath = path.join(srcDir, name);
      const dstPath = path.join(dstDir, name);

      if (ent.isDirectory()) {
        tasks.push(walk(srcPath, dstPath));
      } else if (ent.isFile()) {
        tasks.push(
          limit(async () => {
            const st = await fsp.stat(srcPath);
            await copyFilePreserve(srcPath, dstPath, st);
            filesCopied++;
          }),
        );
      } else if (ent.isSymbolicLink()) {
        // 处理符号链接：尽量“原样复制链接”（避免把 node_modules 链接展开）
        tasks.push(
          limit(async () => {
            try {
              const link = await fsp.readlink(srcPath);
              await ensureDir(path.dirname(dstPath));
              // 若目标已存在，先删除
              await fsp.rm(dstPath, { force: true, recursive: true }).catch(() => {});
              await fsp.symlink(link, dstPath);
            } catch {
              // 如果复制链接失败（Windows 权限等），退化为跳过
            }
          }),
        );
      } else {
        // 其他类型（如 FIFO 等）直接跳过
      }
    }

    await Promise.all(tasks);
  }

  await walk(source, target);

  return { filesCopied, dirsCreated, skippedDirs };
}

async function main() {
  const argSource = process.argv[2];
  const argDestRoot = process.argv[3];

  const SOURCE = argSource || 'D:\\work\\front_web';
  const DEST_ROOT = argDestRoot || 'D:\\backup';

  const ts = tsYYYYMMDDHHmm(new Date());
  const dest = path.join(DEST_ROOT, `front_web_${ts}`);

  // 基本校验
  const srcStat = await fsp.stat(SOURCE).catch(() => null);
  if (!srcStat || !srcStat.isDirectory()) {
    console.error(`SOURCE 不存在或不是目录: ${SOURCE}`);
    process.exit(1);
  }
  await ensureDir(DEST_ROOT);

  console.log('===== 开始备份 =====');
  console.log('源目录:', SOURCE);
  console.log('目标目录:', dest);
  console.log('排除目录:', Array.from(DEFAULT_EXCLUDE_DIRS).join(', '));
  console.log('');

  const started = Date.now();
  const result = await copyTree({
    source: SOURCE,
    target: dest,
    concurrency: 64, // 你也可以改成 32/128
  });
  const ms = Date.now() - started;

  console.log('');
  console.log('===== 备份完成 =====');
  console.log('复制文件数:', result.filesCopied);
  console.log('创建目录数:', result.dirsCreated);
  console.log('跳过目录数:', result.skippedDirs);
  console.log('耗时(秒):', (ms / 1000).toFixed(2));
  console.log('输出目录:', dest);
}

main().catch((err) => {
  console.error('备份失败:', err);
  process.exit(1);
});

// scan-component-deps.js

const fs = require('fs-extra');
const path = require('path');
const XLSX = require('xlsx');
const simpleGit = require('simple-git');
const { execSync } = require('child_process');
const { performance } = require('perf_hooks');

let pLimit;
(async () => {
  pLimit = (await import('p-limit')).default;

  const EXCEL_PATH = 'repos.xlsx';
  const CLONE_DIR = path.resolve(__dirname, 'cloned');
  const OUTPUT_EXCEL = 'component-version-report.xlsx';
  const TARGET_PACKAGE = process.env.TARGET || 'vue';
  const MAX_CONCURRENT = 4;

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  const output = [];
  const limit = pLimit(MAX_CONCURRENT);

  function isValidProject(pkgPath) {
    try {
      const pkg = fs.readJsonSync(pkgPath);
      return pkg.dependencies?.[TARGET_PACKAGE] || pkg.devDependencies?.[TARGET_PACKAGE];
    } catch {
      return false;
    }
  }

  function findValidProjects(basePath) {
    const result = [];
    function search(dir) {
      const entries = fs.readdirSync(dir);
      if (entries.includes('package.json')) {
        const pkgPath = path.join(dir, 'package.json');
        if (isValidProject(pkgPath)) {
          result.push(dir);
          return;
        }
      }
      for (const entry of entries) {
        const sub = path.join(dir, entry);
        if (fs.statSync(sub).isDirectory() && !entry.includes('node_modules')) {
          search(sub);
        }
      }
    }
    search(basePath);
    return result;
  }

  const globalStart = performance.now();
  let totalProjects = 0;
  let handledProjects = 0;

  for (const row of sheet) {
    const gitUrl = row['仓库地址'];
    const branch = row['分支'] || 'main';
    const dirs = (row['项目目录'] || '')
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean);
    const repoName = path.basename(gitUrl, '.git');
    const repoPath = path.join(CLONE_DIR, repoName);

    try {
      const git = simpleGit();
      if (!fs.existsSync(repoPath)) {
        console.log(`📥 [${repoName}] cloning...`);
        await git.clone(gitUrl, repoPath);
      } else {
        console.log(`🔁 [${repoName}] fetching...`);
        const repoGit = simpleGit(repoPath);
        await repoGit.fetch();
      }

      const repoGit = simpleGit(repoPath);
      const remoteBranches = await repoGit.branch(['-r']);

      let targetBranch = branch;
      const hasBranch = remoteBranches.all.some((b) => b.endsWith(`/${branch}`));
      if (!hasBranch) {
        if (remoteBranches.all.some((b) => b.endsWith('/main'))) {
          targetBranch = 'main';
        } else if (remoteBranches.all.some((b) => b.endsWith('/master'))) {
          targetBranch = 'master';
        } else {
          console.warn(`⚠️ [${repoName}] 分支 ${branch}/main/master 不存在，使用默认分支`);
          targetBranch = null;
        }
      }

      if (targetBranch) {
        await repoGit.reset('hard');
        await repoGit.clean('f', ['-d']);
        await repoGit.checkout(targetBranch);
        await repoGit.pull();
      }

      const projectPaths = dirs.length
        ? dirs.map((d) => path.join(repoPath, d)).filter((d) => fs.existsSync(d))
        : findValidProjects(repoPath);

      totalProjects += projectPaths.length;

      const tasks = projectPaths.map((projectPath) =>
        limit(async () => {
          const relPath = path.relative(repoPath, projectPath) || '.';
          const pkgPath = path.join(projectPath, 'package.json');
          if (!isValidProject(pkgPath)) return;

          const start = performance.now();
          const tag = `[${repoName}/${relPath}]`;
          console.log(`🚀 开始处理 ${tag}`);

          let installed = false;
          try {
            execSync('npm install --legacy-peer-deps', { cwd: projectPath, stdio: 'ignore' });
            installed = true;
          } catch {
            output.push({
              仓库名: repoName,
              仓库地址: gitUrl,
              分支: targetBranch || '(默认)',
              项目路径: relPath,
              包名: TARGET_PACKAGE,
              版本: 'npm install 失败',
              是否直接依赖: '',
              依赖路径: '',
              备注: '依赖安装失败',
            });
            console.warn(`❌ ${tag} 安装失败`);
          }

          if (!installed) return;

          let raw;
          try {
            raw = execSync(`npm ls ${TARGET_PACKAGE} --all --json`, { cwd: projectPath }).toString();
          } catch (e) {
            output.push({
              仓库名: repoName,
              仓库地址: gitUrl,
              分支: targetBranch || '(默认)',
              项目路径: relPath,
              包名: TARGET_PACKAGE,
              版本: 'npm ls 失败',
              是否直接依赖: '',
              依赖路径: '',
              备注: 'npm ls 命令失败，可能未正确安装依赖',
            });
            console.warn(`❌ ${tag} npm ls 失败`);
            return;
          }

          try {
            const json = JSON.parse(raw);
            const collectDeps = (node, stack = [], isRoot = false) => {
              if (!node.dependencies) return;
              for (const [pkg, dep] of Object.entries(node.dependencies)) {
                if (pkg === TARGET_PACKAGE && dep.version) {
                  output.push({
                    仓库名: repoName,
                    仓库地址: gitUrl,
                    分支: targetBranch || '(默认)',
                    项目路径: relPath,
                    包名: pkg,
                    版本: dep.version,
                    是否直接依赖: isRoot && json.dependencies?.[pkg] ? '是' : '否',
                    依赖路径: [...stack, pkg].join(' > '),
                    备注: '',
                  });
                } else {
                  collectDeps(dep, [...stack, pkg], false);
                }
              }
            };

            collectDeps(json, [], true);
            console.log(`✅ ${tag} 处理完成，用时 ${(performance.now() - start).toFixed(0)}ms`);
          } catch {
            output.push({
              仓库名: repoName,
              仓库地址: gitUrl,
              分支: targetBranch || '(默认)',
              项目路径: relPath,
              包名: TARGET_PACKAGE,
              版本: '依赖分析失败',
              是否直接依赖: '',
              依赖路径: '',
              备注: 'JSON 解析失败或依赖树结构异常',
            });
            console.warn(`❌ ${tag} 依赖分析失败`);
          }

          handledProjects++;
          console.log(`📊 进度：${handledProjects}/${totalProjects}`);
        }),
      );

      await Promise.all(tasks);
    } catch (e) {
      console.warn(`❌ 仓库处理失败: ${gitUrl} - ${e.message}`);
    }
  }

  const ws = XLSX.utils.json_to_sheet(output);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '组件依赖扫描');
  XLSX.writeFile(wb, OUTPUT_EXCEL);

  const duration = ((performance.now() - globalStart) / 1000).toFixed(1);
  console.log(`✅ 全部完成，输出文件：${OUTPUT_EXCEL}，耗时 ${duration}s`);
})();

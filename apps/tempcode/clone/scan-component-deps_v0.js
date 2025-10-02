// scan-component-deps.js

const fs = require('fs-extra')
const path = require('path')
const XLSX = require('xlsx')
const simpleGit = require('simple-git')
const { execSync } = require('child_process')

// ========== ✅ 配置项 ==========
const EXCEL_PATH = 'repos.xlsx' // Excel 仓库配置文件
const CLONE_DIR = path.resolve(__dirname, 'cloned') // 仓库克隆目录
const OUTPUT_EXCEL = 'component-version-report.xlsx' // 输出报告路径
const TARGET_PACKAGE = process.env.TARGET || 'vue' // 默认检测 vue，可通过环境变量指定

// ========== ✅ 读取 Excel ==========
const workbook = XLSX.readFile(EXCEL_PATH)
const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
const output = []

// 判断是否为有效的前端项目（存在目标组件依赖）
function isValidProject(pkgPath) {
  try {
    const pkg = fs.readJsonSync(pkgPath)
    return pkg.dependencies?.[TARGET_PACKAGE] || pkg.devDependencies?.[TARGET_PACKAGE]
  } catch {
    return false
  }
}

// 递归查找所有含目标组件依赖的 package.json 路径
function findValidProjects(basePath) {
  const result = []
  function search(dir) {
    const entries = fs.readdirSync(dir)
    if (entries.includes('package.json')) {
      const pkgPath = path.join(dir, 'package.json')
      if (isValidProject(pkgPath)) {
        result.push(dir)
        return
      }
    }
    for (const entry of entries) {
      const sub = path.join(dir, entry)
      if (fs.statSync(sub).isDirectory() && !entry.includes('node_modules')) {
        search(sub)
      }
    }
  }
  search(basePath)
  return result
}

// ========== ✅ 主流程 ==========
;(async () => {
  for (const row of sheet) {
    const gitUrl = row['仓库地址']
    const branch = row['分支'] || 'main'
    const dirs = (row['项目目录'] || '')
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
    const repoName = path.basename(gitUrl, '.git')
    const repoPath = path.join(CLONE_DIR, repoName)

    try {
      // ✅ Clone 或 Fetch 仓库
      const git = simpleGit()
      if (!fs.existsSync(repoPath)) {
        console.log(`📥 Cloning ${gitUrl}`)
        await git.clone(gitUrl, repoPath)
      } else {
        console.log(`🔁 Pulling ${repoName}`)
        const repoGit = simpleGit(repoPath)
        await repoGit.fetch()
      }

      const repoGit = simpleGit(repoPath)
      const remoteBranches = await repoGit.branch(['-r'])

      let targetBranch = branch
      const hasBranch = remoteBranches.all.some((b) => b.endsWith(`/${branch}`))
      if (!hasBranch) {
        if (remoteBranches.all.some((b) => b.endsWith('/main'))) {
          targetBranch = 'main'
        } else if (remoteBranches.all.some((b) => b.endsWith('/master'))) {
          targetBranch = 'master'
        } else {
          console.warn(`⚠️ ${repoName} 无 ${branch}/main/master 分支，使用默认分支`)
          targetBranch = null
        }
      }

      if (targetBranch) {
        await repoGit.reset('hard')
        await repoGit.clean('f', ['-d'])
        await repoGit.checkout(targetBranch)
        await repoGit.pull()
      }

      // ✅ 遍历目录，找出所有目标组件子项目
      const projectPaths = dirs.length
        ? dirs.map((d) => path.join(repoPath, d)).filter((d) => fs.existsSync(d))
        : findValidProjects(repoPath)

      for (const projectPath of projectPaths) {
        const relPath = path.relative(repoPath, projectPath) || '.'
        const pkgPath = path.join(projectPath, 'package.json')
        if (!isValidProject(pkgPath)) continue

        let installed = false
        try {
          execSync('npm install --legacy-peer-deps', { cwd: projectPath, stdio: 'ignore' })
          installed = true
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
          })
        }

        if (!installed) continue

        try {
          const raw = execSync(`npm ls ${TARGET_PACKAGE} --all --json`, {
            cwd: projectPath,
          }).toString()
          const json = JSON.parse(raw)

          const collectDeps = (node, stack = [], isRoot = false) => {
            if (!node.dependencies) return
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
                })
              } else {
                collectDeps(dep, [...stack, pkg], false)
              }
            }
          }

          collectDeps(json, [], true)
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
          })
        }
      }
    } catch (e) {
      console.warn(`❌ 仓库处理失败: ${gitUrl} - ${e.message}`)
    }
  }

  // ✅ 写入 Excel 报告
  const ws = XLSX.utils.json_to_sheet(output)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '组件依赖扫描')
  XLSX.writeFile(wb, OUTPUT_EXCEL)
  console.log(`✅ 完成，结果写入：${OUTPUT_EXCEL}`)
})()

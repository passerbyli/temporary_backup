#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// 解析命令行参数是否包含 --dry-run（测试模式）
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')

// 项目根路径（假设为 src）
const projectRoot = path.resolve(__dirname, 'src')
// 提取样式文件存放目录
const cssOutputDirGlobal = path.join(projectRoot, 'css/global')
const cssOutputDirScoped = path.join(projectRoot, 'css/scoped')

// 如果不是 dry-run 模式，则确保样式输出目录存在
if (!isDryRun) {
  if (!fs.existsSync(cssOutputDirGlobal)) fs.mkdirSync(cssOutputDirGlobal, { recursive: true })
  if (!fs.existsSync(cssOutputDirScoped)) fs.mkdirSync(cssOutputDirScoped, { recursive: true })
}

// 缓存：样式内容 hash → 文件名，防止重复写入相同样式
const writtenStyles = new Map()
let totalRemovedLines = 0 // dry-run 模式下统计可移除行数

// 递归遍历目录中的所有文件
function traverseDirectory(directory, callback) {
  const files = fs.readdirSync(directory)
  for (const file of files) {
    const fullPath = path.join(directory, file)
    const stats = fs.statSync(fullPath)
    if (stats.isDirectory()) {
      traverseDirectory(fullPath, callback)
    } else if (stats.isFile()) {
      callback(fullPath)
    }
  }
}

// 在 <script> 标签后插入 import 语句，若无 <script> 则放最顶部
function insertImportStatement(content, statement) {
  const scriptRegex = /<script(?:\s[^>]*)?>/
  const match = scriptRegex.exec(content)
  if (match) {
    const insertPosition = match.index + match[0].length
    return content.slice(0, insertPosition) + `\n${statement}` + content.slice(insertPosition)
  } else {
    return `${statement}\n${content}`
  }
}

// 修复 style 中的 url() 和 @import 路径为 @ 别名路径
function fixRelativePaths(styleContent, filePath) {
  // 替换 url('./xx.png') 或 url("../xx") 为项目 src 相对路径
  styleContent = styleContent.replace(/url\((['"]?)(\.{1,2}\/[^)'"\s]+)\1\)/g, (match, quote, relPath) => {
    const abs = path.resolve(path.dirname(filePath), relPath)
    const rel = path.relative(projectRoot, abs).replace(/\\/g, '/')
    return `url(${quote}@/${rel}${quote})`
  })

  // 替换 @import './fonts.css' 为项目别名路径
  styleContent = styleContent.replace(/@import\s+(['"])(\.{1,2}\/[^'"]+)\1/g, (match, quote, relPath) => {
    const abs = path.resolve(path.dirname(filePath), relPath)
    const rel = path.relative(projectRoot, abs).replace(/\\/g, '/')
    return `@import ${quote}@/${rel}${quote}`
  })

  return styleContent
}

// 处理每个 Vue 文件：提取样式，清除 <style>，插入 import
function processVueFile(filePath) {
  if (!filePath.endsWith('.vue')) return

  const fileContent = fs.readFileSync(filePath, 'utf8')
  const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/g
  let match
  let updatedContent = fileContent
  let styleIndex = 0
  let hasStyle = false
  const importStatements = []

  const relativePath = path.relative(projectRoot, filePath)
  const baseName = path.basename(filePath, '.vue')

  while ((match = styleRegex.exec(fileContent)) !== null) {
    const attributes = match[1]
    let styleContent = match[2].trim()
    if (!styleContent) continue

    hasStyle = true

    // 检查 lang 类型（如 lang="scss"）
    const langMatch = attributes.match(/lang=["'](.*?)["']/)
    const lang = langMatch ? langMatch[1] : 'css'

    const isScoped = /scoped/.test(attributes)
    const outputDir = isScoped ? cssOutputDirScoped : cssOutputDirGlobal

    // 修复路径：将 url() 和 @import 中的相对路径改为 @ 别名路径
    styleContent = fixRelativePaths(styleContent, filePath)

    // 生成样式内容 hash（避免重复）
    const contentHash = crypto.createHash('md5').update(styleContent).digest('hex').slice(0, 8)
    const styleFileName = `style_${contentHash}.${lang}`
    const styleFilePath = path.join(outputDir, styleFileName)
    const importPath = `@/css/${isScoped ? 'scoped' : 'global'}/${styleFileName}`

    // 若该内容未生成过样式文件，则写入
    if (!writtenStyles.has(contentHash)) {
      writtenStyles.set(contentHash, styleFileName)
      if (!isDryRun) {
        fs.writeFileSync(styleFilePath, styleContent, 'utf8')
      }
    }

    // 删除原始 style 标签（并统计删除行）
    const lineCount = match[0].split(/\r?\n/).length
    totalRemovedLines += lineCount
    updatedContent = updatedContent.replace(match[0], '')

    // 若 import 未存在，加入到待插入列表
    if (!updatedContent.includes(importPath)) {
      importStatements.push(`import '${importPath}';`)
    }

    styleIndex++
  }

  // 插入 import 语句
  for (const stmt of importStatements) {
    updatedContent = insertImportStatement(updatedContent, stmt)
  }

  // 若有更新，则写回 Vue 文件
  if (hasStyle && updatedContent !== fileContent) {
    if (!isDryRun) {
      fs.writeFileSync(filePath, updatedContent, 'utf8')
    }
    console.log(`${isDryRun ? '[dry-run] ' : ''}Processed: ${filePath}`)
  }
}

// 启动遍历
traverseDirectory(projectRoot, processVueFile)

if (isDryRun) {
  console.log(`[dry-run] 样式提取完成，可删除约 ${totalRemovedLines} 行 <style> 样式代码。`)
} else {
  console.log(`样式提取完成。`)
}

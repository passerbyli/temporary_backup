const fs = require('fs')
const path = require('path')
const readline = require('readline')
const fg = require('fast-glob')
const ExcelJS = require('exceljs')

/**
 * 扫描目录下所有文件，按正则匹配行内字符串，输出 Excel
 * @param {RegExp} regex 要匹配的正则
 * @param {Object} options 配置项
 * @param {string} options.rootDir 根目录
 * @param {boolean} options.recursive 是否递归扫描子目录
 * @param {string[]} options.excludeDirs 排除的目录
 * @param {string[]} options.excludeExts 排除的文件扩展名（如 .jpg .png）
 * @param {string} options.outFile 输出 Excel 文件路径
 * @returns {Promise<string>} 返回生成的 Excel 路径
 */
async function main(regex, options) {
  const {
    rootDir = path.resolve('./'),
    recursive = true, // 默认递归
    excludeDirs = ['node_modules', '.git', 'dist', 'build'],
    excludeExts = ['.jpg', '.png', '.gif', '.exe', '.dll'],
    outFile = path.resolve('./scan-result.xlsx')
  } = options

  // 构造 glob 模式
  const patterns = recursive ? ['**/*'] : ['*']

  // 获取所有文件（排除目录）
  const entries = await fg(patterns, {
    cwd: rootDir,
    dot: false,
    onlyFiles: true,
    ignore: excludeDirs.map(d => `**/${d}/**`)
  })

  const files = entries.map(p => path.join(rootDir, p)).filter(f => !excludeExts.includes(path.extname(f).toLowerCase()))

  console.log(`待扫描文件数: ${files.length}`)

  const results = []

  // 扫描单个文件
  async function scanFile(file) {
    const rl = readline.createInterface({
      input: fs.createReadStream(file, { encoding: 'utf8' }),
      crlfDelay: Infinity
    })

    let lineNo = 0
    for await (const line of rl) {
      lineNo += 1
      const matches = line.match(regex)
      if (!matches) continue

      for (const m of matches) {
        results.push({
          file,
          line: lineNo,
          match: m
        })
      }
    }
  }

  // 执行扫描
  for (const f of files) {
    try {
      await scanFile(f)
    } catch (e) {
      console.warn(`跳过文件: ${f} -> ${e.message}`)
    }
  }

  // 生成 Excel
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Matches')
  ws.columns = [
    { header: '文件路径', key: 'file', width: 60 },
    { header: '行号', key: 'line', width: 8 },
    { header: '匹配内容', key: 'match', width: 100 }
  ]
  results.forEach(r => ws.addRow(r))
  ws.getRow(1).font = { bold: true }
  await wb.xlsx.writeFile(outFile)

  console.log(`已生成 Excel: ${outFile}（共 ${results.length} 条匹配）`)
  return outFile
}

async function run() {
  // 匹配网址的正则
  let urlRegex = /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s"'<>]+/g
  // 在末尾要求“最后一个字符不是常见收尾标点”
  //   const urlRegex = /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s"'<>]+?[^\s"'<>),.;:!?，。；、”’〉》」』】]/g
  // 全局匹配：以 scheme:// 开头，结尾在空白/引号/尖括号/右括号/句读符号/反引号/行尾 之前
  urlRegex = /\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s"'<>)\]\}]*?(?=(?:[\s"'<>)\]\}\.,;:!?`]|$))/g

  urlRegex = /\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s"'<>)\]\}\uFF09]+(?<![\.,;:!?`'")\]\}\uFF09])/g

  urlRegex = /^\s*(?:"?(?:token|key|secret|password)"?\s*[:=]\s*(?:(?<q1>['"])[A-Za-z0-9+/=_-]{8,}\k<q1>|[A-Za-z0-9+/=_-]{8,})\s*[;,]?\s*$|[\w.-]*(?:token|key|secret|password)\b\s*=\s*(?:(?<q2>['"])[^\s#'"]+\k<q2>|[^\s#'"]+)\s*(?:#.*)?$)/g

  const excelPath = await main(urlRegex, {
    rootDir: path.resolve('/Users/lihaomin/projects/GitHub/test'), // 扫描目录
    recursive: true, // 只扫描当前目录，不递归
    excludeDirs: ['node_modules', '.git', 'dist', 'obj', 'bin'],
    excludeExts: ['.jpg', '.png', '.exe', '.lock', '.dll'],
    outFile: path.resolve('./urls.xlsx')
  })

  console.log('结果 Excel:', excelPath)
}

run()

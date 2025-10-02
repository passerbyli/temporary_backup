const fs = require('fs')
const path = require('path')
const xlsx = require('xlsx')
const chardet = require('chardet')
const iconv = require('iconv-lite')

function traverseDir(dirPath, fileList = []) {
  const files = fs.readdirSync(dirPath)
  files.forEach((file) => {
    const filePath = path.join(dirPath, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      traverseDir(filePath, fileList)
    } else {
      fileList.push(filePath)
    }
  })
  return fileList
}

/**
 * 统计文件行数
 * @param {*} filePath
 * @returns
 */
function getFileLines(filePath) {
  try {
    const fileCount = fs.readFileSync(filePath, { encoding: 'utf-8' })
    const lines = fileCount.split(/\r\n|\r|\n/).length
    return lines
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err)
    return 0
  }
}

/**
 * 获取文件信息并生成统计数据
 * @param {*} filePaths
 * @returns
 */
function generateFileStats(filePaths) {
  return filePaths.map((filePath) => {
    const ext = path.extname(filePath)

    // fs.statSync 是 Node.js 的文件系统模块 (fs) 中的一个同步方法，用于获取文件或目录的状态信息。
    // 它返回一个 fs.Stats 对象，该对象包含了文件或目录的详细信息
    // 例如大小、创建时间、修改时间、是否是文件还是目录等。
    const stat = fs.statSync(filePath)

    const fileSize = stat.size
    const lineCount = getFileLines(filePath)
    let chineseCharsLength = 0
    let totalCharsLength = 0
    if (stat.isFile()) {
      const fileContent = fs.readFileSync(filePath)
      const encoding = chardet.detect(fileContent)

      if (!encoding) {
        console.warn(`无法识别编码：${filePath}`)
      }
      const chineseCharRegExp = /[\u4e00-\u9fa5]/g
      if (encoding.toLowerCase() !== 'utf-8') {
        try {
          const decoded = iconv.decode(fileContent, encoding)
          const encoded = iconv.encode(decoded, 'utf8')
          fs.writeFileSync(filePath, encoded, 'utf-8')
          const matches = decoded.match(chineseCharRegExp)
          chineseCharsLength = matches ? matches.length : 0
        } catch (error) {
          console.error(`转换失败：${filePath}`, error)
        }
      } else {
        const decoded = iconv.decode(fileContent, encoding)
        const matches = decoded.match(chineseCharRegExp)
        chineseCharsLength = matches ? matches.length : 0
      }

      totalCharsLength = fileContent.length
    }
    return {
      filePath,
      format: ext,
      lines: lineCount,
      size: fileSize,
      chineseCharsLength,
      totalCharsLength,
    }
  })
}

function writeDataToExcel(fileStats, outputFilePath) {
  const worksheetData = [
    ['File Path', 'File Format', 'Lines', 'Size (bytes)', 'chinese char', 'total char'], // Excel表头
    ...fileStats.map((file) => [
      file.filePath,
      file.format,
      file.lines,
      file.size,
      file.chineseCharsLength,
      file.totalCharsLength,
    ]),
  ]

  const workboox = xlsx.utils.book_new()
  const worksheet = xlsx.utils.aoa_to_sheet(worksheetData)
  xlsx.utils.book_append_sheet(workboox, worksheet, 'File Stats')
  xlsx.writeFile(workboox, outputFilePath)
}

function main(targetDir, outputPath) {
  const outputFilePath = path.join(outputPath, `file_stats${new Date().getTime()}.xlsx`)

  const filePaths = traverseDir(targetDir)
  const fileStats = generateFileStats(filePaths)
  writeDataToExcel(fileStats, outputFilePath)
}

module.exports = main

if (require.main === module) {
  main('/Users/lihaomin/Downloads/《三毛全集+13本》全（TXT）作者：三毛', path.join(__dirname))
}

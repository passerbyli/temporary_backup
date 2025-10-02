const fs = require('fs')
const path = require('path')
// 读取日志文件
const logFilePath = path.join(__dirname, '/log/query.log')
const logData = fs.readFileSync(logFilePath, 'utf-8').split('\n')

// 匹配日志条目的正则表达式
const logPattern = /\[(.*?)\] \[(\w+)\] \[(.*?)\](?:\s*(.*))?/
const lineNumberPattern = /第\[(\d+)\]行/ // 匹配 "第[数字]行" 的模式

let parsedLogs = []
let currentEntry = {}

logData.forEach((line, index) => {
  line = line.trim()

  // 如果行匹配日志条目的模式
  const match = logPattern.exec(line)
  if (match) {
    if (currentEntry.timestamp) {
      // 在开始新条目之前保存之前的条目
      parsedLogs.push(currentEntry)
    }

    // 尝试从消息中提取行号
    const lineNumberMatch = line.match(lineNumberPattern)
    const lineNumber = lineNumberMatch ? lineNumberMatch[1] : null

    // 开始一个新的日志条目
    currentEntry = {
      timestamp: match[1],
      level: match[2],
      filePath: match[3],
      message: match[4] || '',
      logLine: lineNumber, // 添加行号
    }
  } else if (currentEntry.timestamp) {
    // 将附加的消息数据追加到当前条目中
    currentEntry.message += (currentEntry.message ? '\n' : '') + line
  }
})

// 如果有最后一个条目，推送它
if (currentEntry.timestamp) {
  parsedLogs.push(currentEntry)
}

// 输出解析后的日志
console.log(parsedLogs)

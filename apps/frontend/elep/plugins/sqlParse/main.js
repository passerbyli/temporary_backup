const path = require('path')
const fs = require('fs')
const { parseSql } = require('./sqlParse1')
// const { parseSql } = require('./sqlParseAst')

/**
 * 获取所有SQL文件
 * @param {*} dir
 * @returns
 */
function getSqlFiles(dir) {
  let results = []
  // 获取目录下的所有文件和文件夹
  const list = fs.readdirSync(dir)
  list.forEach((file) => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat && stat.isDirectory()) {
      // 如果是文件夹，递归遍历
      results = results.concat(getSqlFiles(filePath))
    } else if (path.extname(file) === '.sql') {
      results.push(filePath)
    }
  })
  return results
}

// 主执行函数
async function main(filePath, outputPath) {
  const sqlFiles = getSqlFiles(filePath)
  const result = []

  sqlFiles.forEach((file, index) => {
    const sqlContent = fs.readFileSync(file, 'utf8')
    const {
      databaseType,
      procedures,
      functionNames,
      sourceTables,
      targetTables,
      isSwitchTable,
      nodes,
      edges,
      columnEdges,
    } = parseSql(sqlContent)

    result.push({
      file,
      scriptIndex: index + 1,
      databaseType,
      procedures,
      functionNames,
      sourceTables,
      targetTables,
      isSwitchTable,
      nodes,
      edges,
      columnEdges,
    })
  })

  let _outputPath = path.join(outputPath, 'sql_analysis_result.json')
  if (!fs.existsSync(outputPath)) {
    fs.mkdir(outputPath, { recursive: true }, (error) => {
      if (error) {
        console.log('Error creating directory', error)
      } else {
        console.log('Directory created successfully')
        fs.writeFileSync(_outputPath, JSON.stringify(result, null, 2), 'utf-8')
      }
    })
  } else {
    fs.writeFileSync(_outputPath, JSON.stringify(result, null, 2), 'utf-8')
  }

  return { result: result, filePath: _outputPath }
}

main('/Users/lihaomin/projects/GitHub/test/scripts/sqlParse/data', path.join(__dirname))

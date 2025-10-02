const { parseSqlFile } = require('./parseProc')
const fs = require('fs')
const path = require('path')

const sqlDir = path.join(__dirname, '../sql')
const outputPath = path.join(__dirname, '../output/data.json')

const files = fs.readdirSync(sqlDir)

let result = {
  nodes: [],
  edges: [],
}

files.forEach((file) => {
  const filePath = path.join(sqlDir, file)
  const sqlContent = fs.readFileSync(filePath, 'utf-8')
  const lineage = parseSqlFile(sqlContent, file)

  result.nodes.push(...lineage.nodes)
  result.edges.push(...lineage.edges)
})

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))

console.log('血缘关系解析完成')

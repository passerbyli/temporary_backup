const fs = require('fs')
const { driver } = require('./utils/neo4jHelper')

async function exportGraph(outputFile) {
  const session = driver.session()
  try {
    const nodesResult = await session.run('MATCH (n) RETURN n')
    const edgesResult = await session.run(
      'MATCH (a)-[r]->(b) RETURN a.id AS source, b.id AS target, type(r) AS type, r AS properties'
    )

    const nodes = nodesResult.records.map((r) => r.get('n').properties)
    const edges = edgesResult.records.map((r) => ({
      source: r.get('source'),
      target: r.get('target'),
      type: r.get('type'),
      properties: r.get('properties'),
    }))

    fs.writeFileSync(outputFile, JSON.stringify({ nodes, edges }, null, 2))
    console.log(`✅ 图谱已导出到 ${outputFile}`)
  } finally {
    await session.close()
  }
}

// 示例调用
exportGraph('neo4j-graph.json').then(() => process.exit(0))

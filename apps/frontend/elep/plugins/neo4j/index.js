const { exportNodes } = require('./exportNodes')
const { exportEdges } = require('./exportEdges')
const { runCypher, close, queryCypher } = require('./neo4j')
const fs = require('fs/promises')
const path = require('path')

async function main() {
  await exportNodes()
  await exportEdges()

  const nodes = await fs.readFile(path.join(__dirname, 'export/nodes.cypher'), 'utf8')
  const edges = await fs.readFile(path.join(__dirname, 'export/edges.cypher'), 'utf8')

  const cyphers = (nodes + '\n' + edges).split('\n').filter((line) => line.trim())

  for (const cypher of cyphers) {
    // console.log(cypher)
    // await runCypher(cypher)
  }

  await close()
  console.log('PG 元数据 已同步至 Neo4j')
}

async function ggg() {
  let script = `
  // 返回节点
MATCH (n)
RETURN 
  id(n) AS id, 
  'node' AS type, 
  labels(n)[0] AS label, 
  n.name AS name, 
  null AS source, 
  null AS target

UNION ALL

// 返回关系
MATCH (a)-[r]->(b)
RETURN 
  id(r) AS id, 
  'edge' AS type, 
  type(r) AS label, 
  null AS name, 
  id(a) AS source, 
  id(b) AS target
  `

  script = `
  MATCH (startNode:dl_Table {name: 'dm_table_ods_1'})
MATCH path = (startNode)-[*]->(downstream)
RETURN path`

  script = `
MATCH (target:dl_Table {name: 'dm_api_01'})
MATCH path = (upstream)-[*]->(target)
RETURN path
`

  //查上下游所有路径（合并返回）
  script = `
  MATCH path1 = (upstream)-[*]->(target)
WHERE target.name = '	dm_table_dws_1'
RETURN path1

UNION

MATCH path2 = (target)-[*]->(downstream)
WHERE target.name = 'dm_table_dws_1'
RETURN path2
  `

  script = `
MATCH path = (n)-[*]-(m)
WHERE n.name = 'dm_table_dws_1' AND NOT 'API' IN labels(m) AND NOT 'API' IN labels(n)
RETURN path
   
   `

  script = `MATCH path = (n)-[*]-(m)
WHERE n.name = "ads_user_behavior"
RETURN path`

  const result = await queryCypher(script)

  // result.records.forEach((r) => {
  //   const type = r.get('type')
  //   if (type === 'node') {
  //     nodes.push({
  //       id: r.get('id').toString(),
  //       label: r.get('name') || r.get('label'),
  //     })
  //   } else if (type === 'edge') {
  //     edges.push({
  //       id: r.get('id').toString(),
  //       source: r.get('source').toString(),
  //       target: r.get('target').toString(),
  //       label: r.get('label'),
  //     })
  //   }
  // })

  const nodeMap = new Map()
  const edgeMap = new Map()
  result.records.forEach((record) => {
    const path = record.get('path')

    path.segments.forEach((segment) => {
      const start = segment.start
      const end = segment.end
      const rel = segment.relationship

      nodeMap.set(start.identity.toString(), {
        id: start.properties.name,
        label: start.properties.name,
        alias: start.properties.alias,
        schema: start.properties.schema,
        fields: start.properties.fields || [],
      })

      nodeMap.set(end.identity.toString(), {
        id: end.properties.name,
        label: end.properties.name,
        alias: end.properties.alias,
        schema: end.properties.schema,
        fields: end.properties.fields || [],
      })

      const edgeKey = `${rel.start.toString()}-${rel.end.toString()}-${rel.type}`
      edgeMap.set(edgeKey, {
        source: start.properties.name,
        target: end.properties.name,
        label: rel.properties.procedure || rel.type,
        schedule: rel.properties.schedule || '',
      })
    })
  })
  // result.records.forEach((record) => {
  //   const path = record.get('path')

  //   path.segments.forEach((segment) => {
  //     const start = segment.start
  //     const end = segment.end
  //     const rel = segment.relationship

  //     // 添加节点
  //     nodeMap.set(start.identity.toString(), {
  //       id: start.identity.toString(),
  //       label: start.properties.name,
  //     })

  //     nodeMap.set(end.identity.toString(), {
  //       id: end.identity.toString(),
  //       label: end.properties.name,
  //     })

  //     // 添加边（source+target+type 组合可作为唯一键）
  //     const edgeKey = `${rel.start.toString()}-${rel.end.toString()}-${rel.type}`
  //     edgeMap.set(edgeKey, {
  //       id: rel.identity.toString(),
  //       source: rel.start.toString(),
  //       target: rel.end.toString(),
  //       label: rel.type,
  //     })
  //   })
  // })

  // 去重后的数组
  const nodes = Array.from(nodeMap.values())
  const edges = Array.from(edgeMap.values())
  await fs.writeFile(
    path.join(__dirname, 'export/data.json'),
    JSON.stringify({ nodes, edges }, null, 2),
    'utf-8',
  )
}

// main()
ggg()

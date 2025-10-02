const { pgPool } = require('./utils/pgHelper')
const { runCypher, closeNeo4j } = require('./utils/neo4jHelper')
const { getTableFieldsMap } = require('./utils/fieldProcessor')
const config = require('./config')

const batchSize = config.batchSize || 1000

async function processInBatches(tableName, processFn) {
  let offset = 0
  let hasMore = true
  while (hasMore) {
    const { rows } = await pgPool.query(
      `SELECT * FROM ads_dl.${tableName} ORDER BY id LIMIT $1 OFFSET $2`,
      [batchSize, offset]
    )
    if (rows.length === 0) break
    await processFn(rows)
    console.log(
      `✅ 处理 ${tableName} 第 ${Math.floor(offset / batchSize) + 1} 批，共 ${rows.length} 条`
    )
    offset += batchSize
    hasMore = rows.length === batchSize
  }
}

async function pushSchemas(rows) {
  for (const s of rows) {
    await runCypher(
      `MERGE (n:Schema {id: $id}) SET n.name = $name, n.description = $desc, n.field = $field`,
      { id: s.id, name: s.name, desc: s.description, field: s.field }
    )
  }
}

async function pushTables(rows, tableFieldsMap) {
  for (const t of rows) {
    const fields = tableFieldsMap[t.id] || []
    const fieldsJson = JSON.stringify(fields)
    await runCypher(
      `MERGE (t:Table {id: $id}) 
       SET t.name = $name, t.layer = $layer, t.type = $type, t.description = $desc, t.field = $field, t.fields = $fieldsJson
       WITH t
       MATCH (s:Schema {id: $schemaId})
       MERGE (s)-[:CONTAINS]->(t)`,
      {
        id: t.id,
        name: t.name,
        layer: t.layer,
        type: t.type,
        desc: t.description,
        field: t.field,
        schemaId: t.schema_id,
        fieldsJson,
      }
    )
  }
}

async function pushSQLScripts(rows) {
  for (const s of rows) {
    await runCypher(
      `MERGE (s:SQLScript {id: $id}) 
       SET s.name = $name, s.type = $type, s.description = $desc, s.parsed = $parsed`,
      { id: s.id, name: s.name, type: s.type, desc: s.description, parsed: s.parsed }
    )
  }
}

async function pushSchedules(rows) {
  for (const sch of rows) {
    await runCypher(
      `MERGE (sch:Schedule {id: $id}) 
       SET sch.name = $name, sch.platform = $platform, sch.type = $type, sch.description = $desc
       WITH sch
       MATCH (s:SQLScript {id: $sqlId})
       MERGE (sch)-[:TRIGGERS]->(s)`,
      {
        id: sch.id,
        name: sch.name,
        platform: sch.platform,
        type: sch.type,
        desc: sch.description,
        sqlId: sch.sql_id,
      }
    )
  }
}

async function pushLineages(rows) {
  for (const l of rows) {
    await runCypher(
      `MATCH (src:Table {id: $fromId}), (dst:Table {id: $toId})
       MERGE (src)-[:LINEAGE {sqlId: $sqlId, sqlName: $sqlName, taskId: $taskId, taskName: $taskName}]->(dst)`,
      {
        fromId: l.from_table_id,
        toId: l.to_table_id,
        sqlId: l.sql_id,
        sqlName: l.sql_name,
        taskId: l.task_id,
        taskName: l.task_name,
      }
    )
  }
}

async function main() {
  console.log('🚀 开始同步 Neo4j 图谱...')

  const tableFieldsMap = await getTableFieldsMap()
  console.log(`🔍 已加载 ${Object.keys(tableFieldsMap).length} 张表的字段信息`)

  await processInBatches('metadata_schema', pushSchemas)
  await processInBatches('metadata_table', (rows) => pushTables(rows, tableFieldsMap))
  await processInBatches('metadata_sqlscript', pushSQLScripts)
  await processInBatches('metadata_schedule', pushSchedules)
  await processInBatches('metadata_table_lineage', pushLineages)

  console.log('🎉 数据同步完成！')
  await closeNeo4j()
  await pgPool.end()
}

main().catch((err) => {
  console.error('❌ 出错了：', err)
  process.exit(1)
})

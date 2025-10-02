const fs = require('fs/promises')
const path = require('path')
const { query } = require('./db')

async function exportNodes() {
  const cypherList = []

  const schemas = await query('SELECT * FROM ads_dl.metadata_schema')
  schemas.forEach((item) => {
    cypherList.push(
      `merge (s:dl_Schema {name:'${item.name}', description:'${item.description || ''}'})`,
    )
  })

  const tables = await query('SELECT * FROM ads_dl.metadata_table')
  tables.forEach((item) => {
    cypherList.push(
      `merge (n:dl_Table {name:'${item.name.replace('.', '_')}', description:'${item.description || ''}', layer:'${item.layer}', type:'${item.type}'})`,
    )
    // cypherList.push(
    //   `MATCH (t:dl_Table {name:'${item.name.replace('.', '_')}'}), (s:dl_Schema {name:'${item.schema_name}'}) MERGE (t)-[:BELONGS_TO]->(s);`,
    // )
  })

  await fs.writeFile(path.join(__dirname, 'export/nodes.cypher'), cypherList.join('\n'))
}

module.exports = { exportNodes }

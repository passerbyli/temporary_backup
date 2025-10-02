const fs = require('fs/promises')
const path = require('path')
const { query } = require('./db')

async function exportEdges() {
  const cypherList = []

  const lineages = await query('SELECT * FROM ads_dl.metadata_table_lineage')
  lineages.forEach((item) => {
    cypherList.push(`
MATCH (from:dl_Table {name:'${item.from_table_name.replace('.', '_')}'}), (to:dl_Table {name:'${item.to_table_name.replace('.', '_')}'})
MERGE (from)-[:DEPENDS_ON {sql:'${item.sql_name || ''}', task:'${item.task_name || ''}'}]->(to);
`)
  })

  await fs.writeFile(path.join(__dirname, 'export/edges.cypher'), cypherList.join('\n'))
}

module.exports = { exportEdges }

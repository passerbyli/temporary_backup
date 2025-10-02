const { query } = require('./pgHelper')

async function getTableFieldsMap() {
  const rows = await query('SELECT * FROM ads_dl.metadata_field')
  const map = {}
  for (const f of rows) {
    if (!map[f.table_id]) map[f.table_id] = []
    map[f.table_id].push({
      name: f.name,
      description: f.description,
      field_type: f.field_type,
      field_length: f.field_length,
      field_alias: f.field_alias,
    })
  }
  return map
}

module.exports = { getTableFieldsMap }

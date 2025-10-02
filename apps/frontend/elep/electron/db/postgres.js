const { Pool } = require('pg')

// 使用配置文件或硬编码方式配置数据库连接
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'admin',
  database: 'lihaomin',
})

module.exports = {
  async getAllTables() {
    const sql = `
      SELECT t.uuid, t.name AS table_name, t.layer, t.type, t.description,
             s.name AS schema_name, d.name AS data_source
      FROM ads_dl.table_metadata t
      LEFT JOIN ads_dl.schema_metadata s ON t.schema_uuid = s.uuid
      LEFT JOIN ads_dl.data_source d ON s.data_source_uuid = d.uuid
      ORDER BY t.created_at DESC
    `
    const res = await pool.query(sql)

    return res.rows
  },

  async getTableDetail(tableId) {
    const sql = `
      SELECT t.*, s.name AS schema_name, d.name AS data_source
      FROM table_metadata t
      LEFT JOIN schema_metadata s ON t.schema_uuid = s.uuid
      LEFT JOIN data_source d ON s.data_source_uuid = d.uuid
      WHERE t.uuid = $1
    `
    const table = await pool.query(sql, [tableId])

    const fields = await pool.query(
      `
      SELECT name, type, is_pk, description
      FROM column_metadata
      WHERE table_uuid = $1
      ORDER BY created_at
    `,
      [tableId],
    )

    return {
      ...table.rows[0],
      fields: fields.rows,
    }
  },
}

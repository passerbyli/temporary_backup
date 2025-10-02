const BaseDB = require('./baseDB')
const mysql = require('mysql2/promise')

class MySQLDB extends BaseDB {
  async connect() {
    this.client = await mysql.createPool({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      port: this.config.port,
      timezone: this.config.timezone || '+08:00',
      waitForConnections: true,
      connectionLimit: 10,
    })
  }

  async getSchemas() {
    const [rows] = await this.client.query('SHOW DATABASES')
    return rows.map((r) => r.Database)
  }

  async getTables(schema) {
    const [rows] = await this.client.query(`SHOW TABLES FROM \`${schema}\``)
    return rows.map((row) => Object.values(row)[0])
  }

  async getTableStruct(schema, table) {
    const [rows] = await this.client.query(`SHOW FULL COLUMNS FROM \`${schema}\`.\`${table}\``)
    return rows
  }

  async getProcedures(schema) {
    if (!schema) throw new Error('schema is required')
    const [rows] = await this.client.query(
      `
    SELECT ROUTINE_NAME, ROUTINE_TYPE
    FROM information_schema.ROUTINES
    WHERE ROUTINE_SCHEMA = ?
  `,
      [schema],
    )
    return rows
  }

  async getProcedureDetail(schema, procedureName) {
    if (!schema || !procedureName) throw new Error('schema & procedureName are required')
    const [rows] = await this.client.query(`
    SHOW CREATE PROCEDURE \`${schema}\`.\`${procedureName}\`
  `)
    return rows[0]
  }

  // 获取 存储过程/函数 的入参、出参
  async getProcedureParams(schema, procedureName) {
    if (!schema || !procedureName) throw new Error('schema & procedureName are required')
    const [rows] = await this.client.query(
      `
    SELECT 
      SPECIFIC_NAME, PARAMETER_NAME, DATA_TYPE, DTD_IDENTIFIER, PARAMETER_MODE
    FROM information_schema.PARAMETERS
    WHERE SPECIFIC_SCHEMA = ?
    AND SPECIFIC_NAME = ?
    ORDER BY ORDINAL_POSITION
  `,
      [schema, procedureName],
    )
    return rows
  }
}

module.exports = MySQLDB

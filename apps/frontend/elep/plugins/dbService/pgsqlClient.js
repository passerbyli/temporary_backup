const BaseDB = require('./baseDB')
const { Client } = require('pg')

class PgSQLDB extends BaseDB {
  async connect() {
    this.client = new Client({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database, // 可选，查询所有库时可不传
      port: this.config.port || 5432,
    })
    await this.client.connect()
  }

  // 获取所有 schema
  async getSchemas() {
    const res = await this.client.query(`
      SELECT schema_name 
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name
    `)
    return res.rows.map((r) => r.schema_name)
  }

  // 获取某个 schema 下的所有表
  async getTables(schema) {
    const res = await this.client.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
      ORDER BY table_name
    `,
      [schema],
    )
    return res.rows.map((r) => r.table_name)
  }

  // 获取表结构
  async getTableStruct(schema, table) {
    const res = await this.client.query(
      `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `,
      [schema, table],
    )
    return res.rows
  }

  // 获取存储过程或函数列表
  async getProcedures(schema) {
    const res = await this.client.query(
      `
      SELECT routine_name, routine_type, data_type
      FROM information_schema.routines
      WHERE specific_schema = $1
      ORDER BY routine_name
    `,
      [schema],
    )
    return res.rows
  }

  // 获取存储过程或函数定义
  async getProcedureDetail(schema, routineName) {
    const res = await this.client.query(
      `
      SELECT pg_get_functiondef(p.oid) as create_sql
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = $1 AND p.proname = $2
      LIMIT 1
    `,
      [schema, routineName],
    )
    return res.rows.length ? res.rows[0].create_sql : ''
  }

  /**
   * 获取存储过程或函数的参数
   * proargmodes 字段说明：
   * i:IN参数
   * o:OUT参数
   * b:INPUT参数
   * v:VARIADIC参数
   * t:TABLE返回值
   *
   * @param {*} schema
   * @param {*} routineName
   * @returns
   */
  async getProcedureParams(schema, routineName) {
    const res = await this.client.query(
      `
      SELECT
  p.proname AS routine_name,
  unnest(p.proargnames) AS parameter_name,
  unnest(p.proargtypes::regtype[]) AS parameter_type,
  unnest(COALESCE(p.proargmodes, ARRAY['i'])) AS parameter_mode  -- 没有 mode 默认是 IN
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = $1
AND p.proname = $2;
    `,
      [schema, routineName],
    )
    return res.rows
  }

  async getDBQuery(sql) {
    console.log('924924203')
    const res = await this.client.query(
      `${sql}
    `,
      [],
    )
    return res.rows
  }

  async close() {
    if (this.client) {
      await this.client.end()
    }
  }
}

module.exports = PgSQLDB

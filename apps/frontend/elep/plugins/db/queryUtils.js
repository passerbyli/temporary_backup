/**
 * 通用数据库操作工具
 * 包含多数据源支持、schema支持、高级条件查询
 */
const { getDb } = require('./db')
const { buildWhereClause } = require('./buildWhereClause')
const config = require('./config.json')

/**
 * 通用查询
 * @param {string} dbName - 数据源
 * @param {string} schema - Schema 名
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数
 */
async function query(dbName, schema, sql, params = []) {
  const db = getDb(dbName)
  const dbType = config[dbName].type

  if (dbType === 'postgres') {
    const res = await db.query(sql, params)
    return res.rows
  } else {
    const [rows] = await db.execute(sql, params)
    return rows
  }
}

/**
 * 分页查询
 */
async function queryWithPagination(
  dbName,
  schema,
  baseSql,
  params = [],
  { page = 1, pageSize = 20 } = {},
) {
  const dbType = config[dbName].type
  const offset = (page - 1) * pageSize

  let countSql = `SELECT COUNT(*) AS total FROM (${baseSql}) AS t`
  let dataSql = `${baseSql} LIMIT ? OFFSET ?`
  const allParams = [...params, pageSize, offset]

  if (dbType === 'postgres') {
    countSql = `SELECT COUNT(*) FROM (${baseSql}) AS t`
    dataSql = `${baseSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  }

  const totalRes = await query(dbName, schema, countSql, params)
  const total = dbType === 'postgres' ? parseInt(totalRes[0].count, 10) : totalRes[0].total
  const data = await query(dbName, schema, dataSql, allParams)

  return { total, data }
}

/**
 * 插入数据
 */
async function insert(dbName, schema, table, data) {
  const dbType = config[dbName].type
  const keys = Object.keys(data)
  const values = Object.values(data)
  const fullTable = dbType === 'postgres' ? `"${schema}"."${table}"` : `\`${schema}\`.\`${table}\``

  if (dbType === 'postgres') {
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const sql = `INSERT INTO ${fullTable} (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`
    const rows = await query(dbName, schema, sql, values)
    return rows[0]
  } else {
    const placeholders = keys.map(() => '?').join(', ')
    const sql = `INSERT INTO ${fullTable} (${keys.join(',')}) VALUES (${placeholders})`
    const rows = await query(dbName, schema, sql, values)
    return rows.insertId ? { id: rows.insertId, ...data } : rows[0]
  }
}

/**
 * 更新数据
 */
async function update(dbName, schema, table, data, condition = {}) {
  const dbType = config[dbName].type
  const keys = Object.keys(data)
  const values = Object.values(data)
  const condKeys = Object.keys(condition)
  const condValues = Object.values(condition)

  if (!condKeys.length) throw new Error('Update 条件不能为空')

  const setClause =
    dbType === 'postgres'
      ? keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
      : keys.map((k) => `\`${k}\` = ?`).join(', ')

  const condClause =
    dbType === 'postgres'
      ? condKeys.map((k, i) => `"${k}" = $${i + 1 + keys.length}`).join(' AND ')
      : condKeys.map((k) => `\`${k}\` = ?`).join(' AND ')

  const fullTable = dbType === 'postgres' ? `"${schema}"."${table}"` : `\`${schema}\`.\`${table}\``
  const sql = `UPDATE ${fullTable} SET ${setClause} WHERE ${condClause}`
  const rows = await query(dbName, schema, sql, [...values, ...condValues])
  return rows[0]
}

/**
 * 删除数据
 */
async function remove(dbName, schema, table, condition = {}) {
  const dbType = config[dbName].type
  const condKeys = Object.keys(condition)
  const condValues = Object.values(condition)

  if (!condKeys.length) throw new Error('Delete 条件不能为空')

  const condClause =
    dbType === 'postgres'
      ? condKeys.map((k, i) => `"${k}" = $${i + 1}`).join(' AND ')
      : condKeys.map((k) => `\`${k}\` = ?`).join(' AND ')

  const fullTable = dbType === 'postgres' ? `"${schema}"."${table}"` : `\`${schema}\`.\`${table}\``
  const sql = `DELETE FROM ${fullTable} WHERE ${condClause}`
  await query(dbName, schema, sql, condValues)
  return true
}

module.exports = {
  query,
  queryWithPagination,
  insert,
  update,
  remove,
  buildWhereClause,
}

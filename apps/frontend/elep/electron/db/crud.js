const { Pool } = require('pg')
const mysql = require('mysql2/promise')
const config = require('./config.json')

const dbMap = {}

function getDb(dbName) {
  const dbConfig = config[dbName]
  if (!dbConfig) throw new Error(`数据源 ${dbName} 未配置`)

  if (!dbMap[dbName]) {
    if (dbConfig.type === 'postgres') {
      dbMap[dbName] = new Pool(dbConfig)
    } else if (dbConfig.type === 'mysql') {
      dbMap[dbName] = mysql.createPool(dbConfig)
    } else {
      throw new Error(`不支持的数据源类型: ${dbConfig.type}`)
    }
  }

  return dbMap[dbName]
}

/**
 * 工具函数：生成完整表名（含 schema）
 * @param {*} dbType
 * @param {*} schema
 * @param {*} table
 * @returns
 */
function formatTable(dbType, schema, table) {
  if (!schema) throw new Error('缺少 schema 参数')

  if (dbType === 'postgres') {
    return `"${schema}"."${table}"`
  } else if (dbType === 'mysql') {
    return `\`${schema}\`.\`${table}\``
  } else {
    throw new Error(`不支持的数据库类型: ${dbType}`)
  }
}

function formatSql(sql, params = [], dbType = 'postgres') {
  let paramIndex = 1
  let finalSql = sql
  let finalParams = []

  for (const param of params) {
    if (Array.isArray(param)) {
      if (param.length === 0) {
        // 空数组，避免 SQL 语法错误
        throw new Error('IN 查询参数数组不能为空')
      }

      if (dbType === 'postgres') {
        const placeholders = param.map(() => `$${paramIndex++}`)
        finalSql = finalSql.replace('?', `(${placeholders.join(', ')})`)
      } else {
        const placeholders = param.map(() => '?')
        finalSql = finalSql.replace('?', `(${placeholders.join(', ')})`)
      }
      finalParams.push(...param)
    } else {
      if (dbType === 'postgres') {
        finalSql = finalSql.replace('?', `$${paramIndex++}`)
      } else {
        finalSql = finalSql.replace('?', '?')
      }
      finalParams.push(param)
    }
  }

  return { sql: finalSql, params: finalParams }
}

function prepareSqlWithParams(sql, params = {}) {
  const values = []
  let paramIndex = 1

  // 替换 :paramName 为 $1, $2...
  const transformedSql = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, key) => {
    if (!(key in params)) {
      throw new Error(`Missing parameter: ${key}`)
    }

    const value = params[key]

    if (Array.isArray(value)) {
      // 对于 IN (...) 类型的数组，展开为多个 $n
      const placeholders = value.map(() => `$${paramIndex++}`)
      values.push(...value)
      return `(${placeholders.join(', ')})`
    } else {
      values.push(value)
      return `$${paramIndex++}`
    }
  })

  return {
    sql: transformedSql,
    values
  }
}

async function queryNew(dbName, sql, params) {
  const db = getDb(dbName)
  const dbType = config[dbName].type
  const { sql: finalSql, values: finalParams } = prepareSqlWithParams(sql, params)

  if (dbType === 'postgres') {
    const res = await db.query(finalSql, finalParams)
    return res.rows
  } else {
    const [rows] = await db.execute(finalSql, finalParams)
    return rows
  }
}

const { sql, values } = prepareSqlWithParams(
  `
  SELECT * FROM users
  WHERE name = :name
    AND age >= :minAge
    AND status IN :statusList
`,
  {
    name: '李雷',
    minAge: 18,
    statusList: ['active', 'pending']
  }
)

/**
 * 通用查询
 * @param {*} dbName 数据名称
 * @param {*} sql 执行sql脚本
 * @param {*} params 执行参数
 * @returns
 */
async function query(dbName, sql, params = []) {
  const db = getDb(dbName)
  const dbType = config[dbName].type
  const { sql: finalSql, params: finalParams } = formatSql(sql, params, dbType)
  if (dbType === 'postgres') {
    const res = await db.query(finalSql, finalParams)
    return res.rows
  } else {
    const [rows] = await db.execute(finalSql, finalParams)
    return rows
  }
}

// 分页查询
async function queryWithPagination(dbName, baseSql, params = [], { page = 1, pageSize = 20 } = {}) {
  const db = getDb(dbName)
  const dbType = config[dbName].type
  const offset = (page - 1) * pageSize

  let countSql = `SELECT COUNT(*) AS total FROM (${baseSql}) AS t`
  let dataSql = `${baseSql} LIMIT ? OFFSET ?`
  const allParams = [...params, pageSize, offset]

  if (dbType === 'postgres') {
    countSql = `SELECT COUNT(*) FROM (${baseSql}) AS t`
    dataSql = `${baseSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  }

  const totalRes = await query(dbName, countSql, params)
  const total = dbType === 'postgres' ? parseInt(totalRes[0].count, 10) : totalRes[0].total
  const data = await query(dbName, dataSql, allParams)

  return { total, data }
}

/**
 * 插入
 * @param {*} dbName
 * @param {*} schema
 * @param {*} table
 * @param {*} data
 * @returns
 */
async function insert(dbName, schema, table, data) {
  const dbType = config[dbName].type
  const keys = Object.keys(data)
  const values = Object.values(data)
  const fullTable = formatTable(dbType, schema, table)

  if (dbType === 'postgres') {
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const sql = `INSERT INTO ${fullTable} (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`
    const rows = await query(dbName, sql, values)
    return rows[0]
  } else {
    const placeholders = keys.map(() => '?').join(', ')
    const sql = `INSERT INTO ${fullTable} (${keys.join(',')}) VALUES (${placeholders})`
    const res = await query(dbName, sql, values)
    return res.insertId ? { id: res.insertId, ...data } : res[0]
  }
}

// 更新
async function update(dbName, schema, table, data, condition = {}) {
  const dbType = config[dbName].type
  const keys = Object.keys(data)
  const values = Object.values(data)
  const condKeys = Object.keys(condition)
  const condValues = Object.values(condition)

  if (!condKeys.length) throw new Error('Update 条件不能为空')

  let setClause, condClause
  if (dbType === 'postgres') {
    setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
    condClause = condKeys.map((k, i) => `"${k}" = $${i + 1 + keys.length}`).join(' AND ')
  } else {
    setClause = keys.map(k => `\`${k}\` = ?`).join(', ')
    condClause = condKeys.map(k => `\`${k}\` = ?`).join(' AND ')
  }

  const sql = `UPDATE ${formatTable(dbType, schema, table)} SET ${setClause} WHERE ${condClause}`
  const rows = await query(dbName, sql, [...values, ...condValues])
  return rows[0]
}

// 删除
async function remove(dbName, schema, table, condition = {}) {
  const dbType = config[dbName].type
  const condKeys = Object.keys(condition)
  const condValues = Object.values(condition)

  if (!condKeys.length) throw new Error('Delete 条件不能为空')

  const condClause = condKeys.map((k, i) => (dbType === 'postgres' ? `"${k}" = $${i + 1}` : `\`${k}\` = ?`)).join(' AND ')

  const sql = `DELETE FROM ${formatTable(dbType, schema, table)} WHERE ${condClause}`
  await query(dbName, sql, condValues)
  return true
}

module.exports = {
  query,
  queryWithPagination,
  insert,
  update,
  remove
}

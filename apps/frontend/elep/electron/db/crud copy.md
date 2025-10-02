```
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

async function query(dbName, sql, params) {
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

module.exports = {
  query
}
```
优化升级代码，新增queryByPage(dbName, sql, params,{ page = 1, pageSize = 20 } = {})函数，避免直接引入const config = require('./config.json')，里面包含electron。
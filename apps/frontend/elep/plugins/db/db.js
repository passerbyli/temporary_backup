/**
 * 数据库连接池管理
 * 支持多数据源（PostgreSQL、MySQL），单例模式缓存
 */
const { Pool } = require('pg')
const mysql = require('mysql2/promise')
const config = require('./config.json')

const dbMap = {} // 缓存所有连接池实例

/**
 * 获取指定数据源的连接池
 * @param {string} dbName - 数据源名称
 * @returns {Pool|mysql.Pool} - 连接池实例
 */
function getDb(dbName) {
  const dbConfig = config[dbName]
  if (!dbConfig) throw new Error(`数据源 ${dbName} 未配置`)

  if (!dbMap[dbName]) {
    if (dbConfig.type === 'postgres') {
      // 初始化 PostgreSQL 连接池
      dbMap[dbName] = new Pool({
        ...dbConfig,
        max: dbConfig.max || 10, // 最大连接数
        idleTimeoutMillis: dbConfig.idleTimeoutMillis || 30000, // 空闲超时
      })
      dbMap[dbName].on('connect', () => console.log(`[Postgres] Connected: ${dbName}`))
      dbMap[dbName].on('error', (err) => console.error(`[Postgres] Error: ${err.message}`))
    } else if (dbConfig.type === 'mysql') {
      // 初始化 MySQL 连接池
      dbMap[dbName] = mysql.createPool({
        ...dbConfig,
        connectionLimit: dbConfig.connectionLimit || 10,
        waitForConnections: true,
      })
      console.log(`[MySQL] Connected: ${dbName}`)
    } else {
      throw new Error(`不支持的数据源类型: ${dbConfig.type}`)
    }
  }

  return dbMap[dbName]
}

/**
 * 关闭所有连接池
 */
async function closeAllConnections() {
  for (const [name, db] of Object.entries(dbMap)) {
    const type = config[name].type
    if (type === 'postgres') {
      await db.end()
    } else if (type === 'mysql') {
      await db.end()
    }
    console.log(`连接池已关闭: ${name}`)
  }
}

module.exports = { getDb, closeAllConnections }

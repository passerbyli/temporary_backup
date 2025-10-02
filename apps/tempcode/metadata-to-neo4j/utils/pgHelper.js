const { Pool } = require('pg')
const config = require('../config')

const pgPool = new Pool(config.pg)

async function query(sql, params = []) {
  const res = await pgPool.query(sql, params)
  return res.rows
}

module.exports = { pgPool, query }

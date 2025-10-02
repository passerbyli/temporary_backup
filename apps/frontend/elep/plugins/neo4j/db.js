const { Client } = require('pg')
const config = require('./config')

async function query(sql) {
  let client = new Client(config.pg)
  await client.connect()
  const res = await client.query(sql)
  return res.rows
}

module.exports = { query }

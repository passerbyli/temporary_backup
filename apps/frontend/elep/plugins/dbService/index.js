const MySQLDB = require('./mysqlClient')
const PgSQLDB = require('./pgsqlClient')

async function createDBClient(config) {
  let client
  if (config.dbType === 'mysql') {
    client = new MySQLDB(config)
  } else if (config.dbType === 'pgsql' || config.dbType === 'postgres') {
    client = new PgSQLDB(config)
  } else {
    throw new Error('Unsupported dbType')
  }

  await client.connect()
  return client
}

module.exports = {
  createDBClient,
}

const neo4j = require('neo4j-driver')
const config = require('./config')

const driver = neo4j.driver(
  config.neo4j.url,
  neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
  {
    // encrypted: 'ENCRYPTION_OFF', // 4.x 默认不开启SSL
  },
)

async function runCypher(cypher) {
  const session = driver.session()
  await session.run(cypher)
  await session.close()
}

async function queryCypher(cypher) {
  const session = driver.session()
  return await session.run(cypher)
}

module.exports = { runCypher, queryCypher, close: () => driver.close() }

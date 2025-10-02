const neo4j = require('neo4j-driver')
const config = require('../config')

const driver = neo4j.driver(
  config.neo4j.uri,
  neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
)

async function runCypher(cypher, params = {}) {
  const session = driver.session()
  try {
    return await session.run(cypher, params)
  } finally {
    await session.close()
  }
}

async function closeNeo4j() {
  await driver.close()
}

module.exports = { runCypher, closeNeo4j, driver }

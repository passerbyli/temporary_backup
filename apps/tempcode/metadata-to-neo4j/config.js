module.exports = {
  pg: {
    user: 'your_pg_user',
    host: 'your_pg_host',
    database: 'your_pg_db',
    password: 'your_pg_pwd',
    port: 5432,
  },
  neo4j: {
    uri: 'bolt://localhost:7687',
    user: 'neo4j',
    password: 'password',
  },
  batchSize: 1000,
}

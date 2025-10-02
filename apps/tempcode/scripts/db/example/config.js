module.exports = {
  pg1: {
    type: "postgres",
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "yourpass",
    database: "testdb",
    max: 20,
    idleTimeoutMillis: 30000,
  },
  mysql1: {
    type: "mysql",
    host: "localhost",
    port: 3306,
    user: "root",
    password: "yourpass",
    database: "testdb",
    connectionLimit: 10,
  },
};

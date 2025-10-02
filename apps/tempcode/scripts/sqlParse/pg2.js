const pgStructure = require("pg-structure");
const { Client } = require("pg");

const client = new Client({
  user: "lihaomin",
  host: "localhost",
  database: "postgres",
  password: "postgres",
  port: 5432,
});

client.connect();

pgStructure(client)
  .then((structure) => {
    console.log(structure.tables); // 获取所有表
    console.log(structure.views); // 获取所有视图
    console.log(structure.functions); // 获取所有函数
  })
  .catch((err) => console.error(err))
  .finally(() => client.end());

/**
 * pgsql_ast_parser
 * node_xlsx
 * sheetjs_style
 * sql_parser
 * user_agents
 */

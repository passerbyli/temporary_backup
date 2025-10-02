const { parse } = require("pgsql-ast-parser");

// 示例 SQL 查询：包含物理表和临时表（通过 WITH 子句）
const sql = `
  WITH temp_table AS (
    SELECT id, name FROM users WHERE active = true
  )
  SELECT orders.id, orders.date, temp_table.name
  FROM orders
  JOIN temp_table ON orders.user_id = temp_table.id
  WHERE orders.date > '2025-01-01';
`;

// 解析 SQL 查询并生成 AST
const ast = parse(sql);

// 打印抽象语法树（AST）
console.log(JSON.stringify(ast, null, 2));

// 提取物理表和临时表信息
const extractTables = (ast) => {
  const tables = [];

  // 解析 `WITH` 子句中的临时表
  if (ast.with) {
    ast.with.forEach((cte) => {
      if (cte.name) {
        tables.push({ table: cte.name, type: "temporary" });
      }
    });
  }

  // 解析 `FROM` 和 `JOIN` 子句中的物理表
  const processFromJoin = (node) => {
    if (node && node.from) {
      node.from.forEach((tableNode) => {
        if (tableNode.relation) {
          tables.push({ table: tableNode.relation, type: "physical" });
        }
      });
    }
  };

  // 检查查询的主查询部分
  if (ast.select) {
    processFromJoin(ast.select);
  }

  return tables;
};

// 提取表信息
const tables = extractTables(ast);

// 打印表信息
console.log("Extracted Tables:", tables);

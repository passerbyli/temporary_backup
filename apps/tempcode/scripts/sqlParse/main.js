const fs = require("fs");
const path = require("path");
const { parse } = require("sql-parser");
const graphlib = require("graphlib");

// 初始化血缘关系图
const lineageGraph = new graphlib.Graph({ directed: true });

/**
 * 解析一个 SQL 文件并提取血缘关系
 * @param {string} filePath - SQL 文件路径
 * @returns {object} - 表和字段的血缘关系
 */
function parseSqlFile(filePath) {
  const sqlContent = fs.readFileSync(filePath, "utf-8");
  const parsedStatements = parse(sqlContent);

  const lineage = { tables: [], dependencies: [] };

  parsedStatements.forEach((statement) => {
    if (statement.type === "CREATE_TABLE" || statement.type === "CREATE_VIEW") {
      const tableName = statement.name;
      const columns = statement.definition.columns.map((col) => col.name);
      lineage.tables.push({ tableName, columns });

      // 查找依赖表（如 SELECT FROM 子句中的表）
      const fromTables = extractDependencies(statement);
      fromTables.forEach((sourceTable) => {
        lineage.dependencies.push({ source: sourceTable, target: tableName });
      });
    }
  });

  return lineage;
}

/**
 * 从 SQL 语句中提取依赖关系
 * @param {object} statement - SQL AST 语法树节点
 * @returns {string[]} - 依赖的表名列表
 */
function extractDependencies(statement) {
  const dependencies = [];
  if (statement.type === "SELECT") {
    if (statement.from) {
      statement.from.forEach((source) => {
        if (source.type === "table") {
          dependencies.push(source.name);
        }
      });
    }
  }
  return dependencies;
}

/**
 * 遍历所有 SQL 文件并构建血缘图
 * @param {string} dir - 目录路径
 */
function buildLineageGraph(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      buildLineageGraph(filePath);
    } else if (file.endsWith(".sql")) {
      const lineage = parseSqlFile(filePath);

      // 将表和字段添加到血缘图
      lineage.tables.forEach((table) => {
        lineageGraph.setNode(table.tableName, { columns: table.columns });
      });

      // 添加表之间的依赖关系
      lineage.dependencies.forEach((dep) => {
        lineageGraph.setEdge(dep.source, dep.target);
      });
    }
  });
}

// 主程序入口
function main() {
  const schemaDir = path.join(__dirname, "schema"); // SQL 文件存储路径
  buildLineageGraph(schemaDir);

  // 输出血缘图
  console.log("Lineage Graph:", lineageGraph.nodes());
  console.log("Dependencies:", lineageGraph.edges());
}

main();

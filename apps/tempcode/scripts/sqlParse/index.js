const fs = require("fs");
const path = require("path");
const { Parser } = require("node-sql-parser");
const express = require("express");
const app = express();
const port = 3000;

// 解析器初始化
const sqlParser = new Parser();

// 递归读取指定目录及其子目录下的所有 SQL 文件
function readSQLFiles(dir) {
  let sqlFiles = [];

  // 读取当前目录的所有文件和子目录
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // 如果是目录，则递归调用
      sqlFiles = sqlFiles.concat(readSQLFiles(filePath));
    } else if (stats.isFile() && filePath.endsWith(".sql")) {
      // 如果是 SQL 文件，添加到文件列表中
      sqlFiles.push(filePath);
    }
  });

  return sqlFiles;
}

// 解析 SQL 文件
function parseSQLFile(filePath) {
  const sqlContent = fs.readFileSync(filePath, "utf8");
  return sqlParser.astify(sqlContent);
}

// 提取表、字段、外键、存储过程等信息
function extractSchemaInfo(ast, schemaInfo) {
  ast.forEach((statement) => {
    if (statement.type === "create_table") {
      // 提取表和字段
      schemaInfo.tables.push({
        table: statement.table.name,
        columns: statement.columns.map((col) => col.name),
      });
      statement.constraints.forEach((constraint) => {
        if (constraint.type === "foreign_key") {
          // 提取外键关系
          schemaInfo.foreignKeys.push({
            fromTable: statement.table.name,
            fromColumn: constraint.columns[0],
            toTable: constraint.references.table,
            toColumn: constraint.references.columns[0],
          });
        }
      });
    }
    if (statement.type === "create_procedure") {
      schemaInfo.procedures.push(statement.name);
    }
    if (statement.type === "create_function") {
      schemaInfo.functions.push(statement.name);
    }
    if (statement.type === "create_sequence") {
      schemaInfo.sequences.push(statement.name);
    }
  });
}

// 解析目录中的所有 SQL 文件并提取元数据
function parseSchemaFiles(schemaDir) {
  const schemaInfo = {
    tables: [],
    foreignKeys: [],
    procedures: [],
    functions: [],
    sequences: [],
  };

  const sqlFiles = readSQLFiles(schemaDir);
  sqlFiles.forEach((filePath) => {
    const ast = parseSQLFile(filePath);
    extractSchemaInfo(ast, schemaInfo);
  });

  return schemaInfo;
}

// 读取和解析数据库 schema
const schemaDir = path.join(__dirname, "schemas");
const schemaInfo = parseSchemaFiles(schemaDir);

// 打印解析结果
console.log("Tables:", schemaInfo.tables);
console.log("Foreign Keys:", schemaInfo.foreignKeys);
console.log("Procedures:", schemaInfo.procedures);
console.log("Functions:", schemaInfo.functions);
console.log("Sequences:", schemaInfo.sequences);

// 创建 API 用于前端展示血缘关系
app.get("/api/schema", (req, res) => {
  res.json(schemaInfo);
});

// 静态资源服务
app.use(express.static(path.join(__dirname, "public")));

// 启动服务器
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

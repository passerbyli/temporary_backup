const fs = require("fs");
const path = require("path");

// 解析 CREATE TABLE 语句
function parseCreateTable(sqlContent) {
  const tableInfo = [];
  const tableRegex = /CREATE\s+TABLE\s+`?(\w+)`?\s*\(([\s\S]*?)\)\s*;/gi;
  const columnRegex =
    /`(\w+)`\s+(\w+)(?:\((\d+)\))?(?:\s+NOT\s+NULL)?(?:\s+DEFAULT\s+.+?)?(?:\s+COMMENT\s+'(.+?)')?/gi;

  let tableMatch;
  while ((tableMatch = tableRegex.exec(sqlContent)) !== null) {
    const tableName = tableMatch[1];
    const columnDefinitions = tableMatch[2];

    const columns = [];
    let columnMatch;
    while ((columnMatch = columnRegex.exec(columnDefinitions)) !== null) {
      const columnName = columnMatch[1];
      const dataType = columnMatch[2];
      const length = columnMatch[3] ? parseInt(columnMatch[3], 10) : null;
      const comment = columnMatch[4] || "";

      columns.push({
        columnName,
        dataType,
        length,
        comment,
      });
    }

    tableInfo.push({
      tableName,
      columns,
    });
  }
  return tableInfo;
}

// 遍历文件夹中的所有 SQL 文件
function processSqlFiles(directory) {
  const files = fs.readdirSync(directory);
  const allTables = [];

  files.forEach((file) => {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isFile() && file.endsWith(".sql")) {
      console.log(`Processing file: ${file}`);
      const sqlContent = fs.readFileSync(fullPath, "utf-8");
      const tables = parseCreateTable(sqlContent);
      allTables.push(...tables);
    }
  });

  return allTables;
}

// 示例用法
const sqlDirectory = "./sql_scripts"; // 替换为你的 SQL 文件夹路径
const tables = processSqlFiles(sqlDirectory);

console.log("解析结果:");
tables.forEach((table) => {
  console.log(`表名: ${table.tableName}`);
  table.columns.forEach((column) => {
    console.log(
      `  字段名: ${column.columnName}, 类型: ${column.dataType}, 长度: ${column.length}, 注释: ${column.comment}`
    );
  });
});

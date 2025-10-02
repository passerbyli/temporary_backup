const fs = require("fs");

// 读取 SQL 文件
const sqlFilePath = "./sql_input.sql"; // 使用你的路径
const sqlContent = fs.readFileSync(sqlFilePath, "utf-8");

// 正则表达式匹配模式
const insertRegex =
  /INSERT\s+INTO\s+`?(\w+)`?\.`?(\w+)`?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\);/gis;
const updateRegex =
  /UPDATE\s+`?(\w+)`?\.`?(\w+)`?\s+SET\s+([^;]+)\s*WHERE\s+([^;]+);/gis;

let tableData = {};

// 解析 INSERT 语句
let match;
while ((match = insertRegex.exec(sqlContent)) !== null) {
  const schemaName = match[1];
  const tableName = match[2];
  const columns = match[3]
    .split(",")
    .map((col) => col.trim().replace(/`/g, "").replace(/['"]/g, ""));
  const values = match[4]
    .split(",")
    .map((val) => val.trim().replace(/['"]/g, ""));

  const tableKey = `${schemaName}.${tableName}`;
  if (!tableData[tableKey]) {
    tableData[tableKey] = {
      schema: schemaName,
      table: tableName,
      columns: columns,
      operations: [],
    };
  }

  tableData[tableKey].operations.push({
    operation: "INSERT",
    values: values,
    condition: null,
  });
}

// 解析 UPDATE 语句
while ((match = updateRegex.exec(sqlContent)) !== null) {
  const schemaName = match[1];
  const tableName = match[2];
  const setClauses = match[3].split(",").map((clause) => clause.trim());
  const whereClause = match[4];

  const columns = setClauses.map((clause) =>
    clause.split("=")[0].trim().replace(/`/g, "").replace(/['"]/g, "")
  );
  const values = setClauses.map((clause) =>
    clause.split("=")[1].trim().replace(/['"]/g, "")
  );

  const tableKey = `${schemaName}.${tableName}`;
  if (!tableData[tableKey]) {
    tableData[tableKey] = {
      schema: schemaName,
      table: tableName,
      columns: columns,
      operations: [],
    };
  }

  tableData[tableKey].operations.push({
    operation: "UPDATE",
    values: values,
    condition: whereClause,
  });
}

// 转义HTML实体
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 生成 HTML 内容
let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SQL Operations</title>
    <style>
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        table, th, td { border: 1px solid black; }
        th, td { padding: 8px; text-align: left; }
        pre { white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>SQL Operations by Table</h1>
`;

Object.values(tableData).forEach(({ schema, table, columns, operations }) => {
  htmlContent += `
        <h2>Table: ${schema}.${table}</h2>
        <table>
            <tr>
                <th>Operation</th>
                ${columns
                  .map((column) => `<th>${escapeHtml(column)}</th>`)
                  .join("")}
                <th>Condition</th>
            </tr>
    `;

  operations.forEach(({ operation, values, condition }) => {
    htmlContent += `
            <tr>
                <td>${operation}</td>
                ${values
                  .map((value) => `<td>${escapeHtml(value)}</td>`)
                  .join("")}
                <td><pre>${escapeHtml(condition || "")}</pre></td>
            </tr>
        `;
  });

  htmlContent += `
        </table>`;
});

htmlContent += `
</body>
</html>
`;

// 写入 HTML 文件
const outputFilePath = "show.html";
fs.writeFileSync(outputFilePath, htmlContent, "utf-8");

console.log(`HTML file generated: ${outputFilePath}`);

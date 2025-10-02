const fs = require("fs");
const path = require("path");
const { Parser } = require("node-sql-parser");
const xlsx = require("xlsx");

// 创建 SQL 解析器
const parser = new Parser();

// 指定 SQL 文件目录路径
const directoryPath = path.join(__dirname, "sql_files"); // 请根据你的目录路径调整

// 读取目录下的所有 SQL 文件
fs.readdir(directoryPath, (err, files) => {
  if (err) {
    console.error("读取目录失败:", err);
    return;
  }

  const sqlFiles = files.filter((file) => file.endsWith(".sql"));
  const tables = [];
  const comments = {}; // 用于存储字段注释

  sqlFiles.forEach((file) => {
    const filePath = path.join(directoryPath, file);
    console.log(`处理文件: ${filePath}`);

    const sqlContent = fs.readFileSync(filePath, { encoding: "utf-8" });

    try {
      // 解析 SQL 文件内容
      const parsed = parser.astify(sqlContent);

      parsed.forEach((stmt) => {
        if (stmt.type === "create") {
          const table = {
            tableName: stmt.table, // 获取表名
            columns: [],
          };

          // 解析列信息
          stmt.columns.forEach((column) => {
            // 如果有注释，就从 comments 中获取注释
            const columnName = column.name;
            const columnComment = comments[`${stmt.table}.${columnName}`] || ""; // 获取字段的注释

            table.columns.push({
              name: column.name, // 列名
              type: column.type, // 列类型
              constraints: column.constraint
                ? column.constraint.join(", ")
                : "", // 约束条件
              comment: columnComment, // 字段注释
            });
          });

          // 将表信息添加到 tables 数组中
          tables.push(table);
        }
      });

      // 解析注释
      sqlContent.split("\n").forEach((line) => {
        const match = line
          .trim()
          .match(/COMMENT ON COLUMN (\S+)\.(\S+) IS '(.*)';/);
        if (match) {
          const [, tableName, columnName, columnComment] = match;
          comments[`${tableName}.${columnName}`] = columnComment; // 存储字段注释
        }
      });
    } catch (err) {
      console.error(`解析 SQL 时出错 (文件: ${file}):`, err);
    }
  });

  // 输出解析后的表结构
  console.log(tables);

  // 将解析的表数据转换为 Excel 格式
  const data = tables
    .map((table) => {
      return table.columns.map((column) => ({
        TableName: table.tableName,
        ColumnName: column.name,
        ColumnType: column.type,
        Constraints: column.constraints,
        Comment: column.comment, // 添加字段注释
      }));
    })
    .flat();

  // 创建 Excel 工作表
  const ws = xlsx.utils.json_to_sheet(data);

  // 创建 Excel 工作簿并添加工作表
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Tables");

  // 写入 Excel 文件
  const outputPath = `output_${new Date().toISOString()}.xlsx`;
  xlsx.writeFile(wb, outputPath);
  console.log(`Excel 文件已生成: ${outputPath}`);
});

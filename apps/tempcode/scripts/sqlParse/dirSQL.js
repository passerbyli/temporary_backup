const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

// 自动识别数据库类型
function detectDatabaseType(sqlContent) {
  if (/ENGINE\s*=\s*InnoDB|AUTO_INCREMENT|DELIMITER/i.test(sqlContent)) {
    return "MySQL";
  } else if (/IDENTITY|GO|NVARCHAR/i.test(sqlContent)) {
    return "SQL Server";
  } else if (/BEGIN|END|VARCHAR2|PL\/SQL/i.test(sqlContent)) {
    return "Oracle";
  } else if (/SERIAL|BIGSERIAL|RETURNING/i.test(sqlContent)) {
    return "PostgreSQL";
  }
  return "Unknown";
}

// 分析 SQL 文件的作用和涉及的物理表
function analyzeSQLFile(filePath) {
  const sqlContent = fs.readFileSync(filePath, "utf-8");
  const dbType = detectDatabaseType(sqlContent);
  let fileType = "";
  let tables = [];

  switch (dbType) {
    case "MySQL":
      if (/create\s+procedure/i.test(sqlContent)) {
        fileType = "存储过程";
      } else if (/create\s+function/i.test(sqlContent)) {
        fileType = "函数";
      } else if (/create\s+table/i.test(sqlContent)) {
        fileType = "表结构";
      }
      break;

    case "SQL Server":
      if (/create\s+procedure/i.test(sqlContent)) {
        fileType = "存储过程";
      } else if (/create\s+function/i.test(sqlContent)) {
        fileType = "函数";
      } else if (/create\s+table/i.test(sqlContent)) {
        fileType = "表结构";
      }
      break;

    case "Oracle":
      if (/procedure\s|CREATE\s+OR\s+REPLACE\s+PROCEDURE/i.test(sqlContent)) {
        fileType = "存储过程";
      } else if (/CREATE\s+OR\s+REPLACE\s+FUNCTION/i.test(sqlContent)) {
        fileType = "函数";
      } else if (/create\s+table/i.test(sqlContent)) {
        fileType = "表结构";
      }
      break;

    case "PostgreSQL":
      if (/create\s+procedure/i.test(sqlContent)) {
        fileType = "存储过程";
      } else if (/create\s+function/i.test(sqlContent)) {
        fileType = "函数";
      } else if (/create\s+table/i.test(sqlContent)) {
        fileType = "表结构";
      }
      break;

    default:
      fileType = "未知";
  }

  // 提取表名
  const tableRegex = /from\s+([a-zA-Z0-9_]+)|join\s+([a-zA-Z0-9_]+)/gi;
  let match;
  while ((match = tableRegex.exec(sqlContent)) !== null) {
    if (match[1]) {
      tables.push(match[1]);
    } else if (match[2]) {
      tables.push(match[2]);
    }
  }

  return {
    dbType: dbType,
    fileType: fileType || "未知",
    tables: [...new Set(tables)], // 去重
  };
}

// 导出 Excel
async function exportToExcel(data, outputPath) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("SQL分析结果");

  // 添加列
  worksheet.columns = [
    { header: "文件路径", key: "filePath", width: 40 },
    { header: "文件名", key: "fileName", width: 20 },
    { header: "数据库类型", key: "dbType", width: 15 },
    { header: "文件作用", key: "fileRole", width: 20 },
    { header: "涉及的物理表", key: "tables", width: 40 },
  ];

  // 添加数据
  data.forEach((item) => {
    worksheet.addRow({
      filePath: item.filePath,
      fileName: item.fileName,
      dbType: item.dbType,
      fileRole: item.fileRole,
      tables: item.tables.join(", "),
    });
  });

  // 保存 Excel 文件
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Excel 文件已导出到：${outputPath}`);
}

// 主函数
async function main(dirPath, outputPath) {
  const allFiles = getAllFiles(dirPath);
  const sqlFiles = allFiles.filter((file) => path.extname(file) === ".sql");

  const results = sqlFiles.map((filePath) => {
    const { dbType, fileType, tables } = analyzeSQLFile(filePath);
    return {
      filePath,
      fileName: path.basename(filePath),
      dbType,
      fileRole: fileType,
      tables,
    };
  });

  await exportToExcel(results, outputPath);
}

// 执行主程序
const directoryPath = "./sql_directory"; // 指定SQL文件夹路径
const excelOutputPath = "./sql_analysis.xlsx"; // 导出Excel文件路径

main(directoryPath, excelOutputPath);

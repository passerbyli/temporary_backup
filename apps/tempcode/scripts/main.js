const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const mysql = require('mysql2/promise'); // 或改为 pg

// === 数据库配置（MySQL 示例） ===
const dbConfig = {
  host: 'localhost',
  user: 'your_user',
  password: 'your_password',
  database: 'your_db',
};

// === 处理 Excel 文件 ===
function readExcel(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  return data;
}

// === 插入数据库（MySQL） ===
async function insertToMySQL(data) {
  const connection = await mysql.createConnection(dbConfig);
  const table = 'your_table'; // 替换为你自己的表名

  try {
    for (const row of data) {
      const keys = Object.keys(row);
      const values = Object.values(row);
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(', ')}) VALUES (${placeholders})`;
      await connection.execute(sql, values);
    }
    console.log('✅ 插入完成');
  } catch (err) {
    console.error('❌ 插入失败:', err);
  } finally {
    await connection.end();
  }
}

// === 主入口 ===
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('❌ 请传入 Excel 文件路径，例如：node main.js D://example.xlsx');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  console.log(`📥 读取文件: ${filePath}`);

  try {
    const data = readExcel(filePath);
    if (data.length === 0) {
      console.warn('⚠️ Excel 内容为空');
      return;
    }

    await insertToMySQL(data);
  } catch (err) {
    console.error('❌ 错误:', err.message);
  }
}

main();

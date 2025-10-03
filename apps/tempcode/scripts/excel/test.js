const path = require('path');
const ExcelReader = require('./excelReader');
const ExcelWriter = require('./excelWriter');

async function main() {
  const filePath = path.resolve(__dirname, './data/76人.xlsx');
  const reader = new ExcelReader(filePath);
  await reader.load();

  console.log('📄 所有 Sheet 页：', reader.getSheetNames());

  for (const sheetName of reader.getSheetNames()) {
    // console.log(`🧾 [${sheetName}] 表头:`, reader.getHeaders(sheetName));
    // console.log(`📊 [${sheetName}] 数据:`, reader.sheetToJson(sheetName));
  }

  //   reader.getSheetNames()[0].getHeaders("sheet1");

  console.log('📊 [所有 Sheet] 数据:', reader.getHeaders(reader.getSheetNames()[0]));

  // 获取所有 Sheet 页的 JSON 总表
  const allData = reader.getAllSheetsJson();
  //   console.log("✅ 所有 Sheet 的 JSON 数据：", allData);
}

// main().catch((err) => console.error("❌ 错误：", err));

async function run() {
  const writer = new ExcelWriter();

  // 添加 DDL sheet
  writer.addSheets([
    {
      name: 'DDL语句',
      data: [
        {
          table: 'users',
          ddl: `CREATE TABLE users (\n  id INT PRIMARY KEY,\n  name VARCHAR(255)\n);`,
        },
        {
          table: 'orders',
          ddl: `CREATE TABLE orders (\n  order_id INT,\n  user_id INT,\n  PRIMARY KEY (order_id)\n);`,
        },
      ],
      columns: [
        { key: 'table', header: '表名', width: 20 },
        {
          key: 'ddl',
          header: '建表语句',
          width: 80,
          highlightKeywords: true,
          keywords: ['CREATE', 'TABLE', 'PRIMARY KEY'],
          fontColor: 'FF0000',
          fontBold: true,
          headerBgColor: 'FFFFCC',
        },
      ],
    },
  ]);

  // 保存文件
  await writer.save(path.resolve(__dirname, 'output.xlsx'));
  console.log('✅ 已导出 output.xlsx');
}

run();

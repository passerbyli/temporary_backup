const mysql = require("mysql2/promise");
const fs = require("fs-extra");
const path = require("path");

// 数据库连接配置
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "admin2312",
  // database: "sys",
  port: "3306",
  timezone: "+00:00",
};

const OUTPUT_ROOT = path.resolve(__dirname, "exported_schema");

async function getDatabases(connection) {
  const [rows] = await connection.query("SHOW DATABASES");
  let skip = ["information_schema", "mysql", "performance_schema", "sys"];
  skip = [];
  return rows.map((r) => r.Database).filter((db) => !skip.includes(db));
}

async function exportDatabase(connection, dbName) {
  console.log(`📦 正在导出数据库: ${dbName}`);
  const baseDir = path.join(OUTPUT_ROOT, dbName);
  const subDirs = ["tables", "views", "procedures", "functions", "indexes"];

  for (const dir of subDirs) {
    await fs.ensureDir(path.join(baseDir, dir));
  }

  const dbConn = await mysql.createConnection({
    ...dbConfig,
    database: dbName,
  });

  // 表
  const [tables] = await dbConn.query(
    `SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`
  );
  for (const row of tables) {
    const tableName = row[`Tables_in_${dbName}`];
    const [[{ "Create Table": sql }]] = await dbConn.query(
      `SHOW CREATE TABLE \`${tableName}\``
    );
    await fs.writeFile(
      path.join(baseDir, "tables", `${tableName}.sql`),
      sql + ";\n"
    );
  }

  // 视图
  const [views] = await dbConn.query(
    `SHOW FULL TABLES WHERE Table_type = 'VIEW'`
  );
  for (const row of views) {
    const viewName = row[`Tables_in_${dbName}`];
    const [[{ "Create View": sql }]] = await dbConn.query(
      `SHOW CREATE VIEW \`${viewName}\``
    );
    await fs.writeFile(
      path.join(baseDir, "views", `${viewName}.sql`),
      sql + ";\n"
    );
  }

  // 存储过程
  const [procedures] = await dbConn.query(
    `SHOW PROCEDURE STATUS WHERE Db = ?`,
    [dbName]
  );
  for (const proc of procedures) {
    const [[{ "Create Procedure": sql }]] = await dbConn.query(
      `SHOW CREATE PROCEDURE \`${proc.Name}\``
    );
    await fs.writeFile(
      path.join(baseDir, "procedures", `${proc.Name}.sql`),
      sql + ";\n"
    );
  }

  // 函数
  const [functions] = await dbConn.query(`SHOW FUNCTION STATUS WHERE Db = ?`, [
    dbName,
  ]);
  for (const fn of functions) {
    const [[{ "Create Function": sql }]] = await dbConn.query(
      `SHOW CREATE FUNCTION \`${fn.Name}\``
    );
    await fs.writeFile(
      path.join(baseDir, "functions", `${fn.Name}.sql`),
      sql + ";\n"
    );
  }

  // 索引（每个索引单独保存）
  for (const row of tables) {
    const tableName = row[`Tables_in_${dbName}`];
    const [indexes] = await dbConn.query(`SHOW INDEX FROM \`${tableName}\``);

    indexes.forEach((idx, i) => {
      const fileName = `${idx.Key_name || `idx_${i}`}.sql`;
      const filePath = path.join(baseDir, "indexes", fileName);
      const indexDesc =
        `-- Table: ${tableName}, Index: ${idx.Key_name}\n` +
        JSON.stringify(idx, null, 2);
      fs.writeFileSync(filePath, indexDesc + "\n");
    });
  }

  await dbConn.end();
  console.log(`✅ 数据库 ${dbName} 导出完成\n`);
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  const databases = await getDatabases(connection);
  console.log(databases);
  for (const db of databases) {
    await exportDatabase(connection, db);
  }
  await connection.end();
}

main().catch(console.error);

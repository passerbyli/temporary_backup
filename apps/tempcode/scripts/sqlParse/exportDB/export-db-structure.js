// export-db-structure.js
#!/usr/bin/env node

const { Command } = require('commander');
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const fs = require('fs-extra');
const path = require('path');

const program = new Command();

program
  .requiredOption('-t, --type <type>', 'Database type: mysql or pgsql')
  .requiredOption('-h, --host <host>', 'Database host')
  .requiredOption('-u, --user <user>', 'Database user')
  .requiredOption('-p, --password <password>', 'Database password')
  .option('-P, --port <port>', 'Database port')
  .option('-d, --database <database>', 'Target database name (optional)')
  .option('-o, --out <dir>', 'Output directory', 'exported_schema')
  .parse(process.argv);

const options = program.opts();

async function ensureDirs(baseDir, subDirs) {
  for (const dir of subDirs) {
    await fs.ensureDir(path.join(baseDir, dir));
  }
}

async function exportMysql(dbConfig, outputRoot) {
  const connection = await mysql.createConnection(dbConfig);

  const [rows] = await connection.query('SHOW DATABASES');
  const databases = rows
    .map(r => r.Database)
    .filter(db => !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db));

  for (const dbName of databases) {
    if (options.database && dbName !== options.database) continue;

    const baseDir = path.join(outputRoot, dbName);
    const subDirs = ['tables', 'views', 'procedures', 'functions', 'indexes'];
    await ensureDirs(baseDir, subDirs);

    const dbConn = await mysql.createConnection({ ...dbConfig, database: dbName });

    const [tables] = await dbConn.query(`SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`);
    for (const row of tables) {
      const tableName = row[`Tables_in_${dbName}`];
      const [[{ 'Create Table': sql }]] = await dbConn.query(`SHOW CREATE TABLE \\`${tableName}\\``);
      await fs.writeFile(path.join(baseDir, 'tables', `${tableName}.sql`), sql + ';
');
    }

    const [views] = await dbConn.query(`SHOW FULL TABLES WHERE Table_type = 'VIEW'`);
    for (const row of views) {
      const viewName = row[`Tables_in_${dbName}`];
      const [[{ 'Create View': sql }]] = await dbConn.query(`SHOW CREATE VIEW \\`${viewName}\\``);
      await fs.writeFile(path.join(baseDir, 'views', `${viewName}.sql`), sql + ';
');
    }

    const [procedures] = await dbConn.query(`SHOW PROCEDURE STATUS WHERE Db = ?`, [dbName]);
    for (const proc of procedures) {
      const [[{ 'Create Procedure': sql }]] = await dbConn.query(`SHOW CREATE PROCEDURE \\`${proc.Name}\\``);
      await fs.writeFile(path.join(baseDir, 'procedures', `${proc.Name}.sql`), sql + ';
');
    }

    const [functions] = await dbConn.query(`SHOW FUNCTION STATUS WHERE Db = ?`, [dbName]);
    for (const fn of functions) {
      const [[{ 'Create Function': sql }]] = await dbConn.query(`SHOW CREATE FUNCTION \\`${fn.Name}\\``);
      await fs.writeFile(path.join(baseDir, 'functions', `${fn.Name}.sql`), sql + ';
');
    }

    for (const row of tables) {
      const tableName = row[`Tables_in_${dbName}`];
      const [indexes] = await dbConn.query(`SHOW INDEX FROM \\`${tableName}\\``);
      indexes.forEach((idx, i) => {
        const fileName = `${idx.Key_name || `idx_${i}`}.sql`;
        const filePath = path.join(baseDir, 'indexes', fileName);
        const indexDesc = `-- Table: ${tableName}, Index: ${idx.Key_name}\n` + JSON.stringify(idx, null, 2);
        fs.writeFileSync(filePath, indexDesc + '\n');
      });
    }

    await dbConn.end();
    console.log(`✅ MySQL 数据库 ${dbName} 导出完成`);
  }

  await connection.end();
}

async function exportPgsql(pgConfig, outputRoot) {
  const adminClient = new Client({ ...pgConfig, database: 'postgres' });
  await adminClient.connect();

  const res = await adminClient.query(`SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres')`);
  const databases = res.rows.map(r => r.datname);
  await adminClient.end();

  for (const dbName of databases) {
    if (options.database && dbName !== options.database) continue;

    const client = new Client({ ...pgConfig, database: dbName });
    await client.connect();

    const baseDir = path.join(outputRoot, dbName);
    const subDirs = ['tables', 'views', 'functions'];
    await ensureDirs(baseDir, subDirs);

    const tablesRes = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    for (const row of tablesRes.rows) {
      const tableName = row.tablename;
      const defRes = await client.query(`SELECT 'CREATE TABLE ' || relname || E' (\n' || string_agg('  ' || a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod), ',\n') || E'\n);' as ddl FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid WHERE c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped GROUP BY c.relname`, [tableName]);
      if (defRes.rows.length > 0) {
        await fs.writeFile(path.join(baseDir, 'tables', `${tableName}.sql`), defRes.rows[0].ddl + '\n');
      }
    }

    const viewsRes = await client.query(`SELECT table_name FROM information_schema.views WHERE table_schema = 'public'`);
    for (const row of viewsRes.rows) {
      const viewName = row.table_name;
      const defRes = await client.query(`SELECT pg_get_viewdef($1::regclass, true) AS ddl`, [viewName]);
      await fs.writeFile(path.join(baseDir, 'views', `${viewName}.sql`), `CREATE OR REPLACE VIEW ${viewName} AS\n${defRes.rows[0].ddl};\n`);
    }

    const funcsRes = await client.query(`SELECT proname, oid FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public'`);
    for (const row of funcsRes.rows) {
      const defRes = await client.query(`SELECT pg_get_functiondef($1) AS ddl`, [row.oid]);
      await fs.writeFile(path.join(baseDir, 'functions', `${row.proname}.sql`), defRes.rows[0].ddl + '\n');
    }

    await client.end();
    console.log(`✅ PostgreSQL 数据库 ${dbName} 导出完成`);
  }
}

(async () => {
  const outDir = path.resolve(process.cwd(), options.out);

  if (options.type === 'mysql') {
    const port = options.port || 3306;
    await exportMysql({ host: options.host, user: options.user, password: options.password, port }, outDir);
  } else if (options.type === 'pgsql') {
    const port = options.port || 5432;
    await exportPgsql({ host: options.host, user: options.user, password: options.password, port }, outDir);
  } else {
    console.error('❌ 不支持的数据库类型，只支持 mysql 和 pgsql');
    process.exit(1);
  }
})();

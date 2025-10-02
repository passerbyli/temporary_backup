const { Client } = require("pg");
const fs = require("fs-extra");
const path = require("path");
const { spawnSync } = require("child_process");

const config = {
  user: "postgres",
  host: "localhost",
  database: "lihaomin",
  password: "admin2312",
  port: 5432,
};

const OUTPUT_ROOT = path.join(__dirname, "exported_pg_schema");

async function getSchemas(client) {
  const res = await client.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
    and schema_name='dm'
  `);
  return res.rows.map((r) => r.schema_name);
}

async function ensureDirs(dbName, schema) {
  const types = ["tables", "views", "procedures", "functions", "indexes"];
  for (const type of types) {
    await fs.ensureDir(path.join(OUTPUT_ROOT, dbName, schema, type));
  }
}

function filePath(db, schema, type, name) {
  return path.join(OUTPUT_ROOT, db, schema, type, `${name}.sql`);
}

async function exportTables2(client, db, schema) {
  const res = await client.query(
    `
    SELECT tablename FROM pg_tables WHERE schemaname = $1
  `,
    [schema]
  );

  for (const row of res.rows) {
    const table = row.tablename;
    const [{ create_table }] = (
      await client.query(
        `
      SELECT pg_get_tabledef($1::regclass) AS create_table
    `,
        [`${schema}.${table}`]
      )
    ).rows;

    const sql = create_table || `-- No DDL available for ${table}`;
    await fs.writeFile(filePath(db, schema, "tables", table), sql + ";\n");
  }
}

async function exportTables(client, dbName, schema) {
  const res = await client.query(
    `
    SELECT tablename FROM pg_tables WHERE schemaname = $1
  `,
    [schema]
  );

  for (const row of res.rows) {
    const table = row.tablename;
    const file = path.join(
      OUTPUT_ROOT,
      dbName,
      schema,
      "tables",
      `${table}.sql`
    );

    const result = spawnSync(
      "pg_dump",
      [
        "-U",
        config.user,
        "-h",
        config.host,
        "-p",
        config.port.toString(),
        "-d",
        dbName,
        "-s", // schema-only
        "-t",
        `${schema}.${table}`,
      ],
      {
        encoding: "utf-8",
        env: { ...process.env, PGPASSWORD: config.password },
      }
    );

    if (result.status === 0) {
      await fs.writeFile(file, result.stdout);
    } else {
      await fs.writeFile(
        file,
        `-- ❌ Failed to export ${schema}.${table}\n${result.stderr}`
      );
    }
  }

  await client.end();
}

async function exportViews(client, db, schema) {
  const res = await client.query(
    `
    SELECT table_name FROM information_schema.views WHERE table_schema = $1
  `,
    [schema]
  );

  for (const row of res.rows) {
    const view = row.table_name;
    const ddl = (
      await client.query(
        `
      SELECT pg_get_viewdef($1::regclass, true) AS ddl
    `,
        [`${schema}.${view}`]
      )
    ).rows[0]?.ddl;

    if (ddl) {
      const content = `CREATE OR REPLACE VIEW ${schema}.${view} AS\n${ddl};\n`;
      await fs.writeFile(filePath(db, schema, "views", view), content);
    }
  }
}

async function exportFunctions(client, db, schema) {
  const res = await client.query(
    `
    SELECT p.oid, proname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = $1 AND p.prokind = 'f'
  `,
    [schema]
  );

  for (const row of res.rows) {
    const def = await client.query(
      `SELECT pg_get_functiondef($1::oid) AS ddl`,
      [row.oid]
    );
    const sql = def.rows[0]?.ddl;
    if (sql) {
      await fs.writeFile(filePath(db, schema, "functions", row.proname), sql);
    }
  }
}

async function exportProcedures(client, db, schema) {
  const res = await client.query(
    `
    SELECT p.oid, proname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = $1 AND p.prokind = 'p'
  `,
    [schema]
  );

  for (const row of res.rows) {
    const def = await client.query(
      `SELECT pg_get_functiondef($1::oid) AS ddl`,
      [row.oid]
    );
    const sql = def.rows[0]?.ddl;
    if (sql) {
      await fs.writeFile(filePath(db, schema, "procedures", row.proname), sql);
    }
  }
}

async function exportIndexes(client, db, schema) {
  const res = await client.query(
    `
    SELECT t.relname AS table_name,
           i.relname AS index_name,
           pg_get_indexdef(ix.indexrelid) AS indexdef
    FROM pg_class t
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    WHERE ns.nspname = $1 AND t.relkind = 'r'
  `,
    [schema]
  );

  for (const row of res.rows) {
    await fs.writeFile(
      filePath(db, schema, "indexes", row.index_name),
      row.indexdef + ";\n"
    );
  }
}

async function exportSchema(client, dbName, schema) {
  console.log(`📦 导出 schema: ${schema}`);
  await ensureDirs(dbName, schema);

  await exportTables(client, dbName, schema);
  // await exportViews(client, dbName, schema);
  // await exportFunctions(client, dbName, schema);
  // await exportProcedures(client, dbName, schema);
  // await exportIndexes(client, dbName, schema);

  console.log(`✅ schema ${schema} 导出完成`);
}

async function main() {
  const dbName = config.database;
  const client = new Client(config);
  await client.connect();

  const schemas = await getSchemas(client);

  for (const schema of schemas) {
    await exportSchema(client, dbName, schema);
  }
  // await exportSchema(client, "lihaomin", "pg_catalog");

  await client.end();
  console.log(`🎉 数据库 ${dbName} 所有 schema 导出完成`);
}

main().catch(console.error);

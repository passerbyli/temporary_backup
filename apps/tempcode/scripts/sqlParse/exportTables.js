const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

const OUTPUT_ROOT = path.join(__dirname, "exported_pg_schema");
const config = {
  user: "postgres",
  host: "localhost",
  database: "lihaomin",
  password: "admin2312",
  port: 5432,
};

async function exportTables(dbName, schema) {
  const { Client } = require("pg");
  const client = new Client({ ...config, database: dbName });
  await client.connect();

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

exportTables("lihaomin", "pg_catalog");

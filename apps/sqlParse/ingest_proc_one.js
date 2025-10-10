#!/usr/bin/env node
/**
 * 导入“单个存储过程或函数”，并按 JSON 重建其源/目标表关联：
 * - 若过程/函数已存在：先删 relation（source/target 两表），再按 JSON 重新插入；
 * - 不删除 metadata_schema / metadata_table；
 * - 所有名称用 schema 前缀全名存储（schema.name）；
 * - procedure_desc 一律保持 NULL。
 *
 * 用法：
 *   node ingest_proc_one.js ./meta.json
 *
 * JSON 示例：
 * {
 *   "procedures": [{ "type": "PROCEDURE", "schema": "public", "name": "proc_sales_summary" }],
 *   "functionNames": [],
 *   "sourceTables": [{ "schema": "staging", "table": "sales_data", "isTemporary": false }],
 *   "targetTables": [{ "schema": "report", "table": "sales_summary", "isTemporary": false }]
 * }
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const SCHEMA = 'meta_data_ds'; // 统一 schema
const DB = {
  host: 'localhost',
  port: '5432',
  user: 'postgres',
  password: 'admin',
  database: 'lihaomin',
};

const toBool = (v) => (v === true || (typeof v === 'string' && v.toLowerCase() === 'true') ? true : false);
const hasDot = (s) => typeof s === 'string' && s.includes('.');
const qname = (schema, name) => `${schema}.${name}`;

/* ========== 基础 get-or-create，不做删除 ========== */
async function getOrCreateSchema(client, schemaName) {
  const q = await client.query(`SELECT id FROM ${SCHEMA}.metadata_schema WHERE schema_name=$1 LIMIT 1`, [schemaName]);
  if (q.rowCount) return q.rows[0].id;
  const id = uuidv4();
  await client.query(`INSERT INTO ${SCHEMA}.metadata_schema (id, schema_name, schema_desc) VALUES ($1,$2,$3)`, [
    id,
    schemaName,
    null,
  ]);
  return id;
}

async function getOrCreateTable(client, schemaName, tableName, isTemporary) {
  const schemaId = await getOrCreateSchema(client, schemaName);
  const q = await client.query(
    `SELECT id, is_temporary FROM ${SCHEMA}.metadata_table
     WHERE schema_id=$1 AND table_name=$2 LIMIT 1`,
    [schemaId, tableName],
  );

  if (q.rowCount) {
    const id = q.rows[0].id;
    const needTmp = !!toBool(isTemporary);
    if (!!q.rows[0].is_temporary !== needTmp) {
      await client.query(
        `UPDATE ${SCHEMA}.metadata_table
           SET is_temporary=$1, updated_at=now()
         WHERE id=$2`,
        [needTmp, id],
      );
    }
    // 回填冗余 schema_name（若列存在）
    await client.query(
      `UPDATE ${SCHEMA}.metadata_table
         SET schema_name=$1, updated_at=now()
       WHERE id=$2 AND (schema_name IS DISTINCT FROM $1)`,
      [schemaName, id],
    );
    return { id, schemaId, tableName };
  }

  const id = uuidv4();
  await client.query(
    `INSERT INTO ${SCHEMA}.metadata_table
      (id, table_name, table_desc, table_type, schema_id, is_temporary, schema_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, tableName, null, 'base', schemaId, !!toBool(isTemporary), schemaName],
  );
  return { id, schemaId, tableName };
}

/**
 * 查找或创建 procedure（或 function）：
 * - 存储为带 schema 的全名（schema.name）；
 * - 返回 { id, schemaId, procedureNameFull, existed }
 * - 如果旧数据是未带 schema 的名字，会自动升级为带 schema 的全名。
 */
async function findOrCreateProcedure(client, schemaName, rawName) {
  const schemaId = await getOrCreateSchema(client, schemaName);
  const fullName = hasDot(rawName) ? rawName : qname(schemaName, rawName);

  // 先按全名查
  let q = await client.query(
    `SELECT id FROM ${SCHEMA}.metadata_procedure
     WHERE schema_id=$1 AND procedure_name=$2 LIMIT 1`,
    [schemaId, fullName],
  );
  if (q.rowCount) {
    const id = q.rows[0].id;
    await client.query(
      `UPDATE ${SCHEMA}.metadata_procedure
         SET schema_name=$1, updated_at=now()
       WHERE id=$2 AND (schema_name IS DISTINCT FROM $1)`,
      [schemaName, id],
    );
    return { id, schemaId, procedureNameFull: fullName, existed: true };
  }

  // 兼容：旧记录未带 schema，找到则升级为全名
  q = await client.query(
    `SELECT id FROM ${SCHEMA}.metadata_procedure
     WHERE schema_id=$1 AND procedure_name=$2 LIMIT 1`,
    [schemaId, rawName],
  );
  if (q.rowCount) {
    const id = q.rows[0].id;
    await client.query(
      `UPDATE ${SCHEMA}.metadata_procedure
         SET procedure_name=$1, schema_name=$2, procedure_desc=NULL, updated_at=now()
       WHERE id=$3`,
      [fullName, schemaName, id],
    );
    return { id, schemaId, procedureNameFull: fullName, existed: true };
  }

  // 新建
  const id = uuidv4();
  await client.query(
    `INSERT INTO ${SCHEMA}.metadata_procedure
      (id, procedure_name, procedure_desc, schema_id, procedure_script, input_params_text, output_params_text, schema_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, fullName, null, schemaId, null, null, null, schemaName],
  );
  return { id, schemaId, procedureNameFull: fullName, existed: false };
}

/* ========== 关系删除 + 重建（只对 relations） ========== */

async function deleteRelationsForProcedure(client, procedureId) {
  // 仅删除两张关系表的该 procedure 的记录；不动 metadata_table / metadata_schema / metadata_procedure
  await client.query(`DELETE FROM ${SCHEMA}.metadata_procedure_source_table WHERE procedure_id=$1`, [procedureId]);
  await client.query(`DELETE FROM ${SCHEMA}.metadata_procedure_target_table WHERE procedure_id=$1`, [procedureId]);
}

async function insertSourceRel(client, { procedureId, procedureNameFull, tableId, schemaId, schemaName, tableName }) {
  const id = uuidv4();
  const tableFull = hasDot(tableName) ? tableName : qname(schemaName, tableName);
  await client.query(
    `INSERT INTO ${SCHEMA}.metadata_procedure_source_table
      (id, procedure_id, procedure_name, source_table_id, source_table_name, source_table_desc, schema_id, schema_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, procedureId, procedureNameFull, tableId, tableFull, null, schemaId, schemaName],
  );
}

async function insertTargetRel(client, { procedureId, procedureNameFull, tableId, schemaId, schemaName, tableName }) {
  const id = uuidv4();
  const tableFull = hasDot(tableName) ? tableName : qname(schemaName, tableName);
  await client.query(
    `INSERT INTO ${SCHEMA}.metadata_procedure_target_table
      (id, procedure_id, procedure_name, target_table_id, target_table_name, target_table_desc, schema_id, schema_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, procedureId, procedureNameFull, tableId, tableFull, null, schemaId, schemaName],
  );
}

/* ========== 主流程 ========== */
(async function main() {
  try {
    const jsonPath = process.argv[2];
    if (!jsonPath) {
      console.error('Usage: node ingest_proc_one.js <jsonFile>');
      process.exit(1);
    }
    const payload = JSON.parse(fs.readFileSync(path.resolve(jsonPath), 'utf-8'));

    // 解析“唯一”的过程或函数
    let schemaName = null,
      procName = null;
    if (Array.isArray(payload.procedures) && payload.procedures.length > 0) {
      schemaName = payload.procedures[0].schema || 'public';
      procName = payload.procedures[0].name;
    } else if (Array.isArray(payload.functionNames) && payload.functionNames.length > 0) {
      const f = payload.functionNames[0];
      if (typeof f === 'string') {
        schemaName = 'public';
        procName = f;
      } else {
        schemaName = f.schema || 'public';
        procName = f.name;
      }
    } else {
      throw new Error('JSON must contain exactly one procedure or one functionName.');
    }
    if (!procName) throw new Error('Procedure/function name is required.');

    const client = new Client(DB);
    await client.connect();
    await client.query('BEGIN');

    // 1) 查找或创建 procedure（不删除该记录）
    const { id: procedureId, procedureNameFull, existed } = await findOrCreateProcedure(client, schemaName, procName);

    // 2) 如果 procedure 已存在：先删除其 relations（source/target）
    if (existed) {
      await deleteRelationsForProcedure(client, procedureId);
    }

    // 3) 处理 sourceTables：不删除表本身；查不到则新增；然后插入 relation
    const sourceTables = Array.isArray(payload.sourceTables) ? payload.sourceTables : [];
    for (const st of sourceTables) {
      const s = st.schema || 'public';
      const t = st.table;
      const isTmp = toBool(st.isTemporary);
      const { id: tableId, schemaId } = await getOrCreateTable(client, s, t, isTmp);
      await insertSourceRel(client, {
        procedureId,
        procedureNameFull,
        tableId,
        schemaId,
        schemaName: s,
        tableName: t,
      });
    }

    // 4) 处理 targetTables：同上
    const targetTables = Array.isArray(payload.targetTables) ? payload.targetTables : [];
    for (const tt of targetTables) {
      const s = tt.schema || 'public';
      const t = tt.table;
      const isTmp = toBool(tt.isTemporary);
      const { id: tableId, schemaId } = await getOrCreateTable(client, s, t, isTmp);
      await insertTargetRel(client, {
        procedureId,
        procedureNameFull,
        tableId,
        schemaId,
        schemaName: s,
        tableName: t,
      });
    }

    await client.query('COMMIT');
    await client.end();
    console.log(
      `OK — ${procedureNameFull}: relations rebuilt (sources=${sourceTables.length}, targets=${targetTables.length}).`,
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

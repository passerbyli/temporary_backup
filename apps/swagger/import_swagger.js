#!/usr/bin/env node
/**
 * OpenAPI/Swagger -> PostgreSQL (metadata_api, metadata_api_field)
 * - 先删除旧字段再新增（同一 API）
 * - 识别并写入入参/出参各层级 description/title
 * - 支持 $ref 解析（#/components 或 #/definitions）
 * - 合并 allOf（合并 properties/required/description）
 *
 * Usage:
 *   node import_swagger.js ./swagger.json <microservice_name>
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const SCHEMA = 'meta_data_ds';

/* ----------------------- 小工具 ----------------------- */
function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}
function firstKey(obj) {
  if (!obj || typeof obj !== 'object') return undefined;
  const ks = Object.keys(obj);
  return ks.length ? ks[0] : undefined;
}
function deepClone(o) {
  return JSON.parse(JSON.stringify(o || null));
}

/* ----------------------- 枚举所有操作 ----------------------- */
function enumerateOperations(doc) {
  const out = [];
  if (!doc.paths) return out;
  for (const p of Object.keys(doc.paths)) {
    const item = doc.paths[p] || {};
    for (const m of ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']) {
      if (item[m]) out.push({ method: m.toUpperCase(), path: p, op: item[m] });
    }
  }
  return out;
}

/* ----------------------- $ref 解析 & allOf 合并 ----------------------- */
function getByJsonPointer(root, pointer) {
  // expects pointer like "#/components/schemas/User"
  if (!pointer || !pointer.startsWith('#/')) return null;
  const parts = pointer
    .slice(2)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = root;
  for (const key of parts) {
    if (!cur || typeof cur !== 'object' || !(key in cur)) return null;
    cur = cur[key];
  }
  return cur;
}

function deref(root, schema, seen = new Set()) {
  if (!schema || typeof schema !== 'object') return schema;

  // 处理 $ref
  if (schema.$ref && typeof schema.$ref === 'string') {
    if (seen.has(schema.$ref)) return {}; // 防循环
    seen.add(schema.$ref);
    const target = getByJsonPointer(root, schema.$ref);
    if (!target) return {};
    // 合并：ref 的目标为主体，当前 schema 的其它键覆盖（但通常不会有）
    const merged = { ...deepClone(deref(root, target, seen)), ...deepClone({ ...schema, $ref: undefined }) };
    return deref(root, merged, seen);
  }

  // 处理 allOf：合并属性/required/描述
  if (Array.isArray(schema.allOf) && schema.allOf.length) {
    const base = {};
    const reqSet = new Set();
    let desc = schema.description || null;
    for (const part of schema.allOf) {
      const d = deref(root, part, seen);
      // 合并 type/properties/items/additionalProperties
      if (d.type && !base.type) base.type = d.type;
      if (d.properties) base.properties = { ...(base.properties || {}), ...d.properties };
      if (d.items) base.items = d.items;
      if (d.additionalProperties !== undefined) base.additionalProperties = d.additionalProperties;
      if (Array.isArray(d.required)) d.required.forEach((x) => reqSet.add(x));
      // 合并描述（优先已有，否则取 part 的）
      if (!desc && d.description) desc = d.description;
    }
    const rest = { ...schema };
    delete rest.allOf;
    const merged = {
      ...base,
      required: reqSet.size ? Array.from(reqSet) : undefined,
      description: desc || base.description || rest.description,
      ...rest,
    };
    return deref(root, merged, seen);
  }

  // 处理 oneOf/anyOf：保守起见，不强行合并，只带上描述
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    // 给出个宽松的 object/array 推断，尽量保留 description
    const copy = { ...schema };
    return copy;
  }

  // 深层遍历 children
  const copy = { ...schema };
  if (copy.properties) {
    copy.properties = { ...copy.properties };
    for (const k of Object.keys(copy.properties)) {
      copy.properties[k] = deref(root, copy.properties[k], seen);
    }
  }
  if (copy.items) {
    if (Array.isArray(copy.items)) copy.items = copy.items.map((x) => deref(root, x, seen));
    else copy.items = deref(root, copy.items, seen);
  }
  if (copy.additionalProperties && typeof copy.additionalProperties === 'object') {
    copy.additionalProperties = deref(root, copy.additionalProperties, seen);
  }
  return copy;
}

/* ----------------------- 提取请求/响应/参数 ----------------------- */
function getRequestSchema(doc, op) {
  // OAS3
  if (op.requestBody && op.requestBody.content) {
    const key = Object.keys(op.requestBody.content).find((k) => /json/i.test(k));
    if (key) return op.requestBody.content[key].schema || null;
  }
  // Swagger2
  if (Array.isArray(op.parameters)) {
    const body = op.parameters.find((p) => p.in === 'body' && p.schema);
    if (body) return body.schema;
  }
  return null;
}
function getInParams(op) {
  const arr = [];
  if (Array.isArray(op.parameters)) {
    for (const p of op.parameters) {
      if (['path', 'query', 'header', 'cookie'].includes(p.in)) arr.push(p);
    }
  }
  return arr;
}
function getResponseSchema(op) {
  if (!op.responses) return null;
  const keys = Object.keys(op.responses);
  const prefer = keys.includes('200') ? ['200'] : keys.filter((k) => /^2\d\d$/.test(k));
  for (const code of prefer) {
    const r = op.responses[code];
    if (!r) continue;
    // OAS3
    if (r.content) {
      const k = Object.keys(r.content).find((x) => /json/i.test(x));
      if (k && r.content[k].schema) return r.content[k].schema;
    }
    // Swagger2
    if (r.schema) return r.schema;
  }
  return null;
}
function getRequestExample(op) {
  if (op.requestBody && op.requestBody.content) {
    const k = Object.keys(op.requestBody.content).find((x) => /json/i.test(x));
    if (k) {
      const c = op.requestBody.content[k];
      if (c.example) return c.example;
      if (c.examples) {
        const first = c.examples[firstKey(c.examples)];
        if (first && first.value !== undefined) return first.value;
      }
    }
  }
  if (Array.isArray(op.parameters)) {
    const b = op.parameters.find((p) => p.in === 'body' && p['x-example']);
    if (b) return b['x-example'];
  }
  return null;
}
function getResponseExample(op) {
  if (!op.responses) return null;
  for (const code of Object.keys(op.responses)) {
    const r = op.responses[code];
    if (r && r.content) {
      const k = Object.keys(r.content).find((x) => /json/i.test(x));
      if (k) {
        const c = r.content[k];
        if (c.example) return c.example;
        if (c.examples) {
          const first = c.examples[firstKey(c.examples)];
          if (first && first.value !== undefined) return first.value;
        }
      }
    }
  }
  for (const code of Object.keys(op.responses)) {
    const r = op.responses[code];
    if (r && r['x-example'] !== undefined) return r['x-example'];
  }
  return null;
}

/* ----------------------- 规则/类型 归一化 ----------------------- */
function extractRuleExt(schema) {
  if (!schema || typeof schema !== 'object') return null;
  const keys = [
    'enum',
    'format',
    'pattern',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
    'uniqueItems',
    'minProperties',
    'maxProperties',
    'multipleOf',
    'default',
    'examples',
  ];
  const obj = pick(schema, keys);
  return Object.keys(obj).length ? obj : null;
}
function normalizeTypes(schema) {
  if (!schema) return { data_type: null, is_array: null, item_data_type: null };
  let t = schema.type;
  if (!t && (schema.properties || schema.additionalProperties)) t = 'object';
  if (!t && schema.items) t = 'array';

  const data_type = Array.isArray(t) ? t[0] : t || null;
  const is_array = data_type === 'array';
  let item_data_type = null;
  if (is_array) {
    const items = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    if (items) {
      if (items.type) item_data_type = Array.isArray(items.type) ? items.type[0] : items.type;
      else if (items.properties || items.additionalProperties) item_data_type = 'object';
    }
  }
  return { data_type, is_array, item_data_type };
}

/* ----------------------- DB 写入 ----------------------- */
async function upsertApi(client, microserviceName, apiPath, method, op) {
  const reqExample = getRequestExample(op);
  const respExample = getResponseExample(op);
  const apiName = op.summary || op.operationId || `${method} ${apiPath}`;
  const apiDesc = op.description || null;

  const { rows } = await client.query(
    `SELECT id FROM ${SCHEMA}.metadata_api
     WHERE api_method=$1 AND microservice_name=$2 AND api_path=$3`,
    [method, microserviceName, apiPath],
  );

  if (rows.length) {
    const apiId = rows[0].id;
    await client.query(
      `UPDATE ${SCHEMA}.metadata_api
         SET api_name=$1, api_desc=$2, request_example=$3, response_example=$4, updated_at=now()
       WHERE id=$5`,
      [apiName, apiDesc, reqExample, respExample, apiId],
    );
    return apiId;
  } else {
    const apiId = uuidv4();
    await client.query(
      `INSERT INTO ${SCHEMA}.metadata_api
        (id, api_name, api_path, api_method, api_desc, microservice_name, request_example, response_example)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [apiId, apiName, apiPath, method, apiDesc, microserviceName, reqExample, respExample],
    );
    return apiId;
  }
}

async function insertField(client, rec) {
  const cols = [
    'id',
    'api_id',
    'field_name',
    'io_type',
    'data_type',
    'is_array',
    'item_data_type',
    'field_desc',
    'required',
    'default_value',
    'example_value',
    'length',
    'parent_field_id',
    'path',
    'level',
    'seq',
    'rule_ext',
  ];
  const vals = cols.map((_, i) => `$${i + 1}`);
  const args = cols.map((c) => (rec[c] === undefined ? null : rec[c]));
  const sql = `INSERT INTO ${SCHEMA}.metadata_api_field(${cols.join(',')})
               VALUES (${vals.join(',')})
               ON CONFLICT DO NOTHING`;
  await client.query(sql, args);
}

/* 递归展开 schema（含 $ref / allOf）并写入 */
async function expandSchema(
  rootDoc,
  client,
  apiId,
  ioType,
  fieldName,
  rawSchema,
  parentRequiredSet,
  parentId,
  nodePath,
  level,
  seq,
) {
  const schema = deref(rootDoc, rawSchema || {});
  const { data_type, is_array, item_data_type } = normalizeTypes(schema);

  const id = uuidv4();
  const field_desc = schema.description || schema.title || null;
  const required = parentRequiredSet ? parentRequiredSet.has(fieldName) : false;
  const default_value = schema.default !== undefined ? String(schema.default) : null;
  const example_value =
    schema.example !== undefined
      ? typeof schema.example === 'string'
        ? schema.example
        : JSON.stringify(schema.example)
      : null;
  const length = schema.maxLength !== undefined ? schema.maxLength : null;
  const rule_ext = extractRuleExt(schema);

  await insertField(client, {
    id,
    api_id: apiId,
    field_name: fieldName,
    io_type: ioType,
    data_type,
    is_array: is_array === true,
    item_data_type: item_data_type || null,
    field_desc,
    required,
    default_value,
    example_value,
    length,
    parent_field_id: parentId || null,
    path: nodePath,
    level,
    seq,
    rule_ext,
  });

  // 数组 -> items
  if (is_array && schema.items) {
    const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    await expandSchema(rootDoc, client, apiId, ioType, 'items', itemsSchema, null, id, `${nodePath}[0]`, level + 1, 1);
    return id;
  }

  // 对象 -> properties
  if ((data_type === 'object' || schema.properties) && schema.properties) {
    const reqSet = new Set(Array.isArray(schema.required) ? schema.required : []);
    let childSeq = 1;
    for (const key of Object.keys(schema.properties)) {
      await expandSchema(
        rootDoc,
        client,
        apiId,
        ioType,
        key,
        schema.properties[key],
        reqSet,
        id,
        `${nodePath}.${key}`,
        level + 1,
        childSeq++,
      );
    }
  }
  return id;
}

/* path/query/header/cookie 参数 */
async function writeInParams(client, apiId, params) {
  const groups = {
    path: params.filter((p) => p.in === 'path'),
    query: params.filter((p) => p.in === 'query'),
    header: params.filter((p) => p.in === 'header'),
    cookie: params.filter((p) => p.in === 'cookie'),
  };
  for (const loc of Object.keys(groups)) {
    const arr = groups[loc];
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      // OAS3: schema；Swagger2: type/items
      const baseSchema = p.schema || (p.type ? { type: p.type, items: p.items } : {});
      const schema = deref(globalDoc, baseSchema || {});
      const { data_type, is_array, item_data_type } = normalizeTypes(schema);
      const field_desc = p.description || schema.description || schema.title || null;
      const example_value =
        p.example !== undefined
          ? typeof p.example === 'string'
            ? p.example
            : JSON.stringify(p.example)
          : schema.example !== undefined
            ? JSON.stringify(schema.example)
            : null;
      await insertField(client, {
        id: uuidv4(),
        api_id: apiId,
        field_name: p.name,
        io_type: 'in',
        data_type,
        is_array: !!is_array,
        item_data_type: item_data_type || null,
        field_desc,
        required: !!p.required,
        default_value: schema.default !== undefined ? String(schema.default) : null,
        example_value,
        length: schema.maxLength !== undefined ? schema.maxLength : null,
        parent_field_id: null,
        path: `${loc}.${p.name}`,
        level: 0,
        seq: i + 1,
        rule_ext: extractRuleExt(schema),
      });
    }
  }
}

/* 导入单个接口（严格先删后增） */
async function importOneOperation(client, doc, microserviceName, apiPath, method, op) {
  // 1) 接口 upsert
  const apiId = await upsertApi(client, microserviceName, apiPath, method, op);

  // 2) 先删除旧字段（该接口全部字段），再重建
  await client.query(`DELETE FROM ${SCHEMA}.metadata_api_field WHERE api_id=$1`, [apiId]);

  // 3) 入参：path/query/header/cookie
  const inParams = getInParams(op);
  if (inParams.length) {
    await writeInParams(client, apiId, inParams);
  }

  // 4) 入参：requestBody / body
  const reqSchemaRaw = getRequestSchema(doc, op);
  if (reqSchemaRaw) {
    const rootName = 'body';
    await expandSchema(doc, client, apiId, 'in', rootName, reqSchemaRaw, new Set(), null, 'body', 0, 1);
  }

  // 5) 出参：responses 2xx
  const respSchemaRaw = getResponseSchema(op);
  if (respSchemaRaw) {
    const rootName = 'body';
    await expandSchema(doc, client, apiId, 'out', rootName, respSchemaRaw, new Set(), null, 'body', 0, 1);
  }
}

/* ----------------------- main ----------------------- */
let globalDoc = null;

(async function main() {
  try {
    const swaggerPath = process.argv[2];
    const microserviceName = process.argv[3];
    if (!swaggerPath || !microserviceName) {
      console.error('Usage: node import_swagger.js <swagger.json> <microservice_name>');
      process.exit(1);
    }

    const raw = fs.readFileSync(path.resolve(swaggerPath), 'utf8');
    globalDoc = JSON.parse(raw);

    const client = new Client({
      host: 'localhost',
      port: '5432',
      user: 'postgres',
      password: 'admin',
      database: 'lihaomin',
    }); // 从环境变量读取 PG 连接
    await client.connect();

    const ops = enumerateOperations(globalDoc);
    if (!ops.length) {
      console.warn('No operations found in swagger.json');
      await client.end();
      process.exit(0);
    }

    for (const { method, path: apiPath, op } of ops) {
      await client.query('BEGIN');
      try {
        await importOneOperation(client, globalDoc, microserviceName, apiPath, method, op);
        await client.query('COMMIT');
        console.log(`[OK] ${method} ${apiPath}`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[FAIL] ${method} ${apiPath}:`, e.stack || e.message);
      }
    }

    await client.end();
    console.log('Done.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

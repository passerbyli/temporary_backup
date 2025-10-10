#!/usr/bin/env node
/**
 * OpenAPI/Swagger -> PostgreSQL (bulk)
 * - 数据库配置直接写在脚本里
 * - 先完整解析，再一次事务内批量写入
 * - metadata_api：批量 UPSERT（依据唯一索引 api_method+microservice_name+api_path）
 * - metadata_api_field：严格“先删后增”，分批批量 INSERT
 *
 * 用法：
 *   node import_swagger_bulk.js ./swagger.json <microservice_name>
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const SCHEMA = 'meta_data_ds';

/** ========= 数据库配置（按需修改） ========= */
const DB = {
  host: 'localhost',
  port: '5432',
  user: 'postgres',
  password: 'admin',
  database: 'lihaomin',
};

/** ========= 小工具 ========= */
function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return Object.keys(out).length ? out : null;
}
function deepClone(o) {
  return JSON.parse(JSON.stringify(o ?? null));
}
function firstKey(obj) {
  return obj && typeof obj === 'object' ? Object.keys(obj)[0] : undefined;
}
function sig(method, microservice, apiPath) {
  return `${method} ${microservice} ${apiPath}`;
}

/** ========= 枚举操作 ========= */
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

/** ========= $ref 解析 & allOf 合并 ========= */
function getByJsonPointer(root, pointer) {
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
    if (seen.has(schema.$ref)) return {};
    seen.add(schema.$ref);
    const target = getByJsonPointer(root, schema.$ref);
    if (!target) return {};
    const merged = { ...deepClone(deref(root, target, seen)), ...deepClone({ ...schema, $ref: undefined }) };
    return deref(root, merged, seen);
  }

  // 处理 allOf 合并
  if (Array.isArray(schema.allOf) && schema.allOf.length) {
    const base = {};
    const reqSet = new Set();
    let desc = schema.description || null;
    for (const part of schema.allOf) {
      const d = deref(root, part, seen);
      if (d.type && !base.type) base.type = d.type;
      if (d.properties) base.properties = { ...(base.properties || {}), ...d.properties };
      if (d.items) base.items = d.items;
      if (d.additionalProperties !== undefined) base.additionalProperties = d.additionalProperties;
      if (Array.isArray(d.required)) d.required.forEach((x) => reqSet.add(x));
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

  // 深层递归
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

/** ========= 提取 schema / 参数 / 示例 ========= */
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
    if (r.content) {
      const k = Object.keys(r.content).find((x) => /json/i.test(x));
      if (k && r.content[k].schema) return r.content[k].schema;
    }
    if (r.schema) return r.schema;
  }
  return null;
}
function getRequestExample(op) {
  if (op.requestBody && op.requestBody.content) {
    const k = Object.keys(op.requestBody.content).find((x) => /json/i.test(x));
    if (k) {
      const c = op.requestBody.content[k];
      if (c.example !== undefined) return c.example;
      if (c.examples) {
        const first = c.examples[firstKey(c.examples)];
        if (first && first.value !== undefined) return first.value;
      }
    }
  }
  if (Array.isArray(op.parameters)) {
    const b = op.parameters.find((p) => p.in === 'body' && p['x-example'] !== undefined);
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
        if (c.example !== undefined) return c.example;
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

/** ========= 规则/类型归一 ========= */
function extractRuleExt(schema) {
  if (!schema || typeof schema !== 'object') return null;
  return pick(schema, [
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
  ]);
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

/** ========= 解析为内存结构 =========
 * apis: [{id, method, path, microservice, api_name, api_desc, request_example, response_example}]
 * fields: [{api_sig, field columns...}] 其中 api_id 暂空，写库前再回填
 */
function parseSwaggerToMemory(doc, microservice) {
  const ops = enumerateOperations(doc);
  const apis = [];
  const fields = [];

  for (const { method, path: apiPath, op } of ops) {
    const api = {
      id: uuidv4(), // 先占位（最终以 UPSERT RETURNING 为准）
      method,
      path: apiPath,
      microservice,
      api_name: op.summary || op.operationId || `${method} ${apiPath}`,
      api_desc: op.description || null,
      request_example: getRequestExample(op) || null,
      response_example: getResponseExample(op) || null,
    };
    apis.push(api);

    // 入参：path/query/header/cookie
    const inParams = getInParams(op);
    if (inParams.length) {
      for (let i = 0; i < inParams.length; i++) {
        const p = inParams[i];
        const baseSchema = p.schema || (p.type ? { type: p.type, items: p.items } : {});
        const sch = deref(doc, baseSchema || {});
        const { data_type, is_array, item_data_type } = normalizeTypes(sch);
        const field_desc = p.description || sch.description || sch.title || null;
        const example_value =
          p.example !== undefined
            ? typeof p.example === 'string'
              ? p.example
              : JSON.stringify(p.example)
            : sch.example !== undefined
              ? JSON.stringify(sch.example)
              : null;

        fields.push({
          api_sig: sig(method, microservice, apiPath),
          id: uuidv4(),
          api_id: null,
          field_name: p.name,
          io_type: 'in',
          data_type,
          is_array: !!is_array,
          item_data_type: item_data_type || null,
          field_desc,
          required: !!p.required,
          default_value: sch.default !== undefined ? String(sch.default) : null,
          example_value,
          length: sch.maxLength !== undefined ? sch.maxLength : null,
          parent_field_id: null,
          path: `${p.in}.${p.name}`, // path./query./header./cookie.
          level: 0,
          seq: i + 1,
          rule_ext: extractRuleExt(sch),
        });
      }
    }

    // 入参 body
    const reqSchemaRaw = getRequestSchema(doc, op);
    if (reqSchemaRaw) {
      expandSchemaToMemory(
        doc,
        fields,
        method,
        microservice,
        apiPath,
        'in',
        'body',
        reqSchemaRaw,
        new Set(),
        null,
        'body',
        0,
        1,
      );
    }

    // 出参 body
    const respSchemaRaw = getResponseSchema(op);
    if (respSchemaRaw) {
      expandSchemaToMemory(
        doc,
        fields,
        method,
        microservice,
        apiPath,
        'out',
        'body',
        respSchemaRaw,
        new Set(),
        null,
        'body',
        0,
        1,
      );
    }
  }

  // 去重 apis（同一 method+service+path 可能重复定义）
  const map = new Map();
  for (const a of apis) {
    const k = sig(a.method, a.microservice, a.path);
    if (!map.has(k)) map.set(k, a);
    else {
      // 合并描述/示例（优先已有，否则取新的）
      const old = map.get(k);
      old.api_desc ||= a.api_desc;
      old.request_example ||= a.request_example;
      old.response_example ||= a.response_example;
    }
  }
  return { apis: Array.from(map.values()), fields };
}

/** 递归展开 schema -> fields（树+路径），写入 fields 数组 */
function expandSchemaToMemory(
  rootDoc,
  fields,
  method,
  microservice,
  apiPath,
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

  fields.push({
    api_sig: sig(method, microservice, apiPath),
    id,
    api_id: null,
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
    rule_ext: extractRuleExt(schema),
  });

  // 数组 -> items
  if (is_array && schema.items) {
    const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    const childId = uuidv4(); // 先生成，方便链路，但本实现 parent 仅存 id 值即可
    expandSchemaToMemory(
      rootDoc,
      fields,
      method,
      microservice,
      apiPath,
      ioType,
      'items',
      itemsSchema,
      null,
      id,
      `${nodePath}[0]`,
      level + 1,
      1,
    );
    return id;
  }

  // 对象 -> properties
  if ((data_type === 'object' || schema.properties) && schema.properties) {
    const reqSet = new Set(Array.isArray(schema.required) ? schema.required : []);
    let childSeq = 1;
    for (const key of Object.keys(schema.properties)) {
      expandSchemaToMemory(
        rootDoc,
        fields,
        method,
        microservice,
        apiPath,
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

/** ========= SQL 批量工具 ========= */
function buildMultiInsertSQL(table, cols, rows, startIndex = 1) {
  const values = [];
  const params = [];
  let idx = startIndex;
  for (const r of rows) {
    const placeholders = cols.map(() => `$${idx++}`);
    values.push(`(${placeholders.join(',')})`);
    for (const c of cols) params.push(r[c] === undefined ? null : r[c]);
  }
  const sql = `INSERT INTO ${SCHEMA}.${table} (${cols.join(',')}) VALUES ${values.join(', ')}`;
  return { sql, params, nextIndex: idx };
}

/** ========= 主流程：先解析，后写库 ========= */
(async function main() {
  try {
    const swaggerPath = process.argv[2];
    const microservice = process.argv[3];
    if (!swaggerPath || !microservice) {
      console.error('Usage: node import_swagger_bulk.js <swagger.json> <microservice_name>');
      process.exit(1);
    }
    const raw = fs.readFileSync(path.resolve(swaggerPath), 'utf8');
    const doc = JSON.parse(raw);

    // 1) 解析到内存
    const { apis, fields } = parseSwaggerToMemory(doc, microservice);
    if (!apis.length) {
      console.warn('No operations found.');
      process.exit(0);
    }

    // 2) 连接数据库
    const client = new Client(DB);
    await client.connect();
    await client.query('BEGIN');

    // 3) 批量 UPSERT metadata_api，拿回 api_id 映射
    // 生成待插入行（每行都带一个临时 uuid，ON CONFLICT DO UPDATE RETURNING 会回表里 id）
    const apiCols = [
      'id',
      'api_name',
      'api_path',
      'api_method',
      'api_desc',
      'microservice_name',
      'request_example',
      'response_example',
    ];
    // 多值 INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING
    const { sql: apiInsertSQL, params: apiInsertParams } = (() => {
      const vals = [];
      const params = [];
      let i = 1;
      for (const a of apis) {
        vals.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`);
        params.push(
          a.id,
          a.api_name,
          a.path,
          a.method,
          a.api_desc,
          a.microservice,
          a.request_example,
          a.response_example,
        );
      }
      return {
        sql: `INSERT INTO ${SCHEMA}.metadata_api
           (${apiCols.join(',')})
           VALUES ${vals.join(',')}
           ON CONFLICT (api_method, microservice_name, api_path)
           DO UPDATE SET
             api_name=EXCLUDED.api_name,
             api_desc=EXCLUDED.api_desc,
             request_example=EXCLUDED.request_example,
             response_example=EXCLUDED.response_example,
             updated_at=now()
           RETURNING id, api_method, microservice_name, api_path`,
        params,
      };
    })();

    const apiRes = await client.query(apiInsertSQL, apiInsertParams);
    const idMap = new Map(); // signature -> api_id
    for (const r of apiRes.rows) {
      idMap.set(sig(r.api_method, r.microservice_name, r.api_path), r.id);
    }

    // 4) 为 fields 赋值 api_id
    for (const f of fields) {
      const apiId = idMap.get(sig(f.io_type ? f.api_sig.split(' ')[0] : f.api_sig)); // 不这样。直接：
      f.api_id = idMap.get(f.api_sig);
      if (!f.api_id) {
        throw new Error(`api_id not resolved for ${f.api_sig}`);
      }
      delete f.api_sig;
    }

    // 5) 先删除旧字段（这些接口）
    const apiIds = Array.from(new Set(Array.from(idMap.values())));
    await client.query(`DELETE FROM ${SCHEMA}.metadata_api_field WHERE api_id = ANY($1::uuid[])`, [apiIds]);

    // 6) 分批批量插入 metadata_api_field
    const fieldCols = [
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

    // 避免参数过多，分批插入（每批最多 rowsPerBatch 行）
    const rowsPerBatch = 500; // 可按需要调整
    for (let i = 0; i < fields.length; i += rowsPerBatch) {
      const batch = fields.slice(i, i + rowsPerBatch);
      const { sql, params } = buildMultiInsertSQL('metadata_api_field', fieldCols, batch, 1);
      const finalSQL = `${sql} ON CONFLICT DO NOTHING`;
      await client.query(finalSQL, params);
    }

    await client.query('COMMIT');
    await client.end();
    console.log(`Done. APIs upserted: ${apis.length}, Fields inserted: ${fields.length}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

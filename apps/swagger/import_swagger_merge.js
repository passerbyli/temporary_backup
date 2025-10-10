#!/usr/bin/env node
/**
 * OpenAPI/Swagger -> PostgreSQL (merge mode for metadata_api_field)
 * - DB 配置内置
 * - 先解析后写库（单事务）
 * - metadata_api: 批量 UPSERT
 * - metadata_api_field: 合并（新增/更新/删除），键为 (api_id, io_type, path)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const SCHEMA = 'meta_data_ds';

/** ====== DB 配置（按需修改） ====== */
const DB = {
  host: '127.0.0.1',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
};

/** ====== 小工具 ====== */
const firstKey = (o) => (o && typeof o === 'object' ? Object.keys(o)[0] : undefined);
const deepClone = (o) => JSON.parse(JSON.stringify(o ?? null));
const sig = (m, svc, p) => `${m} ${svc} ${p}`;
const isJsonLike = (k) => /json/i.test(k || '');

/** 计算父路径（用于回填 parent_field_id；根返回 null） */
function parentOfPath(p) {
  if (!p) return null;
  // 结尾为 [0] 的数组子节点
  if (/\[0\]$/.test(p)) {
    return p.replace(/\[0\]$/, '');
  }
  // 普通层级 body.user.name / query.id
  const i = p.lastIndexOf('.');
  if (i > -1) return p.slice(0, i);
  // 一级根（如 body / path.id 的 parent 是 'path'）
  if (p.includes('.')) return p.split('.').slice(0, -1).join('.');
  return null;
}

/** ====== paths -> operations ====== */
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

/** ====== $ref 解析 & allOf 合并 ====== */
function getByJsonPointer(root, pointer) {
  if (!pointer || !pointer.startsWith('#/')) return null;
  const parts = pointer
    .slice(2)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = root;
  for (const k of parts) {
    if (!cur || typeof cur !== 'object' || !(k in cur)) return null;
    cur = cur[k];
  }
  return cur;
}
function deref(root, schema, seen = new Set()) {
  if (!schema || typeof schema !== 'object') return schema;

  if (schema.$ref && typeof schema.$ref === 'string') {
    if (seen.has(schema.$ref)) return {};
    seen.add(schema.$ref);
    const target = getByJsonPointer(root, schema.$ref);
    if (!target) return {};
    const merged = { ...deepClone(deref(root, target, seen)), ...deepClone({ ...schema, $ref: undefined }) };
    return deref(root, merged, seen);
  }

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

/** ====== 抽取 schema / 参数 / 示例 ====== */
function getRequestSchema(doc, op) {
  if (op.requestBody && op.requestBody.content) {
    const k = Object.keys(op.requestBody.content).find(isJsonLike);
    if (k) return op.requestBody.content[k].schema || null;
  }
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
      const k = Object.keys(r.content).find(isJsonLike);
      if (k && r.content[k].schema) return r.content[k].schema;
    }
    if (r.schema) return r.schema;
  }
  return null;
}
function getRequestExample(op) {
  if (op.requestBody && op.requestBody.content) {
    const k = Object.keys(op.requestBody.content).find(isJsonLike);
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
      const k = Object.keys(r.content).find(isJsonLike);
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

/** ====== 规则/类型归一 ====== */
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
  const out = {};
  for (const k of keys) if (schema[k] !== undefined) out[k] = schema[k];
  return Object.keys(out).length ? out : null;
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
    const it = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    if (it) {
      if (it.type) item_data_type = Array.isArray(it.type) ? it.type[0] : it.type;
      else if (it.properties || it.additionalProperties) item_data_type = 'object';
    }
  }
  return { data_type, is_array, item_data_type };
}

/** ====== 解析到内存 ======
 * apis: [{id, method, path, microservice, api_name, api_desc, request_example, response_example}]
 * fieldsBySig: { [sig]: [ {io_type, path, parent_path, ...columns} ] }
 */
function parseSwagger(doc, microservice) {
  const ops = enumerateOperations(doc);
  const apis = [];
  const fieldsBySig = {};

  for (const { method, path: apiPath, op } of ops) {
    const s = sig(method, microservice, apiPath);
    apis.push({
      id: uuidv4(), // 临时
      method,
      path: apiPath,
      microservice,
      api_name: op.summary || op.operationId || `${method} ${apiPath}`,
      api_desc: op.description || null,
      request_example: getRequestExample(op) || null,
      response_example: getResponseExample(op) || null,
    });

    const bucket = (fieldsBySig[s] = []);

    // 入参：path/query/header/cookie
    const inParams = getInParams(op);
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
      const fullPath = `${p.in}.${p.name}`;

      bucket.push({
        id: uuidv4(), // 仅用于“新增”
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
        parent_field_id: null, // 之后回填
        path: fullPath,
        parent_path: parentOfPath(fullPath),
        level: 0,
        seq: i + 1,
        rule_ext: extractRuleExt(sch),
      });
    }

    // 入参 body
    const reqSchema = getRequestSchema(doc, op);
    if (reqSchema) {
      expandToMemory(doc, bucket, 'in', 'body', reqSchema, new Set(), null, 'body', 0, 1);
    }

    // 出参 body
    const respSchema = getResponseSchema(op);
    if (respSchema) {
      expandToMemory(doc, bucket, 'out', 'body', respSchema, new Set(), null, 'body', 0, 1);
    }
  }

  // 合并去重 APIs（同签名）
  const map = new Map();
  for (const a of apis) {
    const k = sig(a.method, a.microservice, a.path);
    if (!map.has(k)) map.set(k, a);
    else {
      const old = map.get(k);
      old.api_desc ||= a.api_desc;
      old.request_example ||= a.request_example;
      old.response_example ||= a.response_example;
    }
  }
  return { apis: Array.from(map.values()), fieldsBySig };
}

function expandToMemory(
  rootDoc,
  bucket,
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

  bucket.push({
    id: uuidv4(),
    field_name: fieldName,
    io_type: ioType,
    data_type,
    is_array: is_array === true,
    item_data_type: item_data_type || null,
    field_desc: schema.description || schema.title || null,
    required: parentRequiredSet ? parentRequiredSet.has(fieldName) : false,
    default_value: schema.default !== undefined ? String(schema.default) : null,
    example_value:
      schema.example !== undefined
        ? typeof schema.example === 'string'
          ? schema.example
          : JSON.stringify(schema.example)
        : null,
    length: schema.maxLength !== undefined ? schema.maxLength : null,
    parent_field_id: null, // 之后回填
    path: nodePath,
    parent_path: parentOfPath(nodePath),
    level,
    seq,
    rule_ext: extractRuleExt(schema),
  });

  if (is_array && schema.items) {
    const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    expandToMemory(rootDoc, bucket, ioType, 'items', itemsSchema, null, null, `${nodePath}[0]`, level + 1, 1);
    return;
  }

  if ((data_type === 'object' || schema.properties) && schema.properties) {
    const reqSet = new Set(Array.isArray(schema.required) ? schema.required : []);
    let childSeq = 1;
    for (const key of Object.keys(schema.properties)) {
      expandToMemory(
        rootDoc,
        bucket,
        ioType,
        key,
        schema.properties[key],
        reqSet,
        null,
        `${nodePath}.${key}`,
        level + 1,
        childSeq++,
      );
    }
  }
}

/** ====== SQL 构造工具 ====== */
function buildValuesPlaceholders(rowCount, colCount, start = 1) {
  const values = [];
  let idx = start;
  for (let i = 0; i < rowCount; i++) {
    const ph = [];
    for (let j = 0; j < colCount; j++) ph.push(`$${idx++}`);
    values.push(`(${ph.join(',')})`);
  }
  return { text: values.join(','), next: idx };
}

/** ====== 主流程（合并写库） ====== */
(async function main() {
  try {
    const swaggerPath = process.argv[2];
    const microservice = process.argv[3];
    if (!swaggerPath || !microservice) {
      console.error('Usage: node import_swagger_merge.js <swagger.json> <microservice_name>');
      process.exit(1);
    }

    const raw = fs.readFileSync(path.resolve(swaggerPath), 'utf8');
    const doc = JSON.parse(raw);

    const { apis, fieldsBySig } = parseSwagger(doc, microservice);
    if (!apis.length) {
      console.warn('No operations found.');
      process.exit(0);
    }

    const client = new Client(DB);
    await client.connect();
    await client.query('BEGIN');

    /* 1) 批量 UPSERT metadata_api，并拿到 ids */
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
    const apiParams = [];
    for (const a of apis) {
      apiParams.push(
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
    const { text: apiValues } = buildValuesPlaceholders(apis.length, apiCols.length, 1);
    const apiUpsertSQL = `
      INSERT INTO ${SCHEMA}.metadata_api (${apiCols.join(',')})
      VALUES ${apiValues}
      ON CONFLICT (api_method, microservice_name, api_path)
      DO UPDATE SET
        api_name = EXCLUDED.api_name,
        api_desc = EXCLUDED.api_desc,
        request_example = EXCLUDED.request_example,
        response_example = EXCLUDED.response_example,
        updated_at = now()
      RETURNING id, api_method, microservice_name, api_path
    `;
    const up = await client.query(apiUpsertSQL, apiParams);
    const apiIdMap = new Map(); // sig -> id
    for (const r of up.rows) {
      apiIdMap.set(sig(r.api_method, r.microservice_name, r.api_path), r.id);
    }

    /* 2) 对每个 API 做字段合并 */
    for (const a of apis) {
      const signature = sig(a.method, a.microservice, a.path);
      const apiId = apiIdMap.get(signature);
      if (!apiId) throw new Error(`api_id not found for ${signature}`);

      const desired = fieldsBySig[signature] || [];

      // 2.1 UPSERT（新增/更新）——利用唯一键 (api_id, io_type, path)
      // 注意：不要覆盖已有的 created_*，且当新值为 NULL 时不覆盖旧的描述/规则等
      if (desired.length) {
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
        const params = [];
        let idx = 1;
        const rows = desired.map((d) => ({
          ...d,
          api_id: apiId,
        }));
        const { text: v, next } = buildValuesPlaceholders(rows.length, cols.length, idx);
        idx = next;
        for (const r of rows) {
          params.push(
            r.id,
            apiId,
            r.field_name,
            r.io_type,
            r.data_type,
            r.is_array,
            r.item_data_type,
            r.field_desc,
            r.required,
            r.default_value,
            r.example_value,
            r.length,
            null /* parent_field_id 暂置 null，稍后回填 */,
            r.path,
            r.level,
            r.seq,
            r.rule_ext,
          );
        }
        const upsertSQL = `
          INSERT INTO ${SCHEMA}.metadata_api_field (${cols.join(',')})
          VALUES ${v}
          ON CONFLICT (api_id, io_type, path)
          DO UPDATE SET
            field_name = EXCLUDED.field_name,
            data_type = EXCLUDED.data_type,
            is_array = EXCLUDED.is_array,
            item_data_type = EXCLUDED.item_data_type,
            required = EXCLUDED.required,
            default_value = EXCLUDED.default_value,
            example_value = EXCLUDED.example_value,
            length = EXCLUDED.length,
            level = EXCLUDED.level,
            seq = EXCLUDED.seq,
            -- 仅当新值不为 NULL 才覆盖描述和规则，避免抹掉其他渠道维护的内容
            field_desc = COALESCE(EXCLUDED.field_desc, ${SCHEMA}.metadata_api_field.field_desc),
            rule_ext = COALESCE(EXCLUDED.rule_ext, ${SCHEMA}.metadata_api_field.rule_ext),
            updated_at = now()
        `;
        await client.query(upsertSQL, params);
      }

      // 2.2 删除：库里有、但本次 swagger 没有的 (io_type, path)
      // 通过 VALUES 反向对比；若 desired 为空，则删除该 api_id 的全部字段
      if (desired.length === 0) {
        await client.query(`DELETE FROM ${SCHEMA}.metadata_api_field WHERE api_id = $1`, [apiId]);
      } else {
        // 组装 (io_type, path) 列表
        const kv = desired.map((d) => [d.io_type, d.path]);
        const params = [apiId];
        let idx = 2;
        const pairs = kv.map(() => `($${idx++}, $${idx++})`).join(', ');
        for (const [io, pth] of kv) params.push(io, pth);

        const delSQL = `
          DELETE FROM ${SCHEMA}.metadata_api_field f
          WHERE f.api_id = $1
            AND (f.io_type, f.path) NOT IN (VALUES ${pairs})
        `;
        await client.query(delSQL, params);
      }

      // 2.3 回填 parent_field_id（可选，但推荐）
      // 构造 (io_type, path, parent_path) 映射，仅针对 parent_path 非空
      const parentTriples = desired.filter((d) => d.parent_path).map((d) => [d.io_type, d.path, d.parent_path]);
      if (parentTriples.length) {
        const params = [apiId];
        let idx = 2;
        const vals = parentTriples.map(() => `($${idx++}, $${idx++}, $${idx++})`).join(', ');
        for (const [io, p, pp] of parentTriples) params.push(io, p, pp);

        const updParent = `
          UPDATE ${SCHEMA}.metadata_api_field AS child
          SET parent_field_id = parent.id,
              updated_at = now()
          FROM (
            VALUES ${vals}
          ) v(io_type, path, parent_path)
          JOIN ${SCHEMA}.metadata_api_field AS parent
            ON parent.api_id = child.api_id
           AND parent.io_type = v.io_type
           AND parent.path = v.parent_path
          WHERE child.api_id = $1
            AND child.io_type = v.io_type
            AND child.path = v.path
        `;
        await client.query(updParent, params);
      }
    }

    await client.query('COMMIT');
    await client.end();
    console.log(`Merge done. APIs: ${apis.length}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

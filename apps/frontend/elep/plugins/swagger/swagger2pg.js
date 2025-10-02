#!/usr/bin/env node
/**
 * openGauss 导入脚本（两表：api_endpoint / api_field）
 * 约束：
 *  - 不做建表/初始化
 *  - api_endpoint 含字段：service_name, app_id
 *  - main 入参：--service_name --app_id --route_prefix
 *  - path = route_prefix + 原 swagger path（规范化拼接）
 *  - 以 (method, path) 判断存在：存在则先删除 endpoint（级联删字段），再插入新数据
 *
 * 依赖：
 *   npm i pg
 */

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

// ---------- 读取入参 ----------
const args = require('node:process').argv.slice(2)
function getArg(name, def = '') {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def
}
// const SERVICE_NAME = getArg('service_name')
// const APP_ID = getArg('app_id')
// const ROUTE_PREFIX = getArg('route_prefix', '')

const SERVICE_NAME = 'minservice'
const APP_ID = 'app_id'
const ROUTE_PREFIX = '/api/'

if (!SERVICE_NAME || !APP_ID) {
  console.error('缺少必需入参：--service_name 与 --app_id')
  process.exit(1)
}

const INPUT = path.join(__dirname, 'swagger.json')
const CONF_PATH = path.join(__dirname, './db.config.json')

if (!fs.existsSync(CONF_PATH)) {
  console.error('缺少 db.config.json')
  process.exit(1)
}
if (!fs.existsSync(INPUT)) {
  console.error('缺少 swagger.json')
  process.exit(1)
}

const CONF = JSON.parse(fs.readFileSync(CONF_PATH, 'utf-8'))
const pool = new Pool(CONF.postgres)
const DOC = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))

// ---------- 工具 ----------
const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']
const isOAS3 = !!DOC.openapi
const arrayify = x => (Array.isArray(x) ? x : x ? [x] : [])

function joinPath(prefix, p) {
  const a = String(prefix || '')
  const b = String(p || '')
  if (!a && !b) return '/'
  if (!a) return b.startsWith('/') ? b : '/' + b
  if (!b) return a.startsWith('/') ? a : '/' + a
  const left = a.endsWith('/') ? a.slice(0, -1) : a
  const right = b.startsWith('/') ? b : '/' + b
  return left + right
}

function resolveRef(node) {
  if (!node || typeof node !== 'object' || !node.$ref) return node
  const ref = node.$ref
  if (!ref.startsWith('#/')) return node // 不解析外部文件
  const parts = ref.slice(2).split('/')
  let cur = DOC
  for (const p of parts) {
    cur = cur?.[p]
    if (cur == null) return node
  }
  return cur
}

function schemaToType(schema) {
  if (!schema) return ''
  const s = resolveRef(schema) || {}
  if (s.oneOf) return 'oneOf(' + s.oneOf.map(schemaToType).join(' | ') + ')'
  if (s.anyOf) return 'anyOf(' + s.anyOf.map(schemaToType).join(' | ') + ')'
  if (s.allOf) return 'allOf(' + s.allOf.map(schemaToType).join(' & ') + ')'
  if (s.type === 'array') return `array<${schemaToType(s.items) || 'any'}>`
  if (s.enum) return `enum(${s.enum.map(v => JSON.stringify(v)).join(',')})`
  if (s.format) return `${s.type || 'object'}(${s.format})`
  if (s.type) return s.type
  if (s.properties) return 'object'
  return 'object'
}

function flattenProperties(schema, parent = '', level = 1, rows = []) {
  let s = resolveRef(schema) || {}
  if (s.type === 'array') s = resolveRef(s.items) || {}
  const props = s.properties || {}
  const req = new Set(s.required || [])
  for (const [name, prop0] of Object.entries(props)) {
    const prop = resolveRef(prop0) || {}
    const field = parent ? `${parent}.${name}` : name
    rows.push({
      field_path: field,
      level,
      type: schemaToType(prop),
      required: req.has(name),
      description: prop.description || '',
      possible: Array.isArray(prop.enum) ? prop.enum.map(String).join(',') : ''
    })
    // object 嵌套
    if (prop.type === 'object' || prop.properties) flattenProperties(prop, field, level + 1, rows)
    // array<object> 嵌套
    if (prop.type === 'array') {
      const it = resolveRef(prop.items) || {}
      if (it.type === 'object' || it.properties) flattenProperties(it, field + '[]', level + 1, rows)
    }
  }
  return rows
}

/*
 * 收集 path + operation 的 parameters
 * @param {Object} pathItem 路径项
 * @param {Object} op 操作项
 * @returns {Array<Object>} 参数列表
 */
function collectParameters(pathItem, op) {
  const list = [...arrayify(pathItem.parameters), ...arrayify(op.parameters)].filter(Boolean)
  return list.map(p => ({
    io: 'param',
    location: p.in || '',
    field_path: p.name || '',
    level: 1,
    type: schemaToType(p.schema) || p.type || '',
    required: !!p.required,
    description: p.description || '',
    possible: ''
  }))
}

function extractRequestBodySchema(op) {
  if (isOAS3) {
    const rb = op.requestBody
    if (!rb || !rb.content) return null
    const c = rb.content
    const ct = c['application/json'] ? 'application/json' : Object.keys(c)[0]
    return ct ? c[ct].schema : null
  } else {
    const body = arrayify(op.parameters).find(p => p && p.in === 'body')
    return body?.schema || null
  }
}

function extractResponseBodySchema(op) {
  const responses = op.responses || {}
  const prefer = ['200', '201', 'default', ...Object.keys(responses)]
  if (isOAS3) {
    for (const code of prefer) {
      const r = responses[code]
      if (!r || !r.content) continue
      const c = r.content
      const ct = c['application/json'] ? 'application/json' : Object.keys(c)[0]
      if (ct && c[ct].schema) return c[ct].schema
    }
  } else {
    for (const code of prefer) {
      const r = responses[code]
      if (r?.schema) return r.schema
    }
  }
  return null
}

// ---------- SQL（不做初始化、不用 ON CONFLICT） ----------
const SQL = {
  selectEndpointId: `SELECT id FROM api_endpoint WHERE method=$1 AND path=$2 LIMIT 1`,
  deleteEndpointById: `DELETE FROM api_endpoint WHERE id=$1`, // 依赖 ON DELETE CASCADE 清理 api_field
  insertEndpoint: `
    INSERT INTO api_endpoint
      (method, path, name, summary, description, operation_id, tag, service_name, app_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING id
  `,
  insertField: `
    INSERT INTO api_field
      (api_id, io, location, field_path, level, type, required, description, possible)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `
}

// ---------- 主流程 ----------
;(async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const paths = DOC.paths || {}
    let count = 0

    for (const [rawPath, pathItem] of Object.entries(paths)) {
      for (const m of methods) {
        if (!pathItem[m]) continue
        const op = pathItem[m]

        const name = op.summary || op.operationId || `${m.toUpperCase()} ${rawPath}`
        const pathWithPrefix = joinPath(ROUTE_PREFIX, rawPath)
        const methodUpper = m.toUpperCase()

        // 先查是否存在
        const existed = await client.query(SQL.selectEndpointId, [methodUpper, pathWithPrefix])
        if (existed.rowCount > 0) {
          const oldId = existed.rows[0].id
          // 直接删除 endpoint（依赖外键级联清理 api_field）
          await client.query(SQL.deleteEndpointById, [oldId])
        }

        // 插入新 endpoint
        const summary = op.summary || ''
        const description = op.description || ''
        const operationId = op.operationId || ''
        const tag = Array.isArray(op.tags) && op.tags.length ? op.tags[0] : ''

        const insertRes = await client.query(SQL.insertEndpoint, [methodUpper, pathWithPrefix, name, summary, description, operationId, tag, SERVICE_NAME, APP_ID])
        const apiId = insertRes.rows[0].id

        // 组装字段 rows
        const fields = []

        // 参数
        fields.push(...collectParameters(pathItem, op))

        // 请求体
        const reqSchema = extractRequestBodySchema(op)
        if (reqSchema) {
          const rows = flattenProperties(reqSchema)
          rows.forEach(r =>
            fields.push({
              io: 'request',
              location: 'body',
              field_path: r.field_path,
              level: r.level,
              type: r.type,
              required: r.required,
              description: r.description,
              possible: r.possible
            })
          )
        }

        // 响应体
        const respSchema = extractResponseBodySchema(op)
        if (respSchema) {
          const rows = flattenProperties(respSchema)
          rows.forEach(r =>
            fields.push({
              io: 'response',
              location: 'body',
              field_path: r.field_path,
              level: r.level,
              type: r.type,
              required: r.required,
              description: r.description,
              possible: r.possible
            })
          )
        }

        // 写字段
        for (const f of fields) {
          await client.query(SQL.insertField, [apiId, f.io, f.location, f.field_path, f.level, f.type, f.required, f.description, f.possible])
        }

        count++
        if (count % 20 === 0) console.log(`已处理 ${count} 个接口…`)
      }
    }

    await client.query('COMMIT')
    console.log(`✅ 完成：共写入 ${count} 个接口到 api_endpoint / api_field。`)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('❌ 导入失败：', e.code ? `${e.code} - ${e.message}` : e)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
})()

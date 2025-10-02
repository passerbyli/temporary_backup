#!/usr/bin/env node
/**
 * 读取 ./swagger.json -> 生成 ./SwaggerJsonToExcel.xlsx
 * 若存在 ./db.config.json -> 入库 PostgreSQL（api_endpoint、api_field）
 *
 * 依赖：
 *   npm i excel4node pg
 */

const fs = require('fs')
const path = require('path')
const xl = require('excel4node')

// ---------- 基础路径 ----------
const INPUT = path.resolve(process.cwd(), 'swagger.json')
const OUTPUT = path.resolve(process.cwd(), 'SwaggerJsonToExcel.xlsx')
const CONF_PATH = path.resolve(process.cwd(), 'db.config.json')

// ---------- 读取 swagger ----------
if (!fs.existsSync(INPUT)) {
  console.error('未找到 swagger.json，请放到当前目录。')
  process.exit(1)
}
const DOC = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))
const isOAS3 = !!DOC.openapi
const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']

// ---------- 小工具 ----------
const arrayify = x => (Array.isArray(x) ? x : x ? [x] : [])

function resolveRef(node) {
  if (!node || typeof node !== 'object' || !node.$ref) return node
  const ref = node.$ref
  if (!ref.startsWith('#/')) return node // 外部引用不解析
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
      name: field,
      paramType: 'body',
      type: schemaToType(prop),
      lv: String(level),
      description: prop.description || '',
      required: req.has(name),
      simpleValue: '',
      possible: Array.isArray(prop.enum) ? prop.enum.map(String).join(',') : ''
    })
    if (prop.type === 'object' || prop.properties) {
      flattenProperties(prop, field, level + 1, rows)
    }
    if (prop.type === 'array') {
      const it = resolveRef(prop.items) || {}
      if (it.type === 'object' || it.properties) {
        flattenProperties(it, field + '[]', level + 1, rows)
      }
    }
  }
  return rows
}

function collectParameters(pathItem, op) {
  const list = [...arrayify(pathItem.parameters), ...arrayify(op.parameters)].filter(Boolean)
  return list.map(p => ({
    In: p.in || '',
    Name: p.name || '',
    Type: schemaToType(p.schema) || p.type || '',
    Required: p.required ? 'M' : 'O',
    Description: p.description || ''
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

// ---------- 先解析，得到 Excel 与入库需要的结构 ----------
const indexRows = [] // 首页清单
const apiSheets = [] // Excel 每个接口 sheet 数据
const dbRows = [] // 入库使用：每个接口 -> fields

const sheetNameSet = new Set()

const paths = DOC.paths || {}
for (const [p, pathItem] of Object.entries(paths)) {
  for (const m of methods) {
    if (!pathItem[m]) continue
    const op = pathItem[m]

    // 接口名称优先：summary > operationId > "METHOD path"
    const ifaceName = op.summary || op.operationId || `${m.toUpperCase()} ${p}`

    // 生成 sheet 名（用接口名称，去非法字符，<=31，防重）
    let baseName = String(ifaceName).replace(/[\\/*?:\[\]]/g, '_')
    if (baseName.length > 28) baseName = baseName.slice(0, 28) // 预留后缀
    let sheetName = baseName
    let i = 1
    while (sheetNameSet.has(sheetName) || sheetName.length === 0) {
      const suffix = `_${i++}`
      sheetName = baseName.slice(0, Math.max(0, 31 - suffix.length)) + suffix
    }
    sheetNameSet.add(sheetName)

    // 参数
    const params = collectParameters(pathItem, op)

    // 请求/响应
    const reqSchema = extractRequestBodySchema(op)
    const reqRows = reqSchema ? flattenProperties(reqSchema) : []
    const respSchema = extractResponseBodySchema(op)
    const respRows = respSchema ? flattenProperties(respSchema) : []

    const reqBrief =
      (reqRows
        .slice(0, 10)
        .map(r => `${r.name}:${r.type}`)
        .join(', ') || '') + (reqRows.length > 10 ? ' …' : '')
    const respBrief =
      (respRows
        .slice(0, 10)
        .map(r => `${r.name}:${r.type}`)
        .join(', ') || '') + (respRows.length > 10 ? ' …' : '')

    indexRows.push({
      Name: String(ifaceName),
      Path: p,
      Method: m.toUpperCase(),
      ReqBrief: reqBrief,
      RespBrief: respBrief,
      SheetName: sheetName
    })

    apiSheets.push({
      SheetName: sheetName,
      Meta: { Name: String(ifaceName), Path: p, Method: m.toUpperCase() },
      Parameters: params,
      Request: reqRows,
      Response: respRows
    })

    // 入库字段（统一为 api_field）
    const fieldRows = []
    // 参数
    for (const pp of params) {
      fieldRows.push({
        io: 'param',
        location: pp.In || '',
        field_path: pp.Name || '',
        level: 1,
        type: pp.Type || '',
        required: pp.Required === 'M',
        description: pp.Description || '',
        possible: ''
      })
    }
    // 请求体
    for (const r of reqRows) {
      fieldRows.push({
        io: 'request',
        location: 'body',
        field_path: r.name,
        level: Number(r.lv) || 1,
        type: r.type,
        required: !!r.required,
        description: r.description || '',
        possible: r.possible || ''
      })
    }
    // 响应体
    for (const r of respRows) {
      fieldRows.push({
        io: 'response',
        location: 'body',
        field_path: r.name,
        level: Number(r.lv) || 1,
        type: r.type,
        required: !!r.required,
        description: r.description || '',
        possible: r.possible || ''
      })
    }

    dbRows.push({
      method: m.toUpperCase(),
      path: p,
      name: String(ifaceName),
      summary: op.summary || '',
      description: op.description || '',
      operation_id: op.operationId || '',
      tag: Array.isArray(op.tags) && op.tags.length ? op.tags[0] : '',
      fields: fieldRows
    })
  }
}

// ---------- 生成 Excel ----------
function buildWorkbook(indexRows, apiSheets) {
  const wb = new xl.Workbook()

  // 样式
  const tHead = wb.createStyle({
    font: { color: '#FFFFFF', bold: true },
    fill: { type: 'pattern', patternType: 'solid', fgColor: '#4F81BD' },
    border: { left: { style: 'thin' }, right: { style: 'thin' }, top: { style: 'thin' }, bottom: { style: 'thin' } }
  })
  const cell = wb.createStyle({
    border: { left: { style: 'thin' }, right: { style: 'thin' }, top: { style: 'thin' }, bottom: { style: 'thin' } }
  })

  // ✅ 安全缩进样式：层级<=1直接用 cell；>1 时 indent>=1（excel4node 要求正整数）
  const indentCache = {}
  function getIndent(levelInput) {
    let level = Number.isFinite(levelInput) ? Math.floor(levelInput) : 1
    if (level <= 1) return cell
    const indentValue = Math.max(1, level - 1)
    if (!indentCache[indentValue]) {
      indentCache[indentValue] = wb.createStyle({
        border: { left: { style: 'thin' }, right: { style: 'thin' }, top: { style: 'thin' }, bottom: { style: 'thin' } },
        alignment: { indent: indentValue }
      })
    }
    return indentCache[indentValue]
  }

  // 首页
  const wsIndex = wb.addWorksheet('接口清单')
  const hdr = ['No', 'Name', 'Path', 'Method', '入参摘要', '出参摘要', 'Sheet Link']
  hdr.forEach((h, i) =>
    wsIndex
      .cell(1, i + 1)
      .string(h)
      .style(tHead)
  )
  indexRows.forEach((r, i) => {
    wsIndex
      .cell(i + 2, 1)
      .number(i + 1)
      .style(cell)
    wsIndex
      .cell(i + 2, 2)
      .string(r.Name)
      .style(cell)
    wsIndex
      .cell(i + 2, 3)
      .string(r.Path)
      .style(cell)
    wsIndex
      .cell(i + 2, 4)
      .string(r.Method)
      .style(cell)
    wsIndex
      .cell(i + 2, 5)
      .string(r.ReqBrief || '')
      .style(cell)
    wsIndex
      .cell(i + 2, 6)
      .string(r.RespBrief || '')
      .style(cell)
    // ✅ 超链接目标 sheet 名需要用单引号包裹，内部单引号需转义成两个单引号
    const targetRef = `#'${String(r.SheetName).replace(/'/g, "''")}'!A1`
    wsIndex
      .cell(i + 2, 7)
      .formula(`HYPERLINK("${targetRef}","打开")`)
      .style(cell)
  })

  // 每个接口 sheet
  for (const api of apiSheets) {
    const ws = wb.addWorksheet(api.SheetName)

    let row = 1
    ws.cell(row, 1).string('Meta').style(tHead)
    row++
    ;[
      ['Name', api.Meta.Name],
      ['Path', api.Meta.Path],
      ['Method', api.Meta.Method]
    ].forEach(([k, v]) => {
      ws.cell(row, 1).string(k).style(cell)
      ws.cell(row, 2)
        .string(String(v || ''))
        .style(cell)
      row++
    })
    const backRef = `#'接口清单'!A1`
    ws.cell(1, 5).formula(`HYPERLINK("${backRef}","返回接口清单")`)

    row += 1

    ws.cell(row, 1).string('Parameters').style(tHead)
    row++
    ;['In', 'Name', 'Type', 'O/M', 'Description'].forEach((h, i) =>
      ws
        .cell(row, i + 1)
        .string(h)
        .style(tHead)
    )
    row++
    api.Parameters.forEach(p => {
      ws.cell(row, 1).string(p.In).style(cell)
      ws.cell(row, 2).string(p.Name).style(cell)
      ws.cell(row, 3).string(p.Type).style(cell)
      ws.cell(row, 4).string(p.Required).style(cell)
      ws.cell(row, 5).string(p.Description).style(cell)
      row++
    })

    row += 1

    ws.cell(row, 1).string('Request').style(tHead)
    row++
    const rHdr = ['Parameter', 'Parameter Type', 'Level', 'Data Type', 'O/M', 'Description', 'Simple Value', 'Possible Value']
    rHdr.forEach((h, i) =>
      ws
        .cell(row, i + 1)
        .string(h)
        .style(tHead)
    )
    row++
    api.Request.forEach(x => {
      const lvl = Number.isFinite(Number(x.lv)) ? Math.max(1, Math.floor(Number(x.lv))) : 1
      ws.cell(row, 1).string(x.name).style(getIndent(lvl))
      ws.cell(row, 2).string(x.paramType).style(cell)
      ws.cell(row, 3).number(lvl).style(cell)
      ws.cell(row, 4).string(x.type).style(cell)
      ws.cell(row, 5)
        .string(x.required ? 'M' : 'O')
        .style(cell)
      ws.cell(row, 6)
        .string(x.description || '')
        .style(cell)
      ws.cell(row, 7)
        .string(String(x.simpleValue || ''))
        .style(cell)
      ws.cell(row, 8)
        .string(String(x.possible || ''))
        .style(cell)
      row++
    })

    row += 1

    ws.cell(row, 1).string('Response').style(tHead)
    row++
    rHdr.forEach((h, i) =>
      ws
        .cell(row, i + 1)
        .string(h)
        .style(tHead)
    )
    row++
    api.Response.forEach(x => {
      const lvl = Number.isFinite(Number(x.lv)) ? Math.max(1, Math.floor(Number(x.lv))) : 1
      ws.cell(row, 1).string(x.name).style(getIndent(lvl))
      ws.cell(row, 2).string(x.paramType).style(cell)
      ws.cell(row, 3).number(lvl).style(cell)
      ws.cell(row, 4).string(x.type).style(cell)
      ws.cell(row, 5)
        .string(x.required ? 'M' : 'O')
        .style(cell)
      ws.cell(row, 6)
        .string(x.description || '')
        .style(cell)
      ws.cell(row, 7)
        .string(String(x.simpleValue || ''))
        .style(cell)
      ws.cell(row, 8)
        .string(String(x.possible || ''))
        .style(cell)
      row++
    })
  }

  return wb
}

;(function makeExcel() {
  // 首页按 path + method 排下序
  indexRows.sort((a, b) => (a.Path === b.Path ? a.Method.localeCompare(b.Method) : a.Path.localeCompare(b.Path)))
  const wb = buildWorkbook(indexRows, apiSheets)
  wb.write(OUTPUT, err => {
    if (err) {
      console.error('写入 Excel 失败：', err.message || err)
      process.exit(1)
    }
    console.log(`✅ 已生成 Excel：${OUTPUT}`)
  })
})()

// ---------- PostgreSQL 入库（若存在 db.config.json） ----------
;(async function maybeWritePG() {
  if (!fs.existsSync(CONF_PATH)) {
    console.log('未检测到 db.config.json，跳过入库（仅导 Excel）。')
    return
  }

  const CONF = JSON.parse(fs.readFileSync(CONF_PATH, 'utf-8'))
  const { Pool } = require('pg')
  const pool = new Pool(CONF.postgres)

  const SQL = {
    ensure: `
      CREATE TABLE IF NOT EXISTS api_endpoint (
        id           BIGSERIAL PRIMARY KEY,
        method       VARCHAR(10) NOT NULL,
        path         TEXT        NOT NULL,
        name         TEXT        NOT NULL,
        summary      TEXT        NULL,
        description  TEXT        NULL,
        operation_id TEXT        NULL,
        tag          TEXT        NULL,
        UNIQUE (method, path)
      );
      CREATE TABLE IF NOT EXISTS api_field (
        id          BIGSERIAL PRIMARY KEY,
        api_id      BIGINT      NOT NULL REFERENCES api_endpoint(id) ON DELETE CASCADE,
        io          VARCHAR(16) NOT NULL,
        location    VARCHAR(16) NOT NULL,
        field_path  TEXT        NOT NULL,
        level       INT         NOT NULL DEFAULT 1,
        type        TEXT        NULL,
        required    BOOLEAN     NOT NULL DEFAULT FALSE,
        description TEXT        NULL,
        possible    TEXT        NULL
      );
      CREATE INDEX IF NOT EXISTS idx_field_api ON api_field(api_id);
      CREATE INDEX IF NOT EXISTS idx_field_api_io ON api_field(api_id, io);
    `,
    upsertEndpoint: `
      INSERT INTO api_endpoint (method, path, name, summary, description, operation_id, tag)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (method, path) DO UPDATE SET
        name = EXCLUDED.name,
        summary = EXCLUDED.summary,
        description = EXCLUDED.description,
        operation_id = EXCLUDED.operation_id,
        tag = EXCLUDED.tag
      RETURNING id
    `,
    deleteFields: `DELETE FROM api_field WHERE api_id=$1`,
    insertField: `
      INSERT INTO api_field (api_id, io, location, field_path, level, type, required, description, possible)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL.ensure)

    for (const ep of dbRows) {
      const res = await client.query(SQL.upsertEndpoint, [ep.method, ep.path, ep.name, ep.summary, ep.description, ep.operation_id, ep.tag])
      const apiId = res.rows[0].id

      if (CONF.truncate_fields_before_upsert !== false) {
        await client.query(SQL.deleteFields, [apiId])
      }
      for (const f of ep.fields) {
        await client.query(SQL.insertField, [apiId, f.io, f.location, f.field_path, f.level, f.type, f.required, f.description, f.possible])
      }
    }

    await client.query('COMMIT')
    console.log(`✅ 已入库 PostgreSQL：api_endpoint / api_field，共 ${dbRows.length} 个接口。`)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('❌ 入库失败：', e.message || e)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
})()

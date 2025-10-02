#!/usr/bin/env node
/**
 * swagger2excel.js
 * 读取当前目录 ./swagger.json，导出为 ./SwaggerJsonToExcel.xlsx
 * - 首页“接口清单”
 * - 每个接口一个 sheet，含 Meta / Parameters / Request / Response
 * 依赖：excel4node
 */

const fs = require('fs')
const path = require('path')
const xl = require('excel4node')

// ------------ 配置 ------------
const INPUT = path.join(__dirname, 'swagger.json')
const OUTPUT = path.join(__dirname, 'SwaggerJsonToExcel.xlsx')

// ------------ 工具方法 ------------
const isOAS3 = doc => !!doc.openapi
const arrayify = x => (Array.isArray(x) ? x : x ? [x] : [])
const preferRespCodes = ['200', '201', 'default']

function resolveRef(doc, node) {
  if (!node || typeof node !== 'object') return node
  if (!node.$ref) return node
  const ref = node.$ref
  if (!ref.startsWith('#/')) return node // 外部文件不解析
  const parts = ref.slice(2).split('/')
  let cur = doc
  for (const p of parts) {
    cur = cur?.[p]
    if (cur == null) return node
  }
  return cur
}

function schemaToType(doc, schema) {
  if (!schema) return ''
  const s = resolveRef(doc, schema) || {}
  if (s.oneOf) return 'oneOf(' + s.oneOf.map(x => schemaToType(doc, x)).join(' | ') + ')'
  if (s.anyOf) return 'anyOf(' + s.anyOf.map(x => schemaToType(doc, x)).join(' | ') + ')'
  if (s.allOf) return 'allOf(' + s.allOf.map(x => schemaToType(doc, x)).join(' & ') + ')'
  if (s.type === 'array') return `array<${schemaToType(doc, s.items) || 'any'}>`
  if (s.enum) return `enum(${s.enum.map(v => JSON.stringify(v)).join(',')})`
  if (s.format) return `${s.type || 'object'}(${s.format})`
  if (s.type) return s.type
  if (s.properties) return 'object'
  return 'object'
}

function flattenProperties(doc, schema, parent = '', level = 1, rows = []) {
  const s = resolveRef(doc, schema) || {}
  let t = s
  // 如果是数组，进入 items
  if (t.type === 'array') t = resolveRef(doc, t.items) || {}
  const props = t.properties || {}
  const req = new Set(t.required || [])
  for (const [name, prop0] of Object.entries(props)) {
    const prop = resolveRef(doc, prop0) || {}
    const field = parent ? `${parent}.${name}` : name
    rows.push({
      name: field,
      paramType: 'body',
      type: schemaToType(doc, prop),
      lv: String(level),
      description: prop.description || '',
      required: req.has(name),
      simpleValue: '',
      possible: (Array.isArray(prop.enum) && prop.enum.map(String).join(',')) || ''
    })

    // 嵌套对象
    if (prop.type === 'object' || prop.properties) {
      flattenProperties(doc, prop, field, level + 1, rows)
    }
    // 数组里是对象
    if (prop.type === 'array') {
      const it = resolveRef(doc, prop.items) || {}
      if (it.type === 'object' || it.properties) {
        flattenProperties(doc, it, field + '[]', level + 1, rows)
      }
    }
  }
  return rows
}

function extractRequestBodySchema(doc, op) {
  if (isOAS3(doc)) {
    const rb = op.requestBody
    if (!rb || !rb.content) return null
    const content = rb.content
    const ct = content['application/json'] ? 'application/json' : Object.keys(content)[0]
    return ct ? content[ct].schema : null
  } else {
    // Swagger2: parameters 里 in=body
    const body = arrayify(op.parameters).find(p => p && p.in === 'body')
    return body?.schema || null
  }
}

function extractResponseSchema(doc, op) {
  const responses = op.responses || {}
  if (isOAS3(doc)) {
    for (const code of [...preferRespCodes, ...Object.keys(responses)]) {
      const r = responses[code]
      if (!r || !r.content) continue
      const ct = r.content['application/json'] ? 'application/json' : Object.keys(r.content)[0]
      if (ct && r.content[ct].schema) return r.content[ct].schema
    }
  } else {
    for (const code of [...preferRespCodes, ...Object.keys(responses)]) {
      const r = responses[code]
      if (r?.schema) return r.schema
    }
  }
  return null
}

function collectParameters(doc, pathItem, op) {
  const list = [...arrayify(pathItem.parameters), ...arrayify(op.parameters)].filter(Boolean)
  return list.map(p => ({
    In: p.in || '',
    Name: p.name || '',
    Type: schemaToType(doc, p.schema) || p.type || '',
    Required: p.required ? 'M' : 'O',
    Description: p.description || ''
  }))
}

// ------------ 生成 Excel ------------
function buildWorkbook(indexRows, apiSheets) {
  const wb = new xl.Workbook()

  // 样式
  const tHead = wb.createStyle({
    font: { color: '#FFFFFF', bold: true },
    fill: { type: 'pattern', patternType: 'solid', fgColor: '#4F81BD' },
    border: {
      left: { style: 'thin' },
      right: { style: 'thin' },
      top: { style: 'thin' },
      bottom: { style: 'thin' }
    }
  })
  const cell = wb.createStyle({
    border: {
      left: { style: 'thin' },
      right: { style: 'thin' },
      top: { style: 'thin' },
      bottom: { style: 'thin' }
    }
  })

  // ✅ 安全缩进样式（缓存；当层级≤1，直接返回普通 cell 样式；层级≥2 才设置 indent>=1）
  const indentCache = {}
  function getIndent(levelInput) {
    let level = Number.isFinite(levelInput) ? Math.floor(levelInput) : 1
    if (level <= 1) return cell // 不设置 indent，避免传 0 触发报错
    const indentValue = Math.max(1, level - 1) // indent 必须是正整数
    if (!indentCache[indentValue]) {
      indentCache[indentValue] = wb.createStyle({
        border: {
          left: { style: 'thin' },
          right: { style: 'thin' },
          top: { style: 'thin' },
          bottom: { style: 'thin' }
        },
        alignment: { indent: indentValue } // ≥1
      })
    }
    return indentCache[indentValue]
  }

  // 首页：接口清单
  const wsIndex = wb.addWorksheet('接口清单')
  const hdr = ['No', 'Name', 'Path', 'Method', '入参摘要', '出参摘要', 'Sheet Link']
  hdr.forEach((h, i) => {
    wsIndex
      .cell(1, i + 1)
      .string(h)
      .style(tHead)
  })
  indexRows.forEach((r, i) => {
    wsIndex
      .cell(i + 2, 1)
      .number(i + 1)
      .style(cell)
    wsIndex
      .cell(i + 2, 2)
      .string(r.Name || '')
      .style(cell)
    wsIndex
      .cell(i + 2, 3)
      .string(r.Path || '')
      .style(cell)
    wsIndex
      .cell(i + 2, 4)
      .string(r.Method || '')
      .style(cell)
    wsIndex
      .cell(i + 2, 5)
      .string(r.ReqBrief || '')
      .style(cell)
    wsIndex
      .cell(i + 2, 6)
      .string(r.RespBrief || '')
      .style(cell)
    // wsIndex
    //   .cell(i + 2, 7)
    //   .formula(`HYPERLINK("#${r.SheetName}!A1","打开")`)
    //   .style(cell);

    const targetRef = `#'${String(r.SheetName).replace(/'/g, "''")}'!A1`
    wsIndex
      .cell(i + 2, 7)
      .formula(`HYPERLINK("${targetRef}","打开")`)
      .style(cell)
  })

  // 每个接口一个 sheet
  for (const api of apiSheets) {
    const ws = wb.addWorksheet(api.SheetName)

    let row = 1
    // Meta
    ws.cell(row, 1).string('Meta').style(tHead)
    row++
    const meta = [
      ['Name', api.Meta.Name],
      ['Path', api.Meta.Path],
      ['Method', api.Meta.Method]
    ]
    meta.forEach(([k, v]) => {
      ws.cell(row, 1).string(k).style(cell)
      ws.cell(row, 2)
        .string(String(v || ''))
        .style(cell)
      row++
    })
    // 返回首页链接
    ws.cell(1, 5).formula('HYPERLINK("#接口清单!A1","返回接口清单")')

    row += 1

    // Parameters
    ws.cell(row, 1).string('Parameters').style(tHead)
    row++
    const pHdr = ['In', 'Name', 'Type', 'O/M', 'Description']
    pHdr.forEach((h, i) =>
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

    // Request
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

    // Response
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

// ------------ 主流程 ------------
;(function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`未找到 ${INPUT}，请把 swagger.json 放在当前目录。`)
    process.exit(1)
  }
  const doc = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))
  const paths = doc.paths || {}
  const indexRows = []
  const apiSheets = []

  const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']
  const sheetNameSet = new Set()

  for (const [p, pathItem] of Object.entries(paths)) {
    for (const m of methods) {
      if (!pathItem[m]) continue
      const op = pathItem[m]

      // 名称优先：summary > operationId > tag+path
      const name = op.summary || op.operationId || (op.tags && op.tags[0] ? `${op.tags[0]} ${p}` : `${m.toUpperCase()} ${p}`)

      // Parameters（query/path/header/cookie）
      const params = collectParameters(doc, pathItem, op)

      // RequestBody（schema -> rows）
      const reqSchema = extractRequestBodySchema(doc, op)
      const reqRows = reqSchema ? flattenProperties(doc, reqSchema) : []

      // Response（schema -> rows）
      const respSchema = extractResponseSchema(doc, op)
      const respRows = respSchema ? flattenProperties(doc, respSchema) : []

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

      // 生成 sheet 名
      let baseName = op.summary || op.operationId || `${m.toUpperCase()} ${p}`
      baseName = String(baseName).replace(/[\\/*?:\[\]]/g, '_') // 去掉非法字符

      // 截断，最多保留 31 个字符（预留 3 位给后缀）
      if (baseName.length > 28) {
        baseName = baseName.slice(0, 28)
      }

      let sheetName = baseName
      let i = 1
      while (sheetNameSet.has(sheetName)) {
        sheetName = `${baseName}_${i++}`
        if (sheetName.length > 31) {
          // 如果加后缀超长，再次截断
          sheetName = sheetName.slice(0, 31 - String(i).length - 1) + `_${i}`
        }
      }
      sheetNameSet.add(sheetName)

      indexRows.push({
        Name: String(name),
        Path: p,
        Method: m.toUpperCase(),
        ReqBrief: reqBrief || '',
        RespBrief: respBrief || '',
        SheetName: sheetName
      })

      apiSheets.push({
        SheetName: sheetName,
        Meta: { Name: String(name), Path: p, Method: m.toUpperCase() },
        Parameters: params,
        Request: reqRows,
        Response: respRows
      })
    }
  }

  // 排序一下首页
  indexRows.sort((a, b) => (a.Path === b.Path ? a.Method.localeCompare(b.Method) : a.Path.localeCompare(b.Path)))

  const wb = buildWorkbook(indexRows, apiSheets)
  wb.write(OUTPUT, err => {
    if (err) {
      console.error('写入 Excel 失败：', err.message || err)
      process.exit(1)
    }
    console.log(`✅ 已生成：${OUTPUT}`)
    console.log(`   接口数量：${apiSheets.length}，首页清单行数：${indexRows.length}`)
  })
})()

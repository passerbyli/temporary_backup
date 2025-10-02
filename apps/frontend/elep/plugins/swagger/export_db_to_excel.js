#!/usr/bin/env node
/**
 * export_excel.js
 * 从 openGauss / PostgreSQL 读取 api_endpoint + api_field
 * 生成 Excel (接口清单 + 每接口一个 Sheet)
 */

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')
const excel = require('excel4node')

// ---------- 配置 ----------
const CONF_PATH = path.join(__dirname, './db.config.json')
if (!fs.existsSync(CONF_PATH)) {
  console.error('缺少 db.config.json')
  process.exit(1)
}
const CONF = JSON.parse(fs.readFileSync(CONF_PATH, 'utf-8'))
const pool = new Pool(CONF.postgres)

const OUTPUT = path.join(__dirname, './api_export.xlsx')

// ---------- Excel 样式 ----------
function createStyles(wb) {
  const head = wb.createStyle({
    font: { color: '#FFFFFF', bold: true },
    alignment: { horizontal: 'center' },
    fill: { type: 'pattern', patternType: 'solid', fgColor: '#4F81BD' },
    border: { left: { style: 'thin' }, right: { style: 'thin' }, top: { style: 'thin' }, bottom: { style: 'thin' } }
  })
  const cell = wb.createStyle({
    border: { left: { style: 'thin' }, right: { style: 'thin' }, top: { style: 'thin' }, bottom: { style: 'thin' } }
  })

  // 安全缩进：level<=1 不设置 indent；>=2 才设置 indent>=1
  const indentCache = {}
  function getIndent(levelInput) {
    let level = Number.isFinite(levelInput) ? Math.floor(levelInput) : 1
    if (level <= 1) return cell
    const ind = Math.max(1, level - 1)
    if (!indentCache[ind]) {
      indentCache[ind] = wb.createStyle({
        border: { left: { style: 'thin' }, right: { style: 'thin' }, top: { style: 'thin' }, bottom: { style: 'thin' } },
        alignment: { indent: ind }
      })
    }
    return indentCache[ind]
  }

  return { head, cell, getIndent }
}

// 安全赋值：数字/数字字符串用 .number()，其他用 .string()
function setCell(ws, row, col, val, style) {
  if (val === null || val === undefined) {
    ws.cell(row, col).string('').style(style)
    return
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    ws.cell(row, col).number(val).style(style)
  } else if (typeof val === 'string') {
    const trimmed = val.trim()
    const n = Number(trimmed)
    if (trimmed !== '' && Number.isFinite(n) && String(n) === trimmed) {
      ws.cell(row, col).number(n).style(style)
    } else {
      ws.cell(row, col).string(val).style(style)
    }
  } else {
    ws.cell(row, col).string(String(val)).style(style)
  }
}

// 生成简要：取前 N 个字段，格式 Field:Type，用逗号连接
function brief(fields, limit = 10) {
  if (!fields || !fields.length) return ''
  const arr = fields.slice(0, limit).map(f => `${f.field_path}:${f.type || ''}`)
  return arr.join(', ') + (fields.length > limit ? ' …' : '')
}

// 生成 sheet 名（接口名称优先；长度&重名处理）
function makeSheetName(base, usedSet) {
  let name = String(base || '')
    .replace(/[\\/*?:\[\]]/g, '_')
    .trim()
  if (!name) name = 'Sheet'

  let truncatedByLength = false
  if (name.length > 31) {
    // 截断到 28 并先加 _1
    name = name.slice(0, 28) + '_1'
    truncatedByLength = true
  }

  let final = name
  let idx = truncatedByLength ? 2 : 1 // 若已加 _1，则从 _2 开始尝试
  while (usedSet.has(final)) {
    const suffix = `_${idx++}`
    const maxBase = 31 - suffix.length
    const basePart = name.slice(0, maxBase)
    final = basePart + suffix
  }
  usedSet.add(final)
  return final
}

// ---------- 主流程 ----------
async function main() {
  const client = await pool.connect()
  try {
    // 拉取数据
    const epRes = await client.query('SELECT * FROM api_endpoint ORDER BY id')
    const endpoints = epRes.rows

    const fdRes = await client.query('SELECT * FROM api_field ORDER BY api_id, io, id')
    const fields = fdRes.rows

    // 建 Excel
    const wb = new excel.Workbook()
    const styles = createStyles(wb)

    // 预分组 field
    const fieldMap = new Map()
    for (const f of fields) {
      if (!fieldMap.has(f.api_id)) fieldMap.set(f.api_id, [])
      fieldMap.get(f.api_id).push(f)
    }

    // 首页：接口清单（新增 入参简要 / 出参简要）
    const wsIndex = wb.addWorksheet('接口清单')
    const headers = ['ID', 'Method', 'Path', 'Name', 'Service', 'App', '入参简要', '出参简要', 'Tag', 'Summary', '打开']
    headers.forEach((h, i) => {
      wsIndex
        .cell(1, i + 1)
        .string(h)
        .style(styles.head)
    })

    // 为了 sheet 重名处理
    const usedSheetNames = new Set()
    const endpointSheetName = new Map() // api_id -> sheetName

    // 先为每个 endpoint 计算 sheetName & 简要
    const prepped = endpoints.map(ep => {
      const all = fieldMap.get(ep.id) || []
      const params = all.filter(f => f.io === 'param')
      const requests = all.filter(f => f.io === 'request')
      const responses = all.filter(f => f.io === 'response')

      const reqBrief = brief([...params, ...requests]) // 入参简要 = 参数 + 请求体
      const respBrief = brief(responses) // 出参简要 = 响应体

      // sheetName 使用接口名称
      const desired = ep.name || `${ep.method}_${ep.id}`
      const sheetName = makeSheetName(desired, usedSheetNames)
      endpointSheetName.set(ep.id, sheetName)

      return { ep, reqBrief, respBrief, sheetName }
    })

    // 写首页
    prepped.forEach(({ ep, reqBrief, respBrief, sheetName }, i) => {
      const row = i + 2
      setCell(wsIndex, row, 1, ep.id, styles.cell)
      setCell(wsIndex, row, 2, ep.method, styles.cell)
      setCell(wsIndex, row, 3, ep.path, styles.cell)
      setCell(wsIndex, row, 4, ep.name || '', styles.cell)
      setCell(wsIndex, row, 5, ep.service_name || '', styles.cell)
      setCell(wsIndex, row, 6, ep.app_id || '', styles.cell)
      setCell(wsIndex, row, 7, reqBrief, styles.cell) // 入参简要
      setCell(wsIndex, row, 8, respBrief, styles.cell) // 出参简要
      setCell(wsIndex, row, 9, ep.tag || '', styles.cell)
      setCell(wsIndex, row, 10, ep.summary || '', styles.cell)

      const target = `#'${String(sheetName).replace(/'/g, "''")}'!A1`
      wsIndex.cell(row, 11).formula(`HYPERLINK("${target}","打开")`).style(styles.cell)
    })

    // 每接口 Sheet
    for (const { ep, sheetName } of prepped) {
      const ws = wb.addWorksheet(sheetName)

      let row = 1
      ws.cell(row, 1).string('Meta').style(styles.head)
      row++
      ;[
        ['ID', ep.id],
        ['Name', ep.name || ''],
        ['Method', ep.method || ''],
        ['Path', ep.path || ''],
        ['Service', ep.service_name || ''],
        ['App', ep.app_id || ''],
        ['Tag', ep.tag || ''],
        ['Summary', ep.summary || ''],
        ['Description', ep.description || ''],
        ['OperationId', ep.operation_id || '']
      ].forEach(([k, v]) => {
        setCell(ws, row, 1, k, styles.cell)
        setCell(ws, row, 2, v, styles.cell)
        row++
      })

      // 返回首页
      const backRef = `#'接口清单'!A1`
      ws.cell(1, 8).formula(`HYPERLINK("${backRef}","返回首页")`)

      row += 1

      const all = fieldMap.get(ep.id) || []
      const render = (title, list) => {
        if (!list.length) return
        ws.cell(row, 1).string(title).style(styles.head)
        row++
        const h = ['Field', 'Location', 'Level', 'Type', 'Req', 'Description', 'Possible']
        h.forEach((x, i) =>
          ws
            .cell(row, i + 1)
            .string(x)
            .style(styles.head)
        )
        row++
        list.forEach(f => {
          const lvl = Number.isFinite(Number(f.level)) ? Math.max(1, Math.floor(Number(f.level))) : 1
          ws.cell(row, 1)
            .string(f.field_path || '')
            .style(styles.getIndent(lvl))
          setCell(ws, row, 2, f.location || '', styles.cell)
          setCell(ws, row, 3, lvl, styles.cell)
          setCell(ws, row, 4, f.type || '', styles.cell)
          setCell(ws, row, 5, f.required ? 'M' : 'O', styles.cell)
          setCell(ws, row, 6, f.description || '', styles.cell)
          setCell(ws, row, 7, f.possible || '', styles.cell)
          row++
        })
        row++
      }

      render(
        '参数 (param)',
        all.filter(f => f.io === 'param')
      )
      render(
        '请求体 (request)',
        all.filter(f => f.io === 'request')
      )
      render(
        '响应体 (response)',
        all.filter(f => f.io === 'response')
      )
    }

    wb.write(OUTPUT, err => {
      if (err) {
        console.error('写 Excel 出错：', err)
      } else {
        console.log(`✅ 导出完成：${OUTPUT}`)
      }
    })
  } catch (e) {
    console.error('❌ 出错: ', e)
  } finally {
    pool.end()
  }
}

main()

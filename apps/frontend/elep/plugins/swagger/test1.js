/**
 * gen-postman-from-xlsx.js
 * 从 Excel 读取接口清单，生成 Postman Collection v2.1 JSON
 * 用法：
 *   node gen-postman-from-xlsx.js ./api_list_template.xlsx ./postman_collection.json "Neo4j API Collection"
 *
 * Excel 要求（默认读取 sheet: "apis"）：
 *   name, method, url, group(可选), body_json(可选), headers_json(可选)
 */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

/** ========== 配置项（必要时修改） ========== */
const SHEET_NAME = 'apis' // Excel 表名
const DEFAULT_COLLECTION_NAME = 'API Collection'
const DEFAULT_SCHEMA_URL = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'

/** 是否允许 body */
function methodAllowsBody(method) {
  const m = String(method || '').toUpperCase()
  return !['GET', 'HEAD'].includes(m)
}

/** 深拷贝 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/** 解析 JSON 字符串（容错） */
function parseJsonSafely(str, fallback = null) {
  if (str == null || String(str).trim() === '') return fallback
  try {
    return JSON.parse(String(str))
  } catch (e) {
    console.warn(`[warn] JSON 解析失败，将忽略：${str}`)
    return fallback
  }
}

/** 确保 JSON Body 时包含 Content-Type: application/json */
function ensureJsonContentType(headerArr, hasJsonBody) {
  const headers = Array.isArray(headerArr) ? deepClone(headerArr) : []
  if (!hasJsonBody) return headers
  const hasCT = headers.some(h => h.key?.toLowerCase() === 'content-type' && /application\/json/i.test(h.value || ''))
  if (!hasCT) headers.push({ key: 'Content-Type', value: 'application/json', type: 'text' })
  return headers
}

/** 构造单条 Postman item */
function buildPostmanItem({ name, method, url, bodyJson, headersJson }) {
  // 校验 URL
  let urlObj
  try {
    urlObj = new URL(url)
  } catch (e) {
    console.warn(`[warn] 非法 URL，已跳过：${url}`)
    return null
  }

  // 基础骨架
  const item = {
    name: name || url,
    request: {
      auth: { type: 'noauth' },
      method: String(method || 'GET').toUpperCase(),
      header: [],
      url: {
        raw: url,
        protocol: urlObj.protocol.replace(':', ''),
        host: urlObj.hostname.split('.'),
        port: urlObj.port || undefined,
        path: urlObj.pathname.split('/').filter(Boolean),
        query: []
      }
    },
    response: []
  }

  // Query
  if (urlObj.searchParams.toString()) {
    item.request.url.query = Array.from(urlObj.searchParams.entries()).map(([key, value]) => ({ key, value }))
  }

  // Headers
  let headerArr = parseJsonSafely(headersJson, [])
  if (!Array.isArray(headerArr)) {
    console.warn('[warn] headers_json 不是数组，将忽略：', headersJson)
    headerArr = []
  }

  const hasJsonBody = methodAllowsBody(item.request.method) && !!bodyJson
  item.request.header = ensureJsonContentType(headerArr, hasJsonBody)

  // Body
  if (methodAllowsBody(item.request.method) && bodyJson != null) {
    if (typeof bodyJson === 'object') {
      item.request.body = {
        mode: 'raw',
        raw: JSON.stringify(bodyJson, null, 2),
        options: { raw: { language: 'json' } }
      }
    } else if (typeof bodyJson === 'string') {
      // 允许传已序列化字符串
      item.request.body = {
        mode: 'raw',
        raw: bodyJson,
        options: { raw: { language: 'json' } }
      }
    } else {
      // 其他类型 -> 文本
      item.request.body = {
        mode: 'raw',
        raw: String(bodyJson),
        options: { raw: { language: 'text' } }
      }
    }
  }

  return item
}

/** 将 items 按 group 分组为 Postman 的嵌套结构 */
function groupItems(itemsWithGroup) {
  // 目标结构：
  // [
  //   { name: '组A', item: [ ...请求A ] },
  //   { name: '组B', item: [ ...请求B ] },
  //   ... // 无组的直接放在顶层
  // ]
  const groups = new Map()
  const rootItems = []

  for (const it of itemsWithGroup) {
    const { group, item } = it
    if (!group) {
      rootItems.push(item)
      continue
    }
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(item)
  }

  const grouped = Array.from(groups.entries()).map(([groupName, children]) => ({
    name: groupName,
    item: children
  }))

  return [...grouped, ...rootItems]
}

/** 主流程 */
function main() {
  // 参数处理
  const xlsxPath = process.argv[2] || './api_list_template.xlsx'
  const outPath = process.argv[3] || './postman_collection.json'
  const collectionName = process.argv[4] || DEFAULT_COLLECTION_NAME

  if (!fs.existsSync(xlsxPath)) {
    console.error(`[error] Excel 文件不存在：${xlsxPath}`)
    process.exit(1)
  }

  // 读取 Excel
  const wb = XLSX.readFile(xlsxPath)
  const sheet = wb.Sheets[SHEET_NAME]
  if (!sheet) {
    console.error(`[error] 找不到工作表：${SHEET_NAME}`)
    process.exit(1)
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  // 逐行构造 Postman Item
  const itemsWithGroup = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const name = String(row.name || '').trim()
    const method = String(row.method || '').trim()
    const url = String(row.url || '').trim()
    const group = String(row.group || '').trim() || ''

    if (!name || !method || !url) {
      console.warn(`[warn] 第 ${i + 2} 行缺少必填字段(name/method/url)，已跳过`)
      continue
    }

    // 解析 body/headers
    const bodyJson = parseJsonSafely(row.body_json, null)
    const headersJson = parseJsonSafely(row.headers_json, null)

    const postmanItem = buildPostmanItem({ name, method, url, bodyJson, headersJson })
    if (postmanItem) {
      itemsWithGroup.push({ group, item: postmanItem })
    }
  }

  // 分组
  const finalItems = groupItems(itemsWithGroup)

  // 组装 Collection
  const collection = {
    info: {
      name: collectionName,
      schema: DEFAULT_SCHEMA_URL
    },
    item: finalItems
  }

  // 输出
  fs.writeFileSync(outPath, JSON.stringify(collection, null, 2), 'utf-8')
  console.log(`[ok] 已生成 Postman Collection：${path.resolve(outPath)}`)
}

main()

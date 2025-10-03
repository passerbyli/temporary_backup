/**
 * gen-postman.js
 * 从 appList 自动生成 Postman Collection v2.1 JSON 文件
 * 使用方法：node gen-postman.js
 */

const fs = require('fs')

/**
 * 待生成的接口清单（可从数据库/配置文件读取，这里直接写死示例）
 * - method: HTTP 方法
 * - url: 完整请求地址（包含 query 参数）
 * - body: 仅对支持 body 的方法生效（POST/PUT/PATCH/DELETE 等），GET/HEAD 会自动忽略
 * - header: 可选的头部数组（[{ key:'Content-Type', value:'application/json' }]）
 */
const appList = [
  {
    url: 'http://localhost:8081/api/neo4j/relation/upsert?fromLabel=Table&fromId=t001&relType=LINEAGE&toLabel=Table&toId=t002',
    name: '订单ETL血缘',
    method: 'POST',
    body: { id: 'l001' },
    header: [] // 可选：如果不传，代码会在需要时自动补 Content-Type
  },
  {
    url: 'http://localhost:8081/api/neo4j/relation/find?relType=LINEAGE&fromId=t001',
    name: '查询血缘（GET示例，自动忽略body）',
    method: 'GET',
    body: { ignored: true }, // 会被忽略
    header: []
  }
]

/**
 * Postman 的单条请求模板
 * 注意：这里只放「结构占位」，真正的值在构造函数里填充
 */
const itemTpl = {
  name: '',
  request: {
    auth: { type: 'noauth' },
    method: '',
    header: [],
    body: {},
    url: {
      raw: '',
      protocol: '',
      host: [],
      port: '',
      path: [],
      query: []
    }
  },
  response: []
}

/**
 * Collection 外层信息（可按需修改）
 */
const collectionInfo = {
  name: 'Neo4j API Collection',
  schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
}

/**
 * 工具：判断方法是否允许 body
 * 按照通用实践：GET / HEAD 不带 body；其他方法可带
 * @param {string} method
 * @returns {boolean}
 */
function methodAllowsBody(method) {
  const m = String(method || '').toUpperCase()
  return !['GET', 'HEAD'].includes(m)
}

/**
 * 工具：深拷贝（简单可靠法）
 * @param {any} obj
 * @returns {any}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * 工具：确保 JSON Body 时包含 Content-Type
 * - 如果 header 未显式设置 Content-Type: application/json，则自动补充
 * @param {Array<{key:string,value:string, type?:string}>} headerArr
 * @param {boolean} hasJsonBody
 * @returns {Array}
 */
function ensureJsonContentType(headerArr, hasJsonBody) {
  const headers = Array.isArray(headerArr) ? deepClone(headerArr) : []
  if (!hasJsonBody) return headers

  const hasCT = headers.some(h => h.key?.toLowerCase() === 'content-type' && /application\/json/i.test(h.value || ''))
  if (!hasCT) {
    headers.push({ key: 'Content-Type', value: 'application/json', type: 'text' })
  }
  return headers
}

/**
 * 核心：把一条业务配置转换为 Postman 的 item
 * @param {{url:string,name:string,method:string,body?:any,header?:Array}} config
 * @returns {object} Postman Item
 */
function buildPostmanItem(config) {
  const { url, name, method, body, header } = config

  // 1) 校验 URL
  let urlObj
  try {
    urlObj = new URL(url)
  } catch (e) {
    console.warn(`[warn] 非法 URL，已跳过：${url}`)
    return null
  }

  // 2) 深拷贝模板，避免引用污染
  const item = deepClone(itemTpl)

  // 3) 基本信息
  item.name = name || url
  item.request.method = String(method || 'GET').toUpperCase()
  item.request.url.raw = url

  // 4) URL 拆解：protocol / host / port / path
  item.request.url.protocol = urlObj.protocol.replace(':', '') // "http" / "https"
  item.request.url.host = urlObj.hostname.split('.') // 例：["localhost"] / ["api","example","com"]
  if (urlObj.port) item.request.url.port = urlObj.port
  item.request.url.path = urlObj.pathname.split('/').filter(Boolean) // 过滤空串

  // 5) URL 查询参数 -> Postman query 数组
  if (urlObj.searchParams.toString()) {
    item.request.url.query = Array.from(urlObj.searchParams.entries()).map(([key, value]) => ({
      key,
      value
    }))
  }

  // 6) Headers
  // - 如果存在 JSON body，会自动补全 Content-Type
  const hasJsonBody = methodAllowsBody(item.request.method) && body && typeof body === 'object'
  item.request.header = ensureJsonContentType(header, hasJsonBody)

  // 7) Body
  // - GET/HEAD 自动忽略 body
  // - 其他方法若有对象 body，采用 raw + JSON 字符串
  if (methodAllowsBody(item.request.method) && body != null) {
    if (typeof body === 'object') {
      item.request.body = {
        mode: 'raw',
        raw: JSON.stringify(body, null, 2),
        options: { raw: { language: 'json' } }
      }
    } else if (typeof body === 'string') {
      // 如果用户已经自行给了序列化字符串，也支持
      item.request.body = {
        mode: 'raw',
        raw: body,
        options: { raw: { language: 'json' } }
      }
    } else {
      // 其他类型（number/boolean 等）强制转字符串
      item.request.body = {
        mode: 'raw',
        raw: String(body),
        options: { raw: { language: 'text' } }
      }
    }
  } else {
    // 明确不使用 body
    delete item.request.body
  }

  return item
}

/**
 * 主流程：转换 appList -> Postman Collection
 */
function main() {
  const items = []

  for (const cfg of appList) {
    const postmanItem = buildPostmanItem(cfg)
    if (postmanItem) items.push(postmanItem)
  }

  const collection = {
    info: collectionInfo,
    item: items
  }

  const outFile = './postman_collection.json'
  fs.writeFileSync(outFile, JSON.stringify(collection, null, 2), 'utf-8')
  console.log(`[ok] 已生成 Postman Collection：${outFile}`)
}

main()

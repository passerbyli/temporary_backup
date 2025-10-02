const axios = require('axios')
const XLSX = require('xlsx')
const { URL } = require('url')
const fs = require('fs')

// === 配置 ===
const TOKEN = require('./tokens.json').userA
const INPUT_FILE = 'interfaces.xlsx'
const OUTPUT_FILE = 'interfaces_tested.xlsx'
const SHEET_NAME = 'Sheet1'
const TARGET_ID = '456'

// 判断是否为 ID 字段
function isIdKey(key) {
  const k = key.toLowerCase()
  return ['id', 'userid', 'uid', 'orderid'].includes(k)
}

// 替换 URL 中的 ID
function mutateUrl(originalUrl, newId) {
  try {
    const url = new URL(originalUrl)
    for (const [key] of url.searchParams) {
      if (isIdKey(key)) {
        url.searchParams.set(key, newId)
      }
    }
    return url.toString()
  } catch (e) {
    return originalUrl
  }
}

// 替换 body 中 ID
function mutateBody(bodyStr, newId) {
  if (!bodyStr || typeof bodyStr !== 'string') return null
  try {
    const bodyObj = JSON.parse(bodyStr)
    for (let key in bodyObj) {
      if (isIdKey(key)) {
        bodyObj[key] = newId
      }
    }
    return bodyObj
  } catch (err) {
    return null
  }
}

// 请求并返回详细数据
async function sendRequest(method, url, body = null) {
  try {
    const res = await axios.request({
      method,
      url,
      data: body,
      headers: {
        Authorization: TOKEN,
        'Content-Type': 'application/json',
      },
    })
    return {
      status: res.status,
      data: JSON.stringify(res.data).slice(0, 500),
    }
  } catch (err) {
    if (err.response) {
      return {
        status: err.response.status,
        data: JSON.stringify(err.response.data || err.response.statusText).slice(0, 500),
      }
    } else {
      return {
        status: -1,
        data: err.message,
      }
    }
  }
}

// 主逻辑
async function run() {
  const workbook = XLSX.readFile(INPUT_FILE)
  const sheet = workbook.Sheets[SHEET_NAME]
  const rows = XLSX.utils.sheet_to_json(sheet)

  for (let row of rows) {
    const method = (row.method || 'GET').toUpperCase()
    const originalUrl = row.url
    const originalBody = mutateBody(row.body, null)
    const mutatedUrl = mutateUrl(originalUrl, TARGET_ID)
    const mutatedBody = mutateBody(row.body, TARGET_ID)

    // 原始请求
    const resOriginal = await sendRequest(method, originalUrl, originalBody)

    // 越权测试请求
    const resMutated = await sendRequest(method, mutatedUrl, mutatedBody)

    // 写入字段
    row.originalUrl = originalUrl
    row.originalBody = row.body || ''
    row.originalStatus = resOriginal.status
    row.originalResponse = resOriginal.data

    row.mutatedUrl = mutatedUrl
    row.mutatedBody = mutatedBody ? JSON.stringify(mutatedBody) : ''
    row.mutatedStatus = resMutated.status
    row.mutatedResponse = resMutated.data

    row.suspect = resMutated.status === 200 && resOriginal.status !== 200 ? '可能越权' : '正常'

    console.log(
      `[${method}] ${row.name} → 原:${resOriginal.status}  改:${resMutated.status} → ${row.suspect}`
    )
  }

  const newSheet = XLSX.utils.json_to_sheet(rows)
  const newWorkbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, SHEET_NAME)
  XLSX.writeFile(newWorkbook, OUTPUT_FILE)

  console.log(`\n✅ 测试完成，结果写入 ${OUTPUT_FILE}`)
}

run()

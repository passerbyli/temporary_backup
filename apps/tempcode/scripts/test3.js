const { Client } = require('pg') // openGauss 也兼容

const sql = `
  EXPLAIN (FORMAT JSON)
  SELECT t1.name, COUNT(*) FROM employee t1
  JOIN department t2 ON t1.dept_id = t2.id
  WHERE t1.salary > 5000
  GROUP BY t1.name
  ORDER BY COUNT(*) DESC
  LIMIT 10;
`

const client = new Client({}) // openGauss 配置
await client.connect()
const res = await client.query(sql)

const plan = res.rows[0]['QUERY PLAN'][0]['Plan']

function collectOperators(planNode, result = []) {
  if (!planNode) return result
  result.push(planNode['Node Type'])
  if (planNode['Plans']) {
    planNode['Plans'].forEach((sub) => collectOperators(sub, result))
  }
  return result
}

const operators = collectOperators(plan)
const uniqueOps = [...new Set(operators)]
console.log(`共使用了 ${operators.length} 个算子，${uniqueOps.length} 种类型：`, uniqueOps)

/**00000000000000000**/
const parseValue = (val) => {
  if (val === undefined || val === null) return null

  if (typeof val === 'string') {
    val = val.trim()
    if (val.endsWith('%')) {
      const num = parseFloat(val.slice(0, -1))
      return isNaN(num) ? null : num / 100
    }
  }
  const num = parseFloat(val)
  return isNaN(num) ? null : num
}

/**
 * 通用排序函数，支持百分比、数字字符串、负数、undefined
 * @param {Array} arr - 原始数组
 * @param {Array} sortFields - 排序字段数组，每项为 { key: '字段名', order: 'asc'|'desc' }
 * @returns {Array} - 排序后的新数组
 */
function sortByFields(arr, sortFields) {
  return arr.slice().sort((a, b) => {
    for (const { key, order = 'asc' } of sortFields) {
      const valA = parseValue(a[key])
      const valB = parseValue(b[key])

      if (valA === null && valB !== null) return 1
      if (valB === null && valA !== null) return -1
      if (valA === null && valB === null) continue

      if (valA < valB) return order === 'asc' ? -1 : 1
      if (valA > valB) return order === 'asc' ? 1 : -1
    }
    return 0
  })
}

/**
 * 字段通用排序（不依赖 lodash）
 * @param {Array} arr - 要排序的对象数组
 * @param {string} field - 排序字段
 * @param {'asc'|'desc'} order - 排序顺序，默认 'asc'
 * @returns {Array} 排序后的新数组
 */
function sortByField2(arr, field, order = 'asc') {
  return arr.slice().sort((a, b) => {
    const valA = parseValue(a[field])
    const valB = parseValue(b[field])

    // undefined/null 排在最后
    if (valA === null && valB !== null) return 1
    if (valB === null && valA !== null) return -1
    if (valA === null && valB === null) return 0

    if (valA < valB) return order === 'asc' ? -1 : 1
    if (valA > valB) return order === 'asc' ? 1 : -1
    return 0
  })
}

const _ = require('lodash')

/**
 * 字段通用排序，支持百分比/负数/undefined
 * @param {Array} arr - 要排序的对象数组
 * @param {string} field - 排序字段
 * @param {string} order - 排序顺序 'asc' 或 'desc'
 * @returns {Array} 排序后的新数组
 */
function sortByField3(arr, field, order = 'asc') {
  return _.orderBy(
    arr,
    [
      (item) => {
        const parsed = parseValue(item[field])
        return parsed === null ? Infinity : parsed // undefined/null 放最后
      },
    ],
    [order]
  )
}

/**
 * 多字段通用排序
 * @param {Array} arr - 要排序的对象数组
 * @param {Array} fields - 排序字段数组，如 [{ field: 'rate', order: 'asc' }]
 * @returns {Array} 排序后的新数组
 */
function sortByFields4(arr, fields) {
  const iteratees = fields.map(({ field }) => (item) => {
    const parsed = parseValue(item[field])
    return parsed === null ? Infinity : parsed
  })

  const orders = fields.map(({ order = 'asc' }) => order)

  return _.orderBy(arr, iteratees, orders)
}


// https://github.com/TriliumNext/Trilium/releases






// configService.js
const path = require('path')
const fs = require('fs')
const { app } = require('electron')

const configPath = path.join(app.getPath('userData'), 'config.json')
let configCache = null

function ensureConfig() {
  if (!fs.existsSync(configPath)) {
    const defaultPath = path.join(__dirname, '..', 'config', 'config.json')
    fs.copyFileSync(defaultPath, configPath)
  }
}

function readConfig() {
  if (configCache) return configCache
  const raw = fs.readFileSync(configPath, 'utf-8')
  configCache = JSON.parse(raw)
  return configCache
}

module.exports = { ensureConfig, readConfig }
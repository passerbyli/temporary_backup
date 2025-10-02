const fs = require('fs')
const path = require('path')
const axios = require('axios')
const https = require('https')
const { getBasePath, getConfig, updateConfig } = require('../db/configDb')

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

function getLogFilePath() {
  const logsDir = path.join(getBasePath(), 'logs')
  fs.mkdirSync(logsDir, { recursive: true })
  return path.join(logsDir, `request_${getTodayStr()}.log`)
}

function logToFileAndConsole(type, lines = [], tag = '') {
  const time = new Date().toISOString()
  const tagText = tag ? ` [${tag}]` : ''
  const title = `[${time}] ${type}${tagText}`
  const content = [title, ...lines.map(line => `  ${line}`)].join('\n')

  fs.appendFileSync(getLogFilePath(), '\n' + content + '\n', 'utf-8')
}

function formatJSON(data) {
  try {
    return JSON.stringify(data, null, 2)
  } catch (e) {
    return String(data)
  }
}

const myAxios = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  timeout: 10000
})

// 请求拦截器
myAxios.interceptors.request.use(
  config => {
    config.meta = {
      startTime: Date.now(),
      tag: config.tag || (config.meta && config.meta.tag) || ''
    }

    logToFileAndConsole('→ Request', [`URL: ${config.method.toUpperCase()} ${config.url}`, `Params: ${formatJSON(config.params || {})}`, `Data: ${formatJSON(config.data || {})}`], config.meta.tag)

    return config
  },
  error => {
    logToFileAndConsole('× Request Error', [error.message])
    return Promise.reject(error)
  }
)

// 响应拦截器
myAxios.interceptors.response.use(
  response => {
    const { meta } = response.config
    const duration = Date.now() - (meta?.startTime || Date.now())

    logToFileAndConsole('← Response', [`URL: ${response.config.method.toUpperCase()} ${response.config.url}`, `Status: ${response.status}`, `Duration: ${duration}ms`, `Response: ${formatJSON(response.data)}`], meta?.tag)

    return response
  },
  error => {
    const config = error.config || {}
    const duration = Date.now() - (config.meta?.startTime || Date.now())
    const tag = config.meta?.tag

    if (config.status == 401) {
      const _config = getConfig()
      updateConfig({
        ..._config,
        isLogin: false
      })
    }
    const lines = [`URL: ${config.method?.toUpperCase()} ${config.url}`, `Duration: ${duration}ms`, `Error: ${error.message}`]
    return Promise.reject(error)
  }
)

module.exports = myAxios

//

// const csrfToken = res.data.csrfToken
// const setCookies = res.headers['set-cookie'] || []
// const subCookie = setCookies.map(c => c.split(';')[0]).join('; ')

// // 可选：你从主系统登录时已有 cookie
// const loginCookie = 'SESSIONID=abc123'
// const fullCookie = [loginCookie, subCookie].filter(Boolean).join('; ')

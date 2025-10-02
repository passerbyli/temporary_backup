const fs = require('fs')
const path = require('path')
const axios = require('axios')
const https = require('https')

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatJSON(data) {
  try {
    return JSON.stringify(data, null, 2)
  } catch (e) {
    return String(data)
  }
}

/**
 * 创建带日志的 axios 实例
 * @param {Object} options 配置项
 * @param {function} options.getBasePath 获取日志文件根目录
 * @param {function=} options.getConfig 可选，用于处理登录失效场景
 * @param {function=} options.updateConfig 可选，用于处理登录失效场景
 * @returns {AxiosInstance}
 */
function createAxiosClient({ getBasePath, getConfig, updateConfig }) {
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

      const lines = [`URL: ${config.method?.toUpperCase()} ${config.url}`, `Duration: ${duration}ms`, `Error: ${error.message}`]

      logToFileAndConsole('× Response Error', lines, tag)

      // 如果定义了 config 操作函数才使用
      if (error.response?.status === 401 && typeof getConfig === 'function' && typeof updateConfig === 'function') {
        const _config = getConfig()
        updateConfig({ ..._config, isLogin: false })
      }

      return Promise.reject(error)
    }
  )

  return myAxios
}

module.exports = { createAxiosClient }

/**
 * 
 * 
const { getBasePath, getConfig, updateConfig } = require('../db/configDb')
const { createAxiosClient } = require('./utils/createAxiosClient')

const axiosInstance = createAxiosClient({
  getBasePath,
  getConfig,
  updateConfig
})

module.exports = axiosInstance
 * 
 * 
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const https = require('https')

class AxiosLoggerClient {
  /**
   * 构造函数
   * @param {Object} options 配置项
   * @param {function} options.getBasePath 获取日志根路径函数（必传）
   * @param {function=} options.getConfig 获取配置信息（可选）
   * @param {function=} options.updateConfig 更新配置信息（可选）
   */
  constructor({ getBasePath, getConfig, updateConfig }) {
    if (typeof getBasePath !== 'function') {
      throw new Error('getBasePath must be a function')
    }

    this.getBasePath = getBasePath
    this.getConfig = getConfig
    this.updateConfig = updateConfig

    this.axios = axios.create({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    })

    this._setupInterceptors()
  }

  getTodayStr() {
    return new Date().toISOString().split('T')[0]
  }

  getLogFilePath() {
    const logsDir = path.join(this.getBasePath(), 'logs')
    fs.mkdirSync(logsDir, { recursive: true })
    return path.join(logsDir, `request_${this.getTodayStr()}.log`)
  }

  logToFileAndConsole(type, lines = [], tag = '') {
    const time = new Date().toISOString()
    const tagText = tag ? ` [${tag}]` : ''
    const title = `[${time}] ${type}${tagText}`
    const content = [title, ...lines.map(line => `  ${line}`)].join('\n')
    fs.appendFileSync(this.getLogFilePath(), '\n' + content + '\n', 'utf-8')
  }

  formatJSON(data) {
    try {
      return JSON.stringify(data, null, 2)
    } catch (e) {
      return String(data)
    }
  }

  _setupInterceptors() {
    // 请求拦截
    this.axios.interceptors.request.use(
      config => {
        config.meta = {
          startTime: Date.now(),
          tag: config.tag || (config.meta && config.meta.tag) || ''
        }

        this.logToFileAndConsole('→ Request', [`URL: ${config.method.toUpperCase()} ${config.url}`, `Params: ${this.formatJSON(config.params || {})}`, `Data: ${this.formatJSON(config.data || {})}`], config.meta.tag)

        return config
      },
      error => {
        this.logToFileAndConsole('× Request Error', [error.message])
        return Promise.reject(error)
      }
    )

    // 响应拦截
    this.axios.interceptors.response.use(
      response => {
        const { meta } = response.config
        const duration = Date.now() - (meta?.startTime || Date.now())

        this.logToFileAndConsole('← Response', [`URL: ${response.config.method.toUpperCase()} ${response.config.url}`, `Status: ${response.status}`, `Duration: ${duration}ms`, `Response: ${this.formatJSON(response.data)}`], meta?.tag)

        return response
      },
      error => {
        const config = error.config || {}
        const duration = Date.now() - (config.meta?.startTime || Date.now())
        const tag = config.meta?.tag

        this.logToFileAndConsole('× Response Error', [`URL: ${config.method?.toUpperCase()} ${config.url}`, `Duration: ${duration}ms`, `Error: ${error.message}`], tag)

        if (error.response?.status === 401 && typeof this.getConfig === 'function' && typeof this.updateConfig === 'function') {
          const oldCfg = this.getConfig()
          this.updateConfig({ ...oldCfg, isLogin: false })
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * 获取 axios 实例
   * @returns {import('axios').AxiosInstance}
   */
  getInstance() {
    return this.axios
  }
}

module.exports = AxiosLoggerClient

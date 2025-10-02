const fs = require('fs')
const path = require('path')
const axios = require('axios')
const https = require('https')
const { wrapper } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie')

class AxiosLoggerClient {
  static DEFAULT_TIMEOUT = 10000

  /**
   * 构造函数
   * @param {Object} options
   * @param {function} options.getBasePath
   * @param {function=} options.getConfig
   * @param {function=} options.updateConfig
   * @param {boolean=} options.enableLog 是否启用日志（默认 true）
   * @param {string=} options.logLevel 'info' | 'debug' | 'error'
   * @param {boolean=} options.useCookieJar 是否启用 Cookie 自动管理（默认 false）
   * @param {number=} options.retryTimes 网络失败重试次数（默认 0）
   * @param {string=} options.baseURL 默认 baseURL（可选）
   * @param {Object=} options.defaultHeaders 默认 headers（如 token）
   */
  constructor({ getBasePath, getConfig, updateConfig, enableLog = true, logLevel = 'info', useCookieJar = false, retryTimes = 0, baseURL, defaultHeaders = {} }) {
    if (typeof getBasePath !== 'function') {
      throw new Error('getBasePath must be a function')
    }

    this.config = { getBasePath, getConfig, updateConfig }
    this.options = { enableLog, logLevel, retryTimes, useCookieJar }
    this.state = { cookieJar: useCookieJar ? new CookieJar() : null }

    this.axios = axios.create({
      timeout: AxiosLoggerClient.DEFAULT_TIMEOUT,
      baseURL,
      headers: defaultHeaders,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      ...(useCookieJar ? { jar: this.state.cookieJar, withCredentials: true } : {})
    })

    if (useCookieJar) {
      wrapper(this.axios)
    }

    this._setupInterceptors()
  }

  _log(type, lines = [], tag = '') {
    if (!this.options.enableLog) return

    const time = new Date().toISOString()
    const tagText = tag ? ` [${tag}]` : ''
    const title = `[${time}] ${type}${tagText}`
    const content = [title, ...lines.map(line => `  ${line}`)].join('\n')

    const logPath = path.join(this.config.getBasePath(), 'logs')
    fs.mkdirSync(logPath, { recursive: true })

    const filePath = path.join(logPath, `request_${new Date().toISOString().split('T')[0]}.log`)
    fs.appendFileSync(filePath, '\n' + content + '\n', 'utf-8')
  }

  _formatJSON(data) {
    try {
      return JSON.stringify(data, null, 2)
    } catch (e) {
      return String(data)
    }
  }

  _setupInterceptors() {
    this.axios.interceptors.request.use(
      config => {
        config.meta = {
          startTime: Date.now(),
          tag: config.tag || (config.meta && config.meta.tag) || '',
          retry: 0
        }

        this._log('→ Request', [`URL: ${config.method.toUpperCase()} ${config.url}`, `Params: ${this._formatJSON(config.params || {})}`, `Data: ${this._formatJSON(config.data || {})}`], config.meta.tag)

        return config
      },
      error => {
        this._log('× Request Error', [error.message])
        return Promise.reject(error)
      }
    )

    this.axios.interceptors.response.use(
      res => {
        const { meta } = res.config
        const duration = Date.now() - (meta?.startTime || Date.now())

        this._log('← Response', [`URL: ${res.config.method.toUpperCase()} ${res.config.url}`, `Status: ${res.status}`, `Duration: ${duration}ms`, `Response: ${this._formatJSON(res.data)}`], meta?.tag)

        return res
      },
      async error => {
        const config = error.config || {}
        const meta = config.meta || {}
        const duration = Date.now() - (meta.startTime || Date.now())
        const tag = meta.tag

        this._log('× Response Error', [`URL: ${config.method?.toUpperCase()} ${config.url}`, `Duration: ${duration}ms`, `Error: ${error.message}`], tag)

        // 401 自动更新登录状态
        if (error.response?.status === 401 && this.config.getConfig && this.config.updateConfig) {
          const oldCfg = this.config.getConfig()
          this.config.updateConfig({ ...oldCfg, isLogin: false })
        }

        // 重试机制
        if (this.options.retryTimes > 0 && (!error.response || error.code === 'ECONNABORTED') && meta.retry < this.options.retryTimes) {
          meta.retry++
          this._log('↻ Retrying', [`Retry #${meta.retry}`], tag)
          return this.axios(config) // 重新请求
        }

        return Promise.reject(error)
      }
    )
  }

  getInstance() {
    return this.axios
  }

  getCookiesFor(url) {
    if (!this.options.useCookieJar) return []
    return this.state.cookieJar.getCookiesSync(url)
  }

  setToken(token) {
    this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }
}

module.exports = AxiosLoggerClient

/**
 * const axios = require('axios')
const { wrapper } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie')

const jar = new CookieJar()
const client = wrapper(axios.create({ jar, withCredentials: true }))

const res = await client.get('https://example.com/login')
console.log(await jar.getCookies('https://example.com'))
 */

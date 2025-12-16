// 把 query 里 params/data 尽量解析成对象：
// - params/data 可能是对象（某些路由库/手写 push）
// - 也可能是 JSON 字符串
// - 解析失败就兜底为空对象
export function normalizePayload(query) {
  const q = { ...(query || {}) }

  // menuId 不属于业务参数
  delete q.menuId

  const parseMaybeJson = (v) => {
    if (!v) return {}
    if (typeof v === 'object') return v // 已经是对象
    if (typeof v !== 'string') return {}
    try {
      const obj = JSON.parse(v)
      return obj && typeof obj === 'object' ? obj : {}
    } catch {
      return {}
    }
  }

  const params = parseMaybeJson(q.params)
  const data = parseMaybeJson(q.data)

  // 其它散落 query（比如 p1=v1）也保留一份
  // 组件里可以统一用 queryRaw 取
  const queryRaw = { ...q }

  // 把 params/data 字段本身从 queryRaw 中移除（避免重复）
  delete queryRaw.params
  delete queryRaw.data

  return { params, data, queryRaw }
}

// iframe/internalLink 拼接参数：把 params/data/queryRaw 都加到 url 上
export function buildUrlWithPayload(baseUrl, payload) {
  if (!baseUrl) return ''
  try {
    const url = new URL(baseUrl, window.location.origin)
    const { params = {}, data = {}, queryRaw = {} } = payload || {}

    // 先加散落 queryRaw（p1=v1 这种）
    Object.keys(queryRaw).forEach((k) => {
      if (queryRaw[k] === undefined || queryRaw[k] === null) return
      url.searchParams.set(k, String(queryRaw[k]))
    })

    // params/data 用 JSON 字符串传给 iframe（最通用）
    if (Object.keys(params).length) url.searchParams.set('params', JSON.stringify(params))
    if (Object.keys(data).length) url.searchParams.set('data', JSON.stringify(data))

    return url.toString()
  } catch {
    // baseUrl 可能不是合法 URL（比如你传相对路径），就简单拼
    return baseUrl
  }
}

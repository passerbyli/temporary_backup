function simpleHtmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n') // 转换换行
    .replace(/<[^>]+>/g, '') // 去除所有标签
    .replace(/(【[^】]+】)/g, '\n$1\n') // 在【xxx】前后加换行
    .replace(/\n{2,}/g, '\n') // 清理多余换行
    .trim()
}

/**
 * 通用多字段排序
 * @param {Array<Object>} list         原数组
 * @param {Array<Object>} rules        排序规则数组，顺序即优先级高→低
 *   - key        要比较的字段名
 *   - order      'asc' | 'desc'（默认 asc）
 *   - customOrder 可选，自定义优先级数组，例如 ['c','b']
 * @returns {Array<Object>}            新排序后的数组
 */
function multiFieldSort(list, rules) {
  // 复制一份，保证不改动原数组
  return [...list].sort((a, b) => {
    for (const { key, order = 'asc', customOrder } of rules) {
      let cmp = 0

      // ① 自定义顺序逻辑
      if (Array.isArray(customOrder)) {
        const idxA = customOrder.indexOf(a[key])
        const idxB = customOrder.indexOf(b[key])
        const rankA = idxA === -1 ? customOrder.length : idxA
        const rankB = idxB === -1 ? customOrder.length : idxB
        cmp = rankA - rankB
      } else {
        // ② 默认比较（字符串/数字自动兼容）
        if (a[key] < b[key]) cmp = -1
        else if (a[key] > b[key]) cmp = 1
        else cmp = 0
      }

      // 若当前字段已分出大小，按 asc/desc 返回
      if (cmp !== 0) return order === 'desc' ? -cmp : cmp
      // 否则继续比较下一字段
    }
    return 0 // 所有字段都相等
  })
}
function deepSort(value) {
  if (Array.isArray(value)) {
    return value.map(deepSort).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  } else if (value && typeof value === 'object') {
    const sorted = {}
    Object.keys(value)
      .sort()
      .forEach(key => {
        sorted[key] = deepSort(value[key])
      })
    return sorted
  } else {
    return value
  }
}

function compareJsonDeep(a, b) {
  a = deepSort(a)
  b = deepSort(b)

  const result = {
    added: {},
    removed: {},
    changed: {},
    unchanged: {}
  }

  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  for (const key of keys) {
    const valA = a?.[key]
    const valB = b?.[key]

    if (!(key in a)) {
      result.added[key] = valB
    } else if (!(key in b)) {
      result.removed[key] = valA
    } else if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      if (typeof valA === 'object' && typeof valB === 'object') {
        // 深度递归
        const childDiff = compareJsonDeep(valA, valB)
        result.changed[key] = childDiff
      } else {
        result.changed[key] = { old: valA, new: valB }
      }
    } else {
      result.unchanged[key] = valA
    }
  }

  return result
}

function compareJsonSendToFrontend(jsonA, jsonB) {
  const diff = compareJsonDeep(jsonA, jsonB)
  const windows = BrowserWindow.getAllWindows()
  const win = windows.find(w => w?.title === 'Vite App')
  win?.webContents?.send('fromMain', { event: 'json-diff', data: diff })
}
const commonUtils = { simpleHtmlToText, multiFieldSort, compareJsonSendToFrontend }

module.exports = commonUtils

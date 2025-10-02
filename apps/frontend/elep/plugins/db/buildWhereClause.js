/**
 * 构建 WHERE 条件语句及参数数组
 * 支持操作符：=、>、<、>=、<=、LIKE、IN、BETWEEN
 * @param {Object} condition - 查询条件对象
 * @param {string} dbType - 数据库类型（postgres/mysql）
 * @returns {Object} - { clause, values }
 */
function buildWhereClause(condition = {}, dbType = 'postgres') {
  const clauses = [] // WHERE 子句列表
  const values = [] // 参数值列表
  let idx = 1 // PostgreSQL 占位符索引（$1, $2...）

  const nextPlaceholder = () => (dbType === 'postgres' ? `$${idx++}` : '?')

  for (const [key, val] of Object.entries(condition)) {
    if (val === undefined) continue

    if (Array.isArray(val)) {
      // IN 查询
      const placeholders = val.map(() => nextPlaceholder()).join(', ')
      clauses.push(`${key} IN (${placeholders})`)
      values.push(...val)
    } else if (typeof val === 'object' && val !== null) {
      // 操作符查询
      for (const [op, v] of Object.entries(val)) {
        if (op.toLowerCase() === 'like') {
          clauses.push(`${key} LIKE ${nextPlaceholder()}`)
          values.push(v)
        } else if (op.toLowerCase() === 'between' && Array.isArray(v)) {
          clauses.push(`${key} BETWEEN ${nextPlaceholder()} AND ${nextPlaceholder()}`)
          values.push(v[0], v[1])
          idx++ // 占位符多占一个
        } else {
          clauses.push(`${key} ${op} ${nextPlaceholder()}`)
          values.push(v)
        }
      }
    } else {
      // 普通等值查询
      clauses.push(`${key} = ${nextPlaceholder()}`)
      values.push(val)
    }
  }

  const clause = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''
  return { clause, values }
}

module.exports = { buildWhereClause }

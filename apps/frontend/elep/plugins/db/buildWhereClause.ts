// common/buildWhereClause.ts

export type DbType = 'postgres' | 'mysql'

export type Operator = '=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'BETWEEN'

// 支持：{ name: 'Tom' } 或 { age: { '>=': 18 } }
export type ConditionValue = string | number | boolean | null | undefined | ConditionOperatorValue

export type ConditionOperatorValue = {
  [K in Operator]?: any
}

export type ConditionInput = Record<string, ConditionValue | ConditionValue[]>

export interface WhereClauseResult {
  clause: string
  values: any[]
}

/**
 * 构建 WHERE 条件语句及参数数组
 * 支持操作符：=、>、<、>=、<=、LIKE、IN、BETWEEN
 * @param condition 查询条件对象
 * @param dbType 数据库类型（postgres/mysql）
 * @returns { clause, values }
 */
export function buildWhereClause(condition: ConditionInput = {}, dbType: DbType = 'postgres'): WhereClauseResult {
  const clauses: string[] = []
  const values: any[] = []
  let idx = 1

  const nextPlaceholder = () => (dbType === 'postgres' ? `$${idx++}` : '?')

  for (const [key, val] of Object.entries(condition)) {
    if (val === undefined) continue

    if (Array.isArray(val)) {
      // IN 查询
      const placeholders = val.map(() => nextPlaceholder()).join(', ')
      clauses.push(`${key} IN (${placeholders})`)
      values.push(...val)
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      // 操作符对象
      for (const [op, v] of Object.entries(val)) {
        const upperOp = op.toUpperCase()
        if (upperOp === 'LIKE') {
          clauses.push(`${key} LIKE ${nextPlaceholder()}`)
          values.push(v)
        } else if (upperOp === 'BETWEEN' && Array.isArray(v)) {
          clauses.push(`${key} BETWEEN ${nextPlaceholder()} AND ${nextPlaceholder()}`)
          values.push(v[0], v[1])
        } else {
          clauses.push(`${key} ${op} ${nextPlaceholder()}`)
          values.push(v)
        }
      }
    } else {
      // 普通 =
      clauses.push(`${key} = ${nextPlaceholder()}`)
      values.push(val)
    }
  }

  const clause = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''
  return { clause, values }
}

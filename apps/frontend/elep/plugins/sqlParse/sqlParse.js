// SQL 保留字，避免误识别为表名
const SQL_KEYWORDS = new Set([
  'select',
  'insert',
  'update',
  'delete',
  'set',
  'from',
  'where',
  'join',
  'on',
  'using',
  'with',
  'into',
  'values',
  'union',
  'intersect',
  'except',
  'group',
  'order',
  'by',
  'limit',
  'offset',
  'create',
  'drop',
  'alter',
])

function isValidTableName(name) {
  return name && !SQL_KEYWORDS.has(name.toLowerCase())
}

/**
 * 检测数据库类型
 * @param {*} sqlContent
 * @returns
 */
function detectDatabaseType(sqlContent) {
  if (/ENGINE\s*=\s*InnoDB|AUTO_INCREMENT|DELIMITER/i.test(sqlContent)) {
    return 'MySQL'
  } else if (/IDENTITY|GO|NVARCHAR/i.test(sqlContent)) {
    return 'SQL Server'
  } else if (/BEGIN|END|VARCHAR2|PL\/SQL/i.test(sqlContent)) {
    return 'Oracle'
  } else if (/SERIAL|BIGSERIAL|RETURNING/i.test(sqlContent)) {
    return 'PostgreSQL'
  }
  return 'Unknown'
}

/**
 * 去除注释
 * @param {*} sql
 * @returns
 */
function removeComments(sql) {
  sql = sql.replace(/--.*$/gm, '')
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '')
  return sql
}

/**
 * 提取 WITH 子句中的所有 CTE 名称
 * @param {*} sql
 * @returns
 */
function getCTENames(sql) {
  const lowered = sql.toLowerCase()
  const names = []

  const withMatch = lowered.match(/\bwith\b\s+(.*)/is)
  if (!withMatch) return names

  let remaining = withMatch[1]
  let index = 0
  const length = remaining.length

  while (index < length) {
    const nameMatch = remaining.slice(index).match(/^([a-zA-Z0-9_]+)\s+as\s*\(/i)
    if (!nameMatch) break
    names.push(nameMatch[1])
    index += nameMatch[0].length

    // 跳过括号内容（平衡括号）
    let depth = 1
    while (index < length && depth > 0) {
      if (remaining[index] === '(') depth++
      else if (remaining[index] === ')') depth--
      index++
    }

    while (index < length && /[\s,]/.test(remaining[index])) index++
  }

  return names
}

/**
 * 判断是否为临时表（4条规则）
 * @param {*} sql
 * @param {*} tableName
 * @param {*} schema
 * @returns
 */
function isTemporaryTableAccurate(sql, tableName, schema) {
  const loweredSql = sql.toLowerCase(),
    loweredTable = tableName.toLowerCase()
  const createTempRegex = new RegExp(
    `create\\s+(global\\s+)?temp(orary)?\\s+table\\s+["'\`]?${loweredTable}["'\`]?[\\s\\(]`,
    'i',
  )
  if (createTempRegex.test(loweredSql)) return true
  if (getCTENames(sql).includes(loweredTable)) return true
  if (loweredTable.startsWith('temp_') || loweredTable.includes('tmp')) return true
  if (!schema) return true // ✅ 不再强制 public 为临时表
  return false
}

/**
 * 去重工具
 * @param {*} tables
 * @returns
 */
function deduplicateTables(tables) {
  const seen = new Set()
  return tables.filter(({ schema, table }) => {
    const key = `${schema}.${table}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * 主解析函数
 * @param {*} sqlContent
 * @returns
 */
function parseSql(sqlContent) {
  const sourceTables = []
  const targetTables = []
  const procedures = []
  const functionNames = []

  sqlContent = removeComments(sqlContent)

  const databaseType = detectDatabaseType(sqlContent)
  const patterns = [
    { type: 'source', regex: /(?<!delete\s)from\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'source', regex: /join\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'source', regex: /using\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'target', regex: /delete\s+from\s+([a-zA-Z0-9_\.]+)/gi }, // ✅ delete 单独作为目标表
    { type: 'target', regex: /insert\s+into\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'target', regex: /update\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'target', regex: /merge\s+into\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'target', regex: /select\s+.*?\s+into\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'source', regex: /select\s+.*?\s+from\s+([a-zA-Z0-9_\.]+)/gi },
  ]

  for (const { type, regex } of patterns) {
    let match
    while ((match = regex.exec(sqlContent)) !== null) {
      const full = match[1]
      const [schema = '', table] = full.includes('.') ? full.split('.') : ['', full]

      if (!isValidTableName(table)) continue

      const entry = {
        schema: schema || 'public',
        table,
        isTemporary: isTemporaryTableAccurate(sqlContent, table, schema),
      }

      if (type === 'source') sourceTables.push(entry)
      else targetTables.push(entry)
    }
  }

  // 提取函数/存储过程
  const procedureRegex =
    /CREATE\s+(OR\s+REPLACE\s+)?(PROCEDURE|FUNCTION)\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/gi
  let match
  while ((match = procedureRegex.exec(sqlContent)) !== null) {
    const schemaName = match[3],
      name = match[4]
    if (match[2].toUpperCase() === 'PROCEDURE')
      procedures.push({ type: 'PROCEDURE', schema: schemaName, name })
    else functionNames.push({ type: 'FUNCTION', schema: schemaName, name })
  }

  const sourceSet = deduplicateTables(sourceTables)
  const targetSet = deduplicateTables(targetTables)
  const nodes = []

  sourceSet.forEach(({ schema, table, isTemporary }) => {
    nodes.push({
      id: `table:${schema}.${table}`,
      label: table,
      type: 'table',
      isTemporary,
      style: { fill: isTemporary ? '#FFD700' : '#87CEFA' },
    })
  })
  targetSet.forEach(({ schema, table, isTemporary }) => {
    const id = `table:${schema}.${table}`
    if (!nodes.find((n) => n.id === id)) {
      nodes.push({
        id,
        label: table,
        type: 'table',
        isTemporary,
        style: { fill: isTemporary ? '#FFD700' : '#87CEFA' },
      })
    }
  })
  procedures.forEach(({ schema, name }) => {
    nodes.push({
      id: `function:${schema}.${name}`,
      label: name,
      type: 'function',
      style: { fill: '#FFB6C1' },
    })
  })
  functionNames.forEach(({ schema, name }) => {
    nodes.push({
      id: `function:${schema}.${name}`,
      label: name,
      type: 'function',
      style: { fill: '#DDA0DD' },
    })
  })

  const edges = []
  sourceSet.forEach((src) => {
    targetSet.forEach((tgt) => {
      edges.push({
        source: `table:${src.schema}.${src.table}`,
        target: `table:${tgt.schema}.${tgt.table}`,
        label: 'TRANSFORM',
      })
    })
  })
  targetSet.forEach((tgt) => {
    procedures.forEach((fn) => {
      edges.push({
        source: `table:${tgt.schema}.${tgt.table}`,
        target: `function:${fn.schema}.${fn.name}`,
        label: 'CALL PROCEDURE',
      })
    })
    functionNames.forEach((fn) => {
      edges.push({
        source: `table:${tgt.schema}.${tgt.table}`,
        target: `function:${fn.schema}.${fn.name}`,
        label: 'CALL FUNCTION',
      })
    })
  })

  return {
    databaseType,
    procedures,
    functionNames,
    sourceTables: sourceSet,
    targetTables: targetSet,
    nodes,
    edges,
  }
}

module.exports = {
  parseSql,
}

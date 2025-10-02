// sqlParse.js（优化 + 字段级血缘）
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

function detectDatabaseType(sqlContent) {
  if (/ENGINE\s*=\s*InnoDB|AUTO_INCREMENT|DELIMITER/i.test(sqlContent)) return 'MySQL'
  if (/IDENTITY|GO|NVARCHAR/i.test(sqlContent)) return 'SQL Server'
  if (/BEGIN|END|VARCHAR2|PL\/SQL/i.test(sqlContent)) return 'Oracle'
  if (/SERIAL|BIGSERIAL|RETURNING/i.test(sqlContent)) return 'PostgreSQL'
  return 'Unknown'
}

function removeComments(sql) {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

function getCTENames(sql) {
  const lowered = sql.toLowerCase()
  const names = []
  const withMatch = lowered.match(/\bwith\b\s+(.*)/is)
  if (!withMatch) return names
  let remaining = withMatch[1],
    index = 0,
    length = remaining.length
  while (index < length) {
    const nameMatch = remaining.slice(index).match(/^([a-zA-Z0-9_]+)\s+as\s*\(/i)
    if (!nameMatch) break
    names.push(nameMatch[1])
    index += nameMatch[0].length
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
  if (!schema) return true
  return false
}

function deduplicateTables(tables) {
  const seen = new Set()
  return tables.filter(({ schema, table }) => {
    const key = `${schema.toLowerCase()}.${table.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeTableId(raw) {
  const [schema = 'public', table] = raw.includes('.') ? raw.split('.') : ['public', raw]
  return `${schema}.${table}`
}

function extractEdgesByStatement(sqlContent, procedureNames = []) {
  const statements = sqlContent
    .split(/;\s*/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const edges = []
  statements.forEach((stmt) => {
    const sources = [],
      targets = []
    const sourceRegexes = [/(?<!delete\s)from\s+([a-zA-Z0-9_\.]+)/gi, /join\s+([a-zA-Z0-9_\.]+)/gi]
    const targetRegexes = [
      /insert\s+into\s+([a-zA-Z0-9_\.]+)/gi,
      /update\s+([a-zA-Z0-9_\.]+)/gi,
      /delete\s+from\s+([a-zA-Z0-9_\.]+)/gi,
      /merge\s+into\s+([a-zA-Z0-9_\.]+)/gi,
      /select\s+.*?\s+into\s+([a-zA-Z0-9_\.]+)/gi,
    ]
    sourceRegexes.forEach((r) => {
      let m
      while ((m = r.exec(stmt)) !== null) sources.push(m[1])
    })
    targetRegexes.forEach((r) => {
      let m
      while ((m = r.exec(stmt)) !== null) targets.push(m[1])
    })
    sources.forEach((src) => {
      targets.forEach((tgt) => {
        edges.push({
          source: `table:${normalizeTableId(src)}`,
          target: `table:${normalizeTableId(tgt)}`,
          label: `TRANSFORM${procedureNames.length ? ' via ' + procedureNames[0].name : ''}`,
        })
      })
    })
  })
  return edges
}

function extractRenameTables(sqlContent) {
  const renameCalls = []
  const regex1 =
    /p_rename_table\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/gi
  const regex2 =
    /p_rename_table\s*\(\s*sourceSchema\s*=>\s*'([^']+)'\s*,\s*sourceTable\s*=>\s*'([^']+)'\s*,\s*targetSchema\s*=>\s*'([^']+)'\s*,\s*targetTable\s*=>\s*'([^']+)'\s*\)/gi
  let match
  while ((match = regex1.exec(sqlContent)) !== null || (match = regex2.exec(sqlContent)) !== null) {
    const [sourceSchema, sourceTable, targetSchema, targetTable] = match.slice(1)
    renameCalls.push({
      source: { schema: sourceSchema, table: sourceTable },
      target: { schema: targetSchema, table: targetTable },
    })
  }
  return renameCalls
}

function parseSql(sqlContent, options = { includeTemporaryTables: true }) {
  let sourceTables = [],
    targetTables = [],
    procedures = [],
    functionNames = []
  sqlContent = removeComments(sqlContent)
  const databaseType = detectDatabaseType(sqlContent)
  const renameInfo = extractRenameTables(sqlContent)
  const patterns = [
    { type: 'source', regex: /(?<!delete\s)from\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'source', regex: /join\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'source', regex: /using\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'target', regex: /delete\s+from\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'target', regex: /insert\s+into\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'target', regex: /update\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'target', regex: /merge\s+into\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'target', regex: /select\s+.*?\s+into\s+([a-zA-Z0-9_\.]+)/gi },
    { type: 'source', regex: /select\s+.*?\s+from\s+([a-zA-Z0-9_\.]+)/gi },
  ]
  for (const { type, regex } of patterns) {
    let match
    while ((match = regex.exec(sqlContent)) !== null) {
      const full = match[1],
        [schema = '', table] = full.includes('.') ? full.split('.') : ['', full]
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
  renameInfo.forEach(({ source, target }) => {
    sourceTables.push({ ...source, isTemporary: true })
    targetTables.push({ ...target, isTemporary: false })
    targetTables = targetTables.filter(
      (t) => !(t.schema === source.schema && t.table === source.table),
    )
  })
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
  const shouldInclude = (isTemp) => options.includeTemporaryTables || !isTemp
  sourceSet.forEach(({ schema, table, isTemporary }) => {
    if (!shouldInclude(isTemporary)) return
    nodes.push({
      id: `table:${schema}.${table}`,
      label: table,
      type: 'table',
      isTemporary,
      style: { fill: isTemporary ? '#FFD700' : '#87CEFA' },
    })
  })
  targetSet.forEach(({ schema, table, isTemporary }) => {
    if (!shouldInclude(isTemporary)) return
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
  const edges = extractEdgesByStatement(sqlContent, procedures.concat(functionNames))
  renameInfo.forEach(({ source, target }) => {
    edges.push({
      source: `table:${source.schema}.${source.table}`,
      target: `table:${target.schema}.${target.table}`,
      label: 'RENAME',
    })
  })
  targetSet.forEach((tgt) => {
    procedures.forEach((fn) => {
      if (!shouldInclude(tgt.isTemporary)) return
      edges.push({
        source: `table:${tgt.schema}.${tgt.table}`,
        target: `function:${fn.schema}.${fn.name}`,
        label: 'CALL PROCEDURE',
      })
    })
    functionNames.forEach((fn) => {
      if (!shouldInclude(tgt.isTemporary)) return
      edges.push({
        source: `table:${tgt.schema}.${tgt.table}`,
        target: `function:${fn.schema}.${fn.name}`,
        label: 'CALL FUNCTION',
      })
    })
  })

  // ---------------- 字段级血缘提取 ------------------
  const columnEdges = []
  const selectMapRegex =
    /insert\s+into\s+([a-zA-Z0-9_\.]+)?\s*\(([^)]+)\)\s*select\s+([^;]+?)\s+from\s+([a-zA-Z0-9_\.]+)/gis
  let match2
  while ((match2 = selectMapRegex.exec(sqlContent)) !== null) {
    const [_, targetTableFull, targetColsRaw, selectColsRaw, sourceTableFull] = match2
    const [targetSchema = 'public', targetTable] = targetTableFull?.split('.') ?? [
      'public',
      targetTableFull,
    ]
    const [sourceSchema = 'public', sourceTable] = sourceTableFull?.split('.') ?? [
      'public',
      sourceTableFull,
    ]
    const targetColumns = targetColsRaw.split(',').map((c) => c.trim().replace(/["']/g, ''))
    const sourceColumns = selectColsRaw.split(',').map((c) => {
      const parts = c.trim().split(/\s+as\s+/i)
      return { expr: parts[0].trim(), alias: parts[1]?.trim() || parts[0].trim() }
    })
    if (targetColumns.length === sourceColumns.length) {
      for (let i = 0; i < targetColumns.length; i++) {
        columnEdges.push({
          source: `${sourceSchema}.${sourceTable}.${sourceColumns[i].expr}`,
          target: `${targetSchema}.${targetTable}.${targetColumns[i]}`,
          label: 'FIELD_MAP',
        })
      }
    }
  }

  return {
    databaseType,
    procedures,
    functionNames,
    sourceTables: sourceSet,
    targetTables: targetSet,
    nodes,
    edges,
    columnEdges,
  }
}

module.exports = { parseSql }

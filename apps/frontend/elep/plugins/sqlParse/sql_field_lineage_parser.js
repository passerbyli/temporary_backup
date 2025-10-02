// sql_field_lineage_parser.js
// 支持 WITH + INSERT INTO + SELECT 嵌套解析，字段级血缘提取

const fs = require('fs')
const path = require('path')
const { parse } = require('pgsql-ast-parser')

function extractSourceRefs(expr) {
  if (!expr) return []
  if (expr.type === 'ref') {
    return [
      {
        column: expr.name?.name,
        table: expr.name?.table || expr.table || 'unknown',
      },
    ]
  }
  if (expr.type === 'call') {
    return expr.args.flatMap(extractSourceRefs)
  }
  if (expr.type === 'binary') {
    return [...extractSourceRefs(expr.left), ...extractSourceRefs(expr.right)]
  }
  if (expr.type === 'case') {
    return expr.whens
      .flatMap((w) => extractSourceRefs(w.condition).concat(extractSourceRefs(w.value)))
      .concat(extractSourceRefs(expr.else))
  }
  if (expr.type === 'select') {
    return expr.columns.flatMap((col) => extractSourceRefs(col.expr))
  }
  return []
}

function extractFromTables(select) {
  const fromMap = {}
  for (const f of select.from || []) {
    if (f.type === 'table') {
      const tableName = f.name.name
      const alias = f.alias ? f.alias.name : tableName
      fromMap[alias] = tableName
    } else if (f.type === 'select') {
      const alias = f.alias?.name || `subquery_${Math.random().toString(36).substring(2, 6)}`
      fromMap[alias] = `cte.${alias}`
    }
  }
  return fromMap
}

function processSelect(select, targetTable, targetFields, lineage, fromTables = {}) {
  select.columns.forEach((col, idx) => {
    const sourceRefs = extractSourceRefs(col.expr)
    const targetField = targetFields?.[idx] || col.alias || `col_${idx}`
    const target = `${targetTable}.${targetField}`

    if (!lineage.nodes[target]) {
      lineage.nodes[target] = { id: target, label: target, type: 'Field' }
    }

    for (const { table, column } of sourceRefs) {
      const resolvedTable = fromTables[table] || table || 'unknown'
      const source = `${resolvedTable}.${column}`
      if (!lineage.nodes[source]) {
        lineage.nodes[source] = { id: source, label: source, type: 'Field' }
      }
      lineage.edges.push({ source, target, label: 'FIELD_LINEAGE' })
    }
  })
}

function processInsertStatement(stmt, lineage) {
  if (!stmt.insert || stmt.insert.type !== 'select') return
  const targetTable = stmt.into.name.name
  const targetFields = stmt.columns || []
  const selectStmt = stmt.insert
  const fromTables = extractFromTables(selectStmt)
  processSelect(selectStmt, targetTable, targetFields, lineage, fromTables)
}

function processStatements(statements, lineage) {
  for (const stmt of statements) {
    if (stmt.type === 'insert') {
      processInsertStatement(stmt, lineage)
    } else if (stmt.type === 'with') {
      stmt.bindings.forEach((cte) => {
        const alias = `cte.${cte.name.name}`
        const fromTables = extractFromTables(cte.statement)
        processSelect(cte.statement, alias, null, lineage, fromTables)
      })
      if (stmt.statement?.type === 'insert') {
        processInsertStatement(stmt.statement, lineage)
      }
    }
  }
}

function extractSqlBlocksFromProcedure(sqlText) {
  const matches = sqlText.match(/BEGIN([\s\S]*?)END;/gi)
  if (!matches) return []

  const sqlBlock = matches[0].replace(/BEGIN|END;/gi, '')

  // 使用正则将 WITH ... INSERT ... SELECT ... 整段保留
  const withInsertRegex = /WITH[\\s\\S]+?INSERT[\\s\\S]+?SELECT[\\s\\S]+?;/gi
  const insertsOnly = sqlBlock.match(withInsertRegex) || []

  return insertsOnly.map((sql) => sql.trim())
}

function parseSqlToFieldLineage(sql) {
  const lineage = { nodes: {}, edges: [] }
  const sqlBlocks = extractSqlBlocksFromProcedure(sql)

  for (const sqlStmt of sqlBlocks) {
    try {
      const astList = parse(sqlStmt)
      processStatements(astList, lineage)
    } catch (e) {
      console.warn('⚠️ 跳过解析失败语句:', sqlStmt)
    }
  }

  return {
    nodes: Object.values(lineage.nodes),
    edges: lineage.edges,
  }
}

// 示例调用
const inputSql = fs.readFileSync(path.resolve(__dirname, 'sql/example.sql'), 'utf-8')
const lineageJson = parseSqlToFieldLineage(inputSql)
fs.writeFileSync(
  path.resolve(__dirname, 'sql/field_lineage.json'),
  JSON.stringify(lineageJson, null, 2),
  'utf-8',
)
console.log('✅ 字段血缘提取完成（存储过程），结果写入 field_lineage.json')

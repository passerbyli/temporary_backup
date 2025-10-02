// sqlParse.js (支持字段级血缘，嵌入 G6 节点 fields 属性)
const { Parser } = require('node-sql-parser')

function parseSql(sqlContent) {
  const parser = new Parser()
  let ast
  try {
    ast = parser.astify(sqlContent, { database: 'postgresql' })
  } catch (err) {
    console.error('SQL 解析失败:', err.message)
    return {
      databaseType: 'PostgreSQL',
      procedures: [],
      functionNames: [],
      sourceTables: [],
      targetTables: [],
      nodes: [],
      edges: [],
    }
  }

  if (!Array.isArray(ast)) ast = [ast]

  const databaseType = 'PostgreSQL'
  const procedures = []
  const functionNames = []
  const sourceTables = []
  const targetTables = []
  const nodesMap = new Map()
  const edges = []

  const addTable = (schema, table, isTemp = false) => {
    const id = `table:${schema}.${table}`
    if (!nodesMap.has(id)) {
      nodesMap.set(id, {
        id,
        label: table,
        type: 'table',
        isTemporary: isTemp,
        fields: [],
        style: { fill: isTemp ? '#FFD700' : '#87CEFA' },
      })
    }
    return id
  }

  const addFieldMapping = (tgtSchema, tgtTable, tgtField, srcFieldFull) => {
    const nodeId = `table:${tgtSchema}.${tgtTable}`
    const node = nodesMap.get(nodeId)
    if (!node) return
    if (!node.fields.some((f) => f.name === tgtField)) {
      node.fields.push({ name: tgtField, source: srcFieldFull })
    }
  }

  const addEdge = (src, tgt, label) => {
    edges.push({ source: src, target: tgt, label })
  }

  for (const stmt of ast) {
    if (stmt.type === 'insert') {
      const tgt = stmt.table
      const tgtSchema = tgt.db || 'public'
      const tgtName = tgt.table
      const tgtId = addTable(tgtSchema, tgtName)
      targetTables.push({ schema: tgtSchema, table: tgtName, isTemporary: false })

      if (stmt.select && stmt.select.from) {
        const fromTables = stmt.select.from.filter((f) => f.table)
        const tableAliasMap = {}

        fromTables.forEach((f) => {
          const srcSchema = f.db || 'public'
          const srcName = f.table
          const alias = f.as || f.table
          const srcId = addTable(srcSchema, srcName)
          sourceTables.push({ schema: srcSchema, table: srcName, isTemporary: false })
          addEdge(srcId, tgtId, 'INSERT')
          tableAliasMap[alias] = `${srcSchema}.${srcName}`
        })

        const columns = stmt.columns || []
        const selectExprs = stmt.select.columns || []

        for (let i = 0; i < selectExprs.length; i++) {
          const col = selectExprs[i]
          const tgtField = columns[i] || col.as || col.column

          let srcField = null
          if (col.expr?.type === 'column_ref') {
            const colName = col.expr.column
            const tblAlias = col.expr.table || null
            const fullSrc =
              tblAlias && tableAliasMap[tblAlias]
                ? `${tableAliasMap[tblAlias]}.${colName}`
                : colName
            srcField = fullSrc
          } else {
            srcField = 'expression'
          }

          if (tgtField) {
            addFieldMapping(tgtSchema, tgtName, tgtField, srcField)
          }
        }
      }
    }

    if (stmt.type === 'update') {
      const tgtSchema = stmt.table.db || 'public'
      const tgtName = stmt.table.table
      const tgtId = addTable(tgtSchema, tgtName)
      targetTables.push({ schema: tgtSchema, table: tgtName, isTemporary: false })

      if (stmt.from) {
        for (const src of stmt.from) {
          if (src.table) {
            const srcSchema = src.db || 'public'
            const srcName = src.table
            const srcId = addTable(srcSchema, srcName)
            sourceTables.push({ schema: srcSchema, table: srcName, isTemporary: false })
            addEdge(srcId, tgtId, 'UPDATE')
          }
        }
      }
    }

    if (stmt.type === 'delete') {
      const tgt = stmt.from[0]
      const tgtSchema = tgt.db || 'public'
      const tgtName = tgt.table
      const tgtId = addTable(tgtSchema, tgtName)
      targetTables.push({ schema: tgtSchema, table: tgtName, isTemporary: false })
    }

    if (stmt.type === 'select') {
      if (stmt.from) {
        for (const src of stmt.from) {
          if (src.table) {
            const srcSchema = src.db || 'public'
            const srcName = src.table
            const srcId = addTable(srcSchema, srcName)
            sourceTables.push({ schema: srcSchema, table: srcName, isTemporary: false })
          }
        }
      }
    }
  }

  return {
    databaseType,
    procedures,
    functionNames,
    sourceTables,
    targetTables,
    nodes: Array.from(nodesMap.values()),
    edges,
  }
}

module.exports = { parseSql }

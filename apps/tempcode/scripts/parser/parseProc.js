// parser/parseProc.js

const fs = require('fs')

/**
 * 解析 SQL 内容，提取表级血缘关系
 * @param {string} sql SQL内容
 * @param {string} procName 存储过程/视图 名称
 * @returns {Object} {nodes, edges, isSwitchTable}
 */
function parseSqlFile(sql, procName) {
  const nodesMap = new Map()
  const edges = []
  let isSwitchTable = false

  const insertRegex = /insert into ([a-zA-Z0-9_\.]+)/gi
  const fromRegex = /from ([a-zA-Z0-9_\.]+)/gi
  const truncateRegex = /truncate table ([a-zA-Z0-9_\.]+)/gi
  const renameRegex = /p_rename_table\((.*?)\)/gi

  const sourceTables = new Set()
  const targetTables = new Set()
  let switchTableSource = null
  let switchTableTarget = null

  let insertMatch
  while ((insertMatch = insertRegex.exec(sql))) {
    const targetTable = insertMatch[1]
    targetTables.add(targetTable)
    if (!nodesMap.has(targetTable)) {
      nodesMap.set(targetTable, { id: targetTable, label: targetTable, type: 'table' })
    }
  }

  let fromMatch
  while ((fromMatch = fromRegex.exec(sql))) {
    const sourceTable = fromMatch[1]
    sourceTables.add(sourceTable)
    if (!nodesMap.has(sourceTable)) {
      nodesMap.set(sourceTable, { id: sourceTable, label: sourceTable, type: 'table' })
    }
  }

  // 检测 p_rename_table 调用
  let renameMatch
  while ((renameMatch = renameRegex.exec(sql))) {
    const args = renameMatch[1].split(',').map((x) => x.trim().replace(/'|"/g, ''))
    if (args.length >= 4) {
      isSwitchTable = true
      switchTableSource = args[1] // sourceTable
      switchTableTarget = args[3] // targetTable
      if (!nodesMap.has(switchTableTarget)) {
        nodesMap.set(switchTableTarget, {
          id: switchTableTarget,
          label: switchTableTarget,
          type: 'table',
        })
      }
    }
  }

  // 生成 edges 源表 -> 中间表
  sourceTables.forEach((source) => {
    targetTables.forEach((target) => {
      edges.push({ source, target, label: procName })
    })
  })

  // 表切换 edge
  if (isSwitchTable && switchTableSource && switchTableTarget) {
    edges.push({ source: switchTableSource, target: switchTableTarget, label: 'p_rename_table' })
  }

  const nodes = []
  nodesMap.forEach((node) => {
    node.isSourceInput = sourceTables.has(node.id)
    node.isFinalOutput = node.id === switchTableTarget
    nodes.push(node)
  })

  return {
    nodes,
    edges,
    isSwitchTable,
  }
}

module.exports = { parseSqlFile }

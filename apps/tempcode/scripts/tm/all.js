const fs = require('fs')
const path = require('path')

// 输入/输出路径
const INPUT_PATH = path.resolve(__dirname, 'input.json')
const OUTPUT_JSON_PATH = path.resolve(__dirname, 'output.json')
const OUTPUT_SQL_PATH = path.resolve(__dirname, 'desensitize.sql')

/** -------------------------------
 * 规则关键词定义（用于字段打标）
 * 每条规则对应一组关键词
 --------------------------------- */
const ruleKeywords = [
  { id: 1, keywords: ['phone', 'tel', 'identity card', '身份证', '手机号'] },
  { id: 2, keywords: ['company', 'personname', 'companyname'] },
  { id: 3, keywords: ['amount', 'orderAmount'] },
  { id: 4, keywords: ['合同号', '合同名称', '合同编号'] },
]

/** -------------------------------
 * 规则处理函数注册（id => handler）
 --------------------------------- */
const ruleHandlers = {
  1: generateRule1SQL,
  2: generateRule2SQL,
  3: generateRule3SQL,
  4: generateRule4SQL,
}

/** -------------------------------
 * 规则 1：敏感字段，直接替换为 '***'
 --------------------------------- */
function generateRule1SQL({ col }) {
  return {
    type: 'normal',
    sql: `${col} = '***'`,
  }
}

/** -------------------------------
 * 规则 2：字段含公司关键词，拼接 "公司_" + ID
 --------------------------------- */
function generateRule2SQL({ col, table, field }) {
  const prefix = '公司_'

  if (field.依赖字段 && !field.关联表) {
    return {
      type: 'normal',
      sql: `${col} = CONCAT('${prefix}', ${field.依赖字段})`,
    }
  }

  if (field.依赖字段 && field.关联表 && field.关联条件) {
    const joinTable = field.关联表
    const alias = joinTable.split('.').pop()
    return {
      type: 'join',
      joinTable,
      joinCondition: field.关联条件,
      setClause: `${table}.${col} = CONCAT('${prefix}', ${alias}.id)`,
    }
  }

  return {
    type: 'normal',
    sql: `${col} = CONCAT('${prefix}', FLOOR(RAND() * 10000))`,
  }
}

/** -------------------------------
 * 规则 3：数值扰动，字段加减随机值
 --------------------------------- */
function generateRule3SQL({ col }) {
  return {
    type: 'normal',
    sql: `${col} = ${col} + FLOOR(RAND() * 1000 - 500)`,
  }
}

/** -------------------------------
 * 规则 4：字段含合同关键词，拼接 "合同_" + ID
 --------------------------------- */
function generateRule4SQL({ col, table, field }) {
  const prefix = '合同_'

  if (field.依赖字段 && !field.关联表) {
    return {
      type: 'normal',
      sql: `${col} = CONCAT('${prefix}', ${field.依赖字段})`,
    }
  }

  if (field.依赖字段 && field.关联表 && field.关联条件) {
    const joinTable = field.关联表
    const alias = joinTable.split('.').pop()
    return {
      type: 'join',
      joinTable,
      joinCondition: field.关联条件,
      setClause: `${table}.${col} = CONCAT('${prefix}', ${alias}.id)`,
    }
  }

  return {
    type: 'normal',
    sql: `${col} = CONCAT('${prefix}', FLOOR(RAND() * 100000))`,
  }
}

/** -------------------------------
 * 根据字段名 + 描述匹配规则
 --------------------------------- */
function getMatchedRules(fieldName, comment) {
  const matched = []
  for (const rule of ruleKeywords) {
    for (const kw of rule.keywords) {
      if (fieldName.toLowerCase().includes(kw.toLowerCase()) || comment.includes(kw)) {
        matched.push(rule.id)
        break
      }
    }
  }
  return matched
}

/** -------------------------------
 * 标记字段是否敏感、匹配了哪些规则
 --------------------------------- */
function markFields(fields) {
  return fields.map((field) => {
    const matchedRules = getMatchedRules(field.字段, field.描述 || '')
    return {
      ...field,
      是否敏感: matchedRules.length > 0 ? '是' : '否',
      符合规则: matchedRules,
    }
  })
}

/** -------------------------------
 * 按表分组生成 SQL（支持 JOIN）
 --------------------------------- */
function generateSQL(fields) {
  const grouped = {}

  // 按 schema.表名 分组
  for (const field of fields) {
    const key = `${field.schema}.${field.表名}`
    if (!grouped[key]) grouped[key] = []
    if (field.符合规则?.length > 0) {
      grouped[key].push(field)
    }
  }

  const sqlList = []

  // 对每张表生成更新 SQL
  for (const [tableKey, fieldList] of Object.entries(grouped)) {
    const [schema, table] = tableKey.split('.')
    const normalSet = []
    const joinSet = []

    for (const field of fieldList) {
      const col = field.字段

      for (const ruleId of field.符合规则) {
        const handler = ruleHandlers[ruleId]
        if (handler) {
          const result = handler({ schema, table, col, field })
          if (result.type === 'normal') {
            normalSet.push(result.sql)
          } else if (result.type === 'join') {
            joinSet.push(result)
          }
        }
      }
    }

    if (normalSet.length) {
      sqlList.push(`UPDATE ${tableKey}\nSET ${normalSet.join(',\n    ')};`)
    }

    for (const j of joinSet) {
      sqlList.push(`UPDATE ${table} JOIN ${j.joinTable} ON ${j.joinCondition}\nSET ${j.setClause};`)
    }
  }

  return sqlList.join('\n\n')
}

/** -------------------------------
 * 主入口函数
 --------------------------------- */
function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error('❌ 找不到 input.json')
    process.exit(1)
  }

  const raw = fs.readFileSync(INPUT_PATH, 'utf-8')
  const input = JSON.parse(raw)
  const marked = markFields(input)

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(marked, null, 2))
  console.log('✅ 已输出带标记字段到 output.json')

  const sql = generateSQL(marked)
  fs.writeFileSync(OUTPUT_SQL_PATH, sql)
  console.log('✅ 已输出脱敏 SQL 到 desensitize.sql')
}

main()

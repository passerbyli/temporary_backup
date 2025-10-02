const fs = require('fs')
const path = require('path')

// 配置路径
const INPUT_PATH = path.resolve(__dirname, 'input.json')
const OUTPUT_JSON_PATH = path.resolve(__dirname, 'output.json')
const OUTPUT_SQL_PATH = path.resolve(__dirname, 'desensitize.sql')

// 规则模块（独立解耦）
const rule1 = require('./rules/rule1_mask_fixed')
const rule2 = require('./rules/rule2_company_prefix')
const rule3 = require('./rules/rule3_number_perturb')
const rule4 = require('./rules/rule4_contract_prefix')

// 所有规则对象注册（可扩展）
const ruleHandlers = {
  1: rule1,
  2: rule2,
  3: rule3,
  4: rule4,
}

// 所有关键词规则，用于字段分类打标
const ruleKeywords = [
  { id: 1, keywords: ['phone', 'tel', 'identity card', '身份证', '手机号'] },
  { id: 2, keywords: ['company', 'personname', 'companyname'] },
  { id: 3, keywords: ['amount', 'orderAmount'] },
  { id: 4, keywords: ['合同号', '合同名称', '合同编号'] },
]

/**
 * 判断字段是否命中关键词
 */
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

/**
 * 给字段打上规则标记
 */
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

/**
 * 根据字段列表生成脱敏 SQL
 */
function generateSQL(fields) {
  // 按 schema.表名 分组
  const grouped = {}
  for (const field of fields) {
    const key = `${field.schema}.${field.表名}`
    if (!grouped[key]) grouped[key] = []
    if (field.符合规则?.length > 0) {
      grouped[key].push(field)
    }
  }

  const sqlList = []

  for (const [tableKey, fieldList] of Object.entries(grouped)) {
    const [schema, table] = tableKey.split('.')
    const normalSet = []
    const joinSet = []

    for (const field of fieldList) {
      const col = field.字段
      for (const ruleId of field.符合规则) {
        const handler = ruleHandlers[ruleId]
        if (handler) {
          const result = handler.generateSQL({ schema, table, field })
          if (result.type === 'normal') {
            normalSet.push(result.sql)
          } else if (result.type === 'join') {
            joinSet.push(result) // 后续整合
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

// 主函数
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

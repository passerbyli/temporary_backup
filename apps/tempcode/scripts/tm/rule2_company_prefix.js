/**
 * 规则 2：字段含公司关键词 → 拼接 “公司_公司ID”
 * 可从本表字段或 join 表获取
 */
module.exports = {
  generateSQL({ table, field }) {
    const col = field.字段
    const prefix = '公司_'

    if (field.依赖字段 && !field.关联表) {
      // 来自本表字段
      return {
        type: 'normal',
        sql: `${col} = CONCAT('${prefix}', ${field.依赖字段})`,
      }
    }

    if (field.依赖字段 && field.关联表 && field.关联条件) {
      // 来自关联表字段
      const joinTable = field.关联表
      const joinCond = field.关联条件
      const alias = joinTable.split('.').pop()

      return {
        type: 'join',
        joinTable,
        joinCondition: joinCond,
        setClause: `${table}.${col} = CONCAT('${prefix}', ${alias}.id)`,
      }
    }

    // 默认 fallback：拼接随机数
    return {
      type: 'normal',
      sql: `${col} = CONCAT('${prefix}', FLOOR(RAND() * 10000))`,
    }
  },
}

import { parseExpression } from '@babel/parser'
import strip from 'strip-comments'

export function parseJsObjectToJson(input) {
  try {
    // ✅ 第一步：移除注释
    const cleaned = strip(input)

    // ✅ 第二步：转 AST
    const ast = parseExpression(cleaned, {
      sourceType: 'module',
      plugins: ['jsx']
    })

    // ✅ 第三步：提取值并格式化为 JSON
    const result = evalAst(ast)
    return JSON.stringify(result, null, 2)
  } catch (err) {
    throw new Error('解析失败: ' + err.message)
  }
}

// 递归处理 AST
function evalAst(node) {
  switch (node.type) {
    case 'ObjectExpression':
      return Object.fromEntries(
        node.properties.map(p => {
          const key = p.key.name || p.key.value
          const value = evalAst(p.value)
          return [key, value]
        })
      )

    case 'ArrayExpression':
      return node.elements.map(evalAst)

    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
      return node.value

    case 'Identifier':
      if (node.name === 'undefined') return undefined
      throw new Error(`不支持的标识符: ${node.name}`)

    case 'UnaryExpression':
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') {
        return -node.argument.value
      }
      throw new Error(`不支持的表达式: ${node.operator}`)

    default:
      throw new Error(`不支持的语法类型: ${node.type}`)
  }
}

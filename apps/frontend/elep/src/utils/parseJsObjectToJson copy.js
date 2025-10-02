// src/utils/parseJsObjectToJson.js
import { parseExpression } from '@babel/parser'

export function parseJsObjectToJson(input) {
  try {
    const ast = parseExpression(input, {
      sourceType: 'module',
      plugins: ['jsx']
    })

    const result = evalAst(ast)
    return JSON.stringify(result, null, 2)
  } catch (err) {
    throw new Error('解析失败: ' + err.message)
  }
}

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
      throw new Error(`不支持的变量标识符: ${node.name}`)

    case 'UnaryExpression':
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') {
        return -node.argument.value
      }
      throw new Error(`不支持的一元表达式: ${node.operator}`)

    default:
      throw new Error(`不支持的语法类型: ${node.type}`)
  }
}

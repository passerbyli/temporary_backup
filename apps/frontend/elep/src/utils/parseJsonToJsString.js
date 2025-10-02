import { parseExpression } from '@babel/parser'
import strip from 'strip-comments'

export function parseJsObjectToJson(input, sortKeys = false) {
  try {
    const cleaned = strip(input)
    const ast = parseExpression(cleaned, {
      sourceType: 'module',
      plugins: ['jsx']
    })

    const result = evalAst(ast)
    const final = sortKeys ? deepSortObject(result) : result
    return JSON.stringify(final, null, 2)
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
      throw new Error(`不支持的变量: ${node.name}`)
    case 'UnaryExpression':
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') {
        return -node.argument.value
      }
      throw new Error(`不支持表达式: ${node.operator}`)
    default:
      throw new Error(`不支持语法: ${node.type}`)
  }
}

function deepSortObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => {
      // 如果数组中的元素是对象，也进行排序
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return deepSortObject(item)
      }
      return item // 基础类型：数字、字符串、布尔值等
    })
  }

  if (obj && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = deepSortObject(obj[key])
        return acc
      }, {})
  }

  return obj
}

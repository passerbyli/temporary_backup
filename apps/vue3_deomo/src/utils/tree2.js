// tree.js

/**
 * 判断当前节点是否为叶子节点
 * 叶子节点定义：没有 child 属性，或 child 为空数组
 *
 * @param {Object} node - 树节点对象
 * @returns {boolean} 是否为叶子节点
 */
export function isLeaf(node) {
  return !node.child || node.child.length === 0
}

/**
 * 在树结构中根据 menuId 查找节点路径
 * 使用深度优先遍历（DFS），返回从根节点到目标节点的完整路径
 *
 * @param {Array<Object>} tree - 树的根节点数组
 * @param {string|number} id - 要查找的 menuId
 * @returns {Array<Object>|null} 节点路径数组，未找到返回 null
 */
export function findPathById(tree, id) {
  const path = []

  /**
   * 深度优先遍历函数
   *
   * @param {Array<Object>} nodes - 当前遍历的节点数组
   * @returns {boolean} 是否找到目标节点
   */
  function dfs(nodes) {
    for (const n of nodes || []) {
      // 将当前节点加入路径
      path.push(n)

      // 找到目标节点
      if (String(n.menuId) === String(id)) return true

      // 递归遍历子节点
      if (n.child && dfs(n.child)) return true

      // 回溯：当前分支未找到，移除节点
      path.pop()
    }
    return false
  }

  // id 为空时直接返回 null
  if (!id) return null

  // 找到则返回路径副本，否则返回 null
  return dfs(tree) ? path.slice() : null
}

/**
 * 从指定节点开始，获取其下的第一个叶子节点
 * 遍历顺序为深度优先，按 child 数组顺序
 *
 * @param {Object} node - 起始节点
 * @returns {Object|null} 第一个叶子节点，未找到返回 null
 */
export function pickFirstLeaf(node) {
  if (!node) return null

  // 当前节点就是叶子节点
  if (isLeaf(node)) return node

  // 递归查找子节点
  const ch = node.child || []
  for (const c of ch) {
    const leaf = pickFirstLeaf(c)
    if (leaf) return leaf
  }

  return null
}

/**
 * 从整棵树中获取第一个叶子节点
 * 通常用于默认选中第一个可访问菜单
 *
 * @param {Array<Object>} tree - 树的根节点数组
 * @returns {Object|null} 第一个叶子节点，未找到返回 null
 */
export function pickFirstLeafFromTree(tree) {
  for (const n of tree || []) {
    const leaf = pickFirstLeaf(n)
    if (leaf) return leaf
  }
  return null
}

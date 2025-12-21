export function isLeaf(node) {
  return !node.child || node.child.length === 0;
}

export function findPathById(tree, id) {
  const path = [];
  function dfs(nodes) {
    for (const n of nodes || []) {
      path.push(n);
      if (String(n.menuId) === String(id)) return true;
      if (n.child && dfs(n.child)) return true;
      path.pop();
    }
    return false;
  }
  if (!id) return null;
  return dfs(tree) ? path.slice() : null;
}

export function pickFirstLeaf(node) {
  if (!node) return null;
  if (isLeaf(node)) return node;
  const ch = node.child || [];
  for (const c of ch) {
    const leaf = pickFirstLeaf(c);
    if (leaf) return leaf;
  }
  return null;
}

export function pickFirstLeafFromTree(tree) {
  for (const n of tree || []) {
    const leaf = pickFirstLeaf(n);
    if (leaf) return leaf;
  }
  return null;
}
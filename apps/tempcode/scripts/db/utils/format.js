/**
 * 转换对象键为驼峰命名
 */
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertRowToCamelCase(row) {
  if (Array.isArray(row)) return row.map(convertRowToCamelCase);
  if (row === null || typeof row !== "object") return row;
  const result = {};
  for (const key in row) {
    result[toCamelCase(key)] = row[key];
  }
  return result;
}

module.exports = {
  convertRowToCamelCase,
};

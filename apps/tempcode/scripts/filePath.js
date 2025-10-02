const fs = require("fs");
const path = require("path");

/**
 * 确保路径对应的目录存在
 * @param {string} dirPath - 目录路径
 */
function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 根据路径创建文件夹或文件
 * @param {string} fullPath - 绝对路径（文件或目录）
 * @param {string} [content] - 如果传了内容，则会创建文件并写入；不传则只创建目录
 */
function createPath(fullPath, content) {
  const dir = path.extname(fullPath) ? path.dirname(fullPath) : fullPath;
  ensureDirSync(dir);

  if (content !== undefined && path.extname(fullPath)) {
    fs.writeFileSync(fullPath, content, "utf8");
    console.log(`文件已创建: ${fullPath}`);
  } else if (!path.extname(fullPath)) {
    console.log(`目录已创建: ${fullPath}`);
  }
}

// 示例
const p1 = path.join(__dirname, "/xxx/aaa/ccc", "/sss/aaa");
createPath(p1); // 只创建目录

const p2 = path.join(__dirname, "/xxx/aaa/ccc", "/sss/aaa", "test.txt");
createPath(p2, "Hello World"); // 创建文件并写入内容

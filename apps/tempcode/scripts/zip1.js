const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

/**
 * 压缩目录为 zip 文件
 * @param {string} dirPath 要压缩的目录路径
 * @param {string} [zipPath] 生成的 zip 文件路径（可选，不传则用最后一级目录名）
 */
function zipDirectory(dirPath, zipPath) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`目录不存在: ${dirPath}`);
  }

  // 如果没有指定 zip 文件名，则使用目录名
  if (!zipPath) {
    const baseName = path.basename(dirPath); // 取最后一级目录
    zipPath = path.join(path.dirname(dirPath), `${baseName}.zip`);
  }

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } }); // 压缩等级 0-9

    output.on("close", () => {
      console.log(`压缩完成: ${zipPath}, 共 ${archive.pointer()} 字节`);
      resolve(zipPath);
    });

    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(dirPath, false); // false 表示不保留父级目录
    archive.finalize();
  });
}

// ==================== 使用示例 ====================

(async () => {
  try {
    const dirPath = path.join(__dirname, "/xxx/aaa/ccc/sss/aaa");
    // 不传 zipPath，默认输出到 aaa.zip
    await zipDirectory(dirPath);

    // 或者自定义文件名
    // await zipDirectory(dirPath, path.join(__dirname, 'custom_name.zip'));
  } catch (err) {
    console.error("压缩失败:", err);
  }
})();

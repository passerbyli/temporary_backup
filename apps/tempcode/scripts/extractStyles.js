const fs = require("fs");
const path = require("path");

// 项目根目录
const projectRoot = path.resolve(__dirname, "src");
// 样式文件输出目录
const cssOutputDir = path.join(projectRoot, "css");

// 创建 CSS 输出目录（如果不存在）
if (!fs.existsSync(cssOutputDir)) {
  fs.mkdirSync(cssOutputDir, { recursive: true });
}

// 递归遍历目录中的文件
function traverseDirectory(directory, callback) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      traverseDirectory(fullPath, callback);
    } else if (stats.isFile()) {
      callback(fullPath);
    }
  }
}

// 处理 Vue 文件
function processVueFile(filePath) {
  if (!filePath.endsWith(".vue")) return;

  const fileContent = fs.readFileSync(filePath, "utf8");
  const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/g;
  let match;
  let updatedContent = fileContent;
  let styleIndex = 0;

  while ((match = styleRegex.exec(fileContent)) !== null) {
    const attributes = match[1];
    const styleContent = match[2].trim();

    if (!styleContent) continue; // 跳过空的 style 标签

    // 检测是否使用了预处理器
    const langMatch = attributes.match(/lang=["'](.*?)["']/);
    const lang = langMatch ? langMatch[1] : "css"; // 默认 css

    // 生成样式文件名（带后缀）
    const fileName = path.basename(filePath, ".vue");
    const styleFileName = `${fileName}_${styleIndex}.${lang}`;
    const styleFilePath = path.join(cssOutputDir, styleFileName);

    // 写入样式文件
    fs.writeFileSync(styleFilePath, styleContent, "utf8");

    // 替换 Vue 文件中的 <style> 标签为外部样式引入
    const importStatement = `import '@/css/${styleFileName}';`;
    updatedContent = insertImportStatement(updatedContent, importStatement);

    styleIndex++;
  }

  // 如果有改动，更新 Vue 文件
  if (updatedContent !== fileContent) {
    fs.writeFileSync(filePath, updatedContent, "utf8");
    console.log(`Processed: ${filePath}`);
  }
}

// 在 <script> 标签或文件顶部插入 import 语句
function insertImportStatement(fileContent, importStatement) {
  const scriptTagRegex = /<script.*?>/;
  const match = scriptTagRegex.exec(fileContent);

  if (match) {
    // 在 <script> 标签后插入 import 语句
    const insertPosition = match.index + match[0].length;
    return (
      fileContent.slice(0, insertPosition) +
      `\n${importStatement}` +
      fileContent.slice(insertPosition)
    );
  } else {
    // 如果没有 <script> 标签，在文件顶部插入
    return `${importStatement}\n${fileContent}`;
  }
}

// 遍历项目中的所有 Vue 文件
traverseDirectory(projectRoot, processVueFile);

console.log("样式提取完成，所有文件已更新。");

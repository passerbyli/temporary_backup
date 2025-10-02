const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

// 1. 压缩指定目录为zip并添加.png后缀
function zipDirectory(srcDir, outputFilePath, callback) {
  const output = fs.createWriteStream(outputFilePath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    console.log(`Directory ${srcDir} has been zipped to ${outputFilePath}`);
    callback();
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);
  archive.directory(srcDir, false);
  archive.finalize();
}

// 2. 读取manifest.json中的版本号并生成version.json
function createVersionJson(manifestPath, zipFileName, distPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const versionJson = {
    latest_version: manifest.version,
    update_url: `xxxx/${zipFileName}`,
  };
  const versionJsonPath = path.join(distPath, "version.json");
  fs.writeFileSync(
    versionJsonPath,
    JSON.stringify(versionJson, null, 2),
    "utf-8"
  );
  console.log("version.json has been created");
}

// 3. 压缩整个chrome_ex目录
function zipChromeExDirectory(srcDir, outputFilePath) {
  const output = fs.createWriteStream(outputFilePath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    console.log(`Directory ${srcDir} has been zipped to ${outputFilePath}`);
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);
  archive.directory(srcDir, false);
  archive.finalize();
}

// __dirname为当前文件在当前项目的准确路径
const srcDir = path.join(__dirname, "dist", "chrome_ex"); //得到的路径为/dist/chrome_ex
const manifestPath = path.join(srcDir, "manifest.json"); //得到的路径为/dist/chrome_ex/manifest.json
const zipFilePathWithPng = path.join(srcDir, "chrome_ex.zip.png");
const finalZipFilePath = path.join(__dirname, "dist", "chrome_ex.zip");

// 先压缩目录为zip文件并添加.png后缀
zipDirectory(srcDir, zipFilePathWithPng, () => {
  // 读取manifest.json，生成version.json
  createVersionJson(manifestPath, "chrome_ex.zip.png", srcDir);

  // 最后将整个chrome_ex目录压缩为zip文件
  zipChromeExDirectory(srcDir, finalZipFilePath);
});

// cards-index.js

// 1) webpack 构建期收集 cards 目录下所有 <dir>/<dir>.json
const ctx = require.context("../project_card/src/cards", true, /\.json$/);

// 2) keys 就相当于 “manifest”
const manifest = ctx
  .keys()
  .filter((key) => {
    // key: "./my-body-card/my-body-card.json"
    const m = key.match(/^\.\/([^/]+)\/\1\.json$/);
    return !!m;
  })
  .map((key) => key.match(/^\.\/([^/]+)\//)[1]);

// 3) 生成 cards 数组（同步即可；json 已被打包进来）
const cards = manifest.map((name) => {
  const mod = ctx(`./${name}/${name}.json`);
  const schemaJson = mod && mod.default ? mod.default : mod;

  return {
    jsonName: "固定名称",
    entryName: schemaJson.entryName,
    name: schemaJson.name,
    schemaJson,
  };
});

export default cards;

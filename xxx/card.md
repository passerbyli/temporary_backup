既然是 Vue 2 + Webpack，那就别用 fs 了（浏览器里跑不了），最适合的是用 require.context 在构建时扫描目录。

下面是一个可以直接放到 src/common/cards.js 里的实现示例，假设你的目录结构是：
```
src/
  cards/
    my-card1/
      my-card1.json
      my-card1.vue
      index.js    // 默认导出 Vue 组件
    my-card2/
      my-card2.json
      my-card2.vue
      index.js
  common/
    cards.js
```
关键约定：
	•	每个文件夹名 = entry，比如 my-card1
	•	JSON 文件名 = entry + .json，比如 my-card1.json
	•	组件通过同目录下的 index.js 默认导出（export default / module.exports =）。

⸻

src/common/cards.js
```
// src/common/cards.js

// 扫描所有 cards 子目录里的 json 和 index.js
// 注意：这里的 '../cards' 路径是相对本文件所在目录（src/common）来说的
const jsonContext = require.context(
  '../cards',      // 要搜索的目录
  true,            // 是否递归子目录
  /\.json$/        // 匹配所有 json 文件
);

const componentContext = require.context(
  '../cards',
  true,
  /index\.js$/     // 只匹配 index.js 作为入口组件文件
);

function buildCardsData() {
  const manifestsByEntry = {};
  const componentsByEntry = {};

  // 1. 收集所有 manifest(json)
  jsonContext.keys().forEach((key) => {
    // key 形如: "./my-card1/my-card1.json"
    // 解析出 entry 名称：my-card1
    const match = key.match(/^\.\/([^/]+)\/\1\.json$/);
    if (!match) {
      // 如果你的命名不完全按 "文件夹名/文件夹名.json"，可以在这里放宽匹配逻辑
      return;
    }

    const entry = match[1];
    const manifest = jsonContext(key);

    // 有些 loader 会把 json 放在 default 里，这里兼容一下
    manifestsByEntry[entry] = manifest.default || manifest;
  });

  // 2. 收集所有组件（index.js 默认导出）
  componentContext.keys().forEach((key) => {
    // key 形如: "./my-card1/index.js"
    const match = key.match(/^\.\/([^/]+)\/index\.js$/);
    if (!match) return;

    const entry = match[1];
    const mod = componentContext(key);
    const component = mod.default || mod;

    componentsByEntry[entry] = component;
  });

  // 3. 合并成 cardsData 数组
  const cardsData = [];

  Object.keys(manifestsByEntry).forEach((entry) => {
    const manifest = manifestsByEntry[entry];
    const component = componentsByEntry[entry];

    if (!component) {
      // 没找到组件就跳过，也可以选择抛错，看你项目需求
      if (process.env.NODE_ENV !== 'production') {
        // 只在开发环境提示
        // eslint-disable-next-line no-console
        console.warn(`[cards] entry "${entry}" 找到 json 但未找到 index.js 组件`);
      }
      return;
    }

    cardsData.push({
      title: manifest.title || '',
      description: manifest.description || '',
      component,
      entry,
      manifest
    });
  });

  return cardsData;
}

// 在模块加载时就构建一次
const cardsData = buildCardsData();

// CommonJS 导出（适配 Vue2 + Webpack 项目）
module.exports = {
  cardsData
};
```

⸻

在项目里怎么用？

比如在某个页面 / 组件里：
```
// 注意路径按你自己的项目来写
import { cardsData } from '@/common/cards';

export default {
  name: 'CardsPage',
  data() {
    return {
      cardsData
    };
  }
};
```
模板里：
```
<div>
  <div
    v-for="card in cardsData"
    :key="card.entry"
    class="card-item"
  >
    <h3>{{ card.title }}</h3>
    <p>{{ card.description }}</p>
    <!-- 动态渲染对应组件 -->
    <component :is="card.component" />
  </div>
</div>
```

⸻

每个卡片目录的 index.js 示例

给你一个标准写法（Vue 2）：
```
// src/cards/my-card1/index.js
import MyCard1 from './my-card1.vue';

export default MyCard1;
```

⸻

如果你有一些卡片的命名不完全符合“文件夹名 = json 文件前缀”的规则，我可以帮你改一下正则或逻辑，让它更宽松一点。
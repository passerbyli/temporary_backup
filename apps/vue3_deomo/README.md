# vue3_deomo

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Compile and Minify for Production

```sh
pnpm build
```


npm i -D webpack-bundle-analyzer
```
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

plugins: [
  new BundleAnalyzerPlugin({
    analyzerMode: 'static',
    openAnalyzer: false,
  }),
]
```

///////
要系统地找出 公共 JS 里没用的函数/方法、以及 Vue 文件里没用的代码，在 Webpack 项目里最好走“两条线并行”：
	1.	静态分析（最靠谱/最省心）：ESLint + TypeScript(可选) + deadcode 工具
	2.	构建/运行时证据（更“实锤”）：bundle analyzer + 覆盖率（coverage）+ sourcemap explorer

你项目“不用 TS”，也完全能做出很好的效果。下面给你一套可落地方案。

⸻

一、JS/模块级：找“从未被 import/require 的文件” & “导出从未被使用的符号”

1) 先用 eslint-plugin-import 检查未使用导入 & 解析路径

安装：

npm i -D eslint eslint-plugin-import eslint-plugin-unused-imports

.eslintrc.js 示例（核心规则）：

module.exports = {
  env: { browser: true, node: true, es2021: true },
  extends: ["eslint:recommended"],
  plugins: ["import", "unused-imports"],
  rules: {
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "import/no-unresolved": "off",
  },
};

效果：
	•	能抓出大量 没用的 import、没用的变量/函数
	•	但：对“导出但没人用”的识别有限（需要下一个工具）

⸻

2) 用 ts-prune/knip 这类做“未使用导出”检测（推荐 knip）

不用 TS 也可以用 knip，它能扫描 import/export 关系并找：
	•	未使用的 exports
	•	未引用的文件
	•	未用的依赖

安装：

npm i -D knip

package.json 加：

{
  "scripts": {
    "knip": "knip"
  }
}

然后建 knip.json（适配 Vue + webpack alias）：

{
  "entry": ["src/main.js"],
  "project": ["src/**/*.{js,vue}"],
  "ignore": ["**/*.test.*", "**/__tests__/**"],
  "webpack": {
    "config": "webpack.config.js"
  }
}

运行：

npm run knip

它会输出：
	•	Unused files（没被引用的文件）
	•	Unused exports（导出但没人用的函数/常量/组件）
	•	Unused dependencies（package.json 里装了但没用）

如果你用的是 vue-cli，webpack 配置文件路径可能不是 webpack.config.js，那就去掉 webpack 配置项，用 aliases 手动写也行。

⸻

二、函数/方法级：公共 JS 里“声明了但从未被调用”

这类分两种：

A) 模块导出没被使用（最容易删）

用 knip/ts-prune 这种即可（上面已经覆盖）。

B) 同一个模块内部有函数没被调用（更 tricky）

ESLint 可以抓到一部分（no-unused-vars），但如果是“函数被声明了、但只在运行时字符串调用/反射调用”，静态分析会不准。

推荐补一个更“实锤”的方式：Coverage（覆盖率）

⸻

三、Vue 文件里“没用的代码/没用的组件/没用的变量”

1) ESLint + vue 插件（抓 template/script 的 unused）

安装：

npm i -D eslint eslint-plugin-vue

.eslintrc.js 增加：

module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:vue/vue3-recommended"
  ],
  plugins: ["vue", "unused-imports"],
  rules: {
    "vue/no-unused-components": "warn",
    "vue/no-unused-vars": "warn",
    "unused-imports/no-unused-imports": "error",
  },
};

它能抓：
	•	Vue 组件注册了但 template 没用（no-unused-components）
	•	template/script 变量没用（vue/no-unused-vars）
	•	import 没用（unused-imports）

⸻

2) Vue SFC 内“methods 没被用”
	•	如果 methods 只在 template 里调用，ESLint + vue 规则能抓一部分
	•	但如果是 $refs、事件总线、动态字符串调用，静态分析难免漏/误报

所以我建议你对“要删的”最终都用 coverage 再确认一次。

⸻

四、最强“实锤”：用 Coverage 找运行时从未执行的代码（推荐）

思路：
	•	让生产构建/或测试跑一遍你们核心路径
	•	看覆盖率报告中哪些文件/行/函数从未执行
	•	这些就是最高优先级的删减目标（尤其公共 utils）

工具选择：
	•	如果你有单测：用 Jest + babel-jest 或 Vitest（但你是 webpack 项目，Jest 更常见）
	•	如果你没单测：也可以用 cypress 或 playwright 跑一遍关键页面，生成 coverage

最轻量路线（没有测试也能跑）：
	•	用 babel-plugin-istanbul 给构建插桩（instrument）
	•	用 e2e 跑关键路由
	•	生成 coverage 报告

（这套接入稍复杂，你如果愿意贴一下你项目是 vue-cli 还是自建 webpack，我可以给你精确配置。）

⸻

五、构建产物维度：找“打进来了但没用”的代码（Tree Shaking/sideEffects）

你可以用：

1) webpack-bundle-analyzer

看哪些模块占体积，是否有大量“重复或用不到”的模块被打进来。

2) source-map-explorer

更直观定位到某个文件里哪段代码进包了。

⸻

六、一个实用的执行顺序（不会走弯路）
	1.	✅ 先上 ESLint（unused-imports + vue 插件）
当天就能删一批无用 import/变量/组件注册
	2.	✅ 再跑 knip
找“未引用文件/未使用导出”，这是最适合清理公共 utils 的
	3.	✅ 对“你准备删除的公共函数/模块”，最后用 coverage 验证一下
避免误删（尤其是字符串调用/运行时动态引用）

⸻

你现在就能做的最小落地

如果你只想最快看到结果，先做这两步：

npm i -D eslint eslint-plugin-vue eslint-plugin-import eslint-plugin-unused-imports knip

然后：
	•	配 ESLint 跑一遍
	•	npm run knip 看 unused exports/files

⸻

如果你把这些信息贴一下，我可以给你一份“直接复制就能跑”的配置（避免你踩 alias/webpack 解析坑）：
	1.	你是 vue-cli 还是 自建 webpack？（有没有 vue.config.js）
	2.	你们 alias 怎么写的（比如 @ -> src）？
	3.	是否大量用 require.context / 动态 import 路径（这会影响 knip 精度）


//////////



下面这套方法能把 CSS/LESS 里的无效代码（未被使用的选择器、重复样式、过大样式）和 静态资源（图片/字体等）未被引用 一网打尽。你是 Webpack 项目、不用 TS，也完全适用。

⸻

1) CSS/LESS：找“未使用的选择器/样式”——PurgeCSS（最常用、见效快）

✅ 适用场景
	•	你有大量全局 CSS/LESS（特别是后台项目）
	•	打包后 app.css 很大
	•	想删除“页面里根本没用到的 class/selector”

vue-cli 项目（推荐用 postcss 插件方式）

安装：

npm i -D @fullhuman/postcss-purgecss

在 postcss.config.js（没有就新建）加：

const purgecss = require("@fullhuman/postcss-purgecss");

module.exports = {
  plugins: [
    purgecss({
      content: [
        "./public/index.html",
        "./src/**/*.vue",
        "./src/**/*.js",
      ],
      // 关键：Element Plus / 动态 class 要加 safelist
      safelist: [
        /^el-/,
        /^is-/,
        /^has-/,
        "active",
      ],
      defaultExtractor: (content) =>
        content.match(/[\w-/:]+(?<!:)/g) || [],
    }),
  ],
};

⚠️ 注意：
	•	PurgeCSS 会误删“运行时拼出来的 class”（比如 :class="xxx ? 'a' : 'b'" 没问题，但 :class="someVar" 或 el-xxx 这种需要 safelist）
	•	建议只对 生产环境启用（避免开发时样式丢失）：

const isProd = process.env.NODE_ENV === "production";
module.exports = {
  plugins: isProd ? [purgecss(/*...*/)] : [],
};


⸻

2) CSS/LESS：检查“无效/重复/低质量写法”——stylelint + stylelint-order

✅ 能抓什么
	•	重复规则、无效属性、拼写错误
	•	冲突顺序（比如写了一堆不规范的属性顺序）
	•	CSS 里压根没用的变量/混入（对 less/scss 也能部分提示）

安装：

npm i -D stylelint stylelint-config-standard stylelint-config-recommended-vue stylelint-order

新建 .stylelintrc.cjs：

module.exports = {
  extends: [
    "stylelint-config-standard",
    "stylelint-config-recommended-vue",
  ],
  plugins: ["stylelint-order"],
  rules: {
    "order/properties-alphabetical-order": true,
  },
};

跑：

npx stylelint "src/**/*.{vue,css,less}" --fix


⸻

3) 运行时实锤：Coverage 找“页面从未用到的 CSS”（Chrome DevTools）

这是最“实锤”的：不是猜，是看浏览器实际执行。

步骤：
	1.	打开你项目（开发/测试环境）
	2.	Chrome DevTools → Ctrl+Shift+P 搜索 Coverage
	3.	点击录制，完整操作一遍核心页面
	4.	停止录制，看哪些 CSS 文件里 Unused % 很高
	5.	优先清理这些文件或拆分成按需加载

优点：不会误判动态 class，因为它是运行时统计。

⸻

4) 静态资源（图片/字体等）：找“未引用的文件”——knip / unused-files / unimported

✅ 推荐：knip（你前面也在用）

knip 也能找未引用资源（前提是你是通过 import/require 引入的资源）。

如果你的图片是这样引用的：

import logo from "@/assets/logo.png";

或在 CSS 里：

background: url("~@/assets/a.png");

knip 往往能查出来（但对某些 loader 写法可能漏）。

⸻

✅ 更直接：unimported（扫“src 里从未被引用的文件”）

安装：

npm i -D unimported

执行：

npx unimported

它会列：
	•	unused files（可能包含 assets）
	•	unused dependencies

如果你大量图片是 “直接写字符串路径” 或 “后端返回路径”，这类工具可能识别不到，需要下一条。

⸻

5) 最保险：对 assets 做“目录级别的引用扫描”

如果你们大量是这种引用：
	•	Vue template: <img src="/static/xxx.png">
	•	CSS: url('/img/xxx.png')
	•	JS: 字符串拼路径

那就做一个“全项目 grep 扫描”的脚本：

脚本思路
	•	遍历 src/assets 或 public 下所有图片
	•	在 src/**/*.vue|js|css|less 里搜索文件名
	•	没出现的就是疑似未使用

你要的话我可以给你一份 Node 脚本（几分钟跑完，输出一份未引用清单），并且支持：
	•	忽略 favicon、默认占位图
	•	忽略后端动态传参/白名单

⸻

6) 图片体积优化（不是“无效”，但强烈建议）

(1) 找大图：webpack 插件统计

用 webpack-bundle-analyzer 或 source-map-explorer 看图片是否进包、占体积。

(2) 压缩图片：image-minimizer-webpack-plugin（生产）

安装：

npm i -D image-minimizer-webpack-plugin imagemin imagemin-mozjpeg imagemin-pngquant imagemin-svgo

配置（大概结构）：

const ImageMinimizerPlugin = require("image-minimizer-webpack-plugin");

optimization: {
  minimizer: [
    new ImageMinimizerPlugin({
      minimizer: {
        implementation: ImageMinimizerPlugin.imageminGenerate,
        options: {
          plugins: [
            ["mozjpeg", { quality: 75 }],
            ["pngquant", { quality: [0.65, 0.8] }],
            ["svgo"],
          ],
        },
      },
    }),
  ],
},


⸻

建议你按这个顺序做（最省心）
	1.	Coverage 看哪些 CSS 真的没用（最实锤）
	2.	上 PurgeCSS 做生产环境清理（收益最大）
	3.	上 stylelint 做规范/重复/错误清理
	4.	用 unimported/knip +（必要时）目录扫描脚本清理静态资源
	5.	最后加图片压缩（体积收益）

⸻

如果你告诉我两点，我可以给你一份“直接复制到你项目就能跑”的配置（包含 safelist，不会把 element-plus 样式删炸）：
	1.	你是 vue-cli 还是 自建 webpack？（有没有 vue.config.js）
	2.	你们样式主要是 全局 less 还是 大量 scoped？（scoped 通常 PurgeCSS收益小一些）





////  

在 Windows + VSCode 上批量处理 deep，最稳的是用 全局正则替换（不用装工具、也不用命令行）。按下面顺序做，基本能覆盖项目里 90%+ 的旧写法。

目标统一成：:deep(...)（Vue3 推荐写法）

⸻

0) 先全局查一遍
	1.	VSCode 按 Ctrl + Shift + F
	2.	勾选 .*（正则）
	3.	查找：

>>>|/deep/|::v-deep|:deep\s


⸻

1) 替换 ::v-deep( → :deep(

查找（正则）

::v-deep\s*\(

替换为

:deep(


⸻

2) 替换 ::v-deep .xxx { → :deep(.xxx) {

适配 .vue 的 <style scoped>、.less、嵌套写法里常见的：

查找（正则）

::v-deep\s+([^{;]+?)\s*\{

替换为

:deep($1) {

说明：$1 是 ::v-deep 后面的选择器部分，比如 .el-input__inner 或 .a .b

⸻

3) 替换 >>> 组合器

把：

.a >>> .b { ... }

改成：

.a :deep(.b) { ... }

查找（正则）

\s>>>\s+([^{;]+?)(\s*\{)

替换为

 :deep($1)$2


⸻

4) 替换 /deep/ 组合器

把：

.a /deep/ .b { ... }

改成：

.a :deep(.b) { ... }

查找（正则）

\s\/deep\/\s+([^{;]+?)(\s*\{)

替换为

 :deep($1)$2


⸻

5) 再查一次，看看有没有残留

全局搜索：

>>>|/deep/|::v-deep

剩下的一般是“非常规写法”（比如换行、逗号选择器、注释夹在中间），手改几处即可。

⸻

6) 改完后的推荐写法示例（Vue3）

✅ 推荐：

.wrapper {
  :deep(.el-input__inner) {
    color: red;
  }
}

✅ 也可以：

.wrapper :deep(.a .b) { }


⸻

常见坑（你遇到就按这个修）

1) 多选择器逗号

如果你有：

::v-deep .a, ::v-deep .b { ... }

上面的替换可能只改到一半，建议先把这种手动改为：

:deep(.a), :deep(.b) { ... }

2) :deep .xxx 空格写法

如果你项目里有人写了：

:deep .xxx { ... }

也建议改成：

:deep(.xxx) { ... }


⸻

如果你把 你项目里最常见的 3~5 条 deep 写法（包含 less 嵌套、逗号选择器那种）贴出来，我可以把上面的正则再“定制化”，做到一次替换几乎不需要手工补刀。
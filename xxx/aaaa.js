// vue.config.js
module.exports = {
  configureWebpack: {
    resolve: {
      alias: {
        // 强制使用 ESM 版本，避免走 UMD 的 marked.umd.js
        'marked$': 'marked/lib/marked.esm.js'
      }
    }
  }
}



OK，我给你做 完整的 Markdown 代码高亮解决方案（适用于 Vue2 + marked@1.x），并且不会破坏你现有的流式输出逻辑，只需要增加几行代码即可。

目标：

✔ 输出区域使用 marked 渲染
✔ pre > code 自动高亮
✔ 支持多语言（js / json / html / vue / java / sql …）
✔ 支持流式逐段追加 Markdown 内容（不会闪屏）
✔ 样式清爽、不会太花

下面是可直接复制使用的配置（你当前的组件里能无缝加入）。

⸻

✅ 第一步：安装 highlight.js

如果项目还没装，执行：

npm install highlight.js


⸻

✅ 第二步：在组件中引入 highlight.js + marked 配置代码高亮

在 <script> 顶部加入：

import marked from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'  // 可换成你喜欢的主题

默认使用 github.css 风格，清爽、简洁，最适合业务系统页。
如果你想换成黑色主题，我也可以给你推荐更 AI 风格的样式。

⸻

✅ 第三步：配置 marked（必须在组件初始化时执行一次）

在 export default {} 外或者内部 created() 执行以下配置：

marked.setOptions({
  breaks: true, // 换行更自然
  gfm: true,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  }
})

你可以放在 created()：

created() {
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    }
  })
}

确保只初始化一次。

⸻

🔥 第四步：你的流式输出无需修改

你之前的渲染是：

renderedMarkdown() {
  return marked(this.outputMarkdown || '')
}

继续保持就行。

高亮后的 HTML 会自动应用 CSS。

⸻

🎨 第五步：给高亮区域一点圆角 + 不那么呆板的样式

在 <style scoped> 加上：

.markdown-body pre code {
  border-radius: 6px;
  padding: 0 !important;
}

.markdown-body pre {
  border-radius: 6px;
  overflow-x: auto;
}

.markdown-body code {
  border-radius: 4px;
  padding: 2px 4px;
}

如果你喜欢暗色高亮，我可以直接给你：

import 'highlight.js/styles/atom-one-dark.css'

非常 AI + 工程师风格。

⸻

📌 最终效果（示例）

你的大模型返回：

data:{"result":{"content":"下面是示例：\n```js\nconsole.log('Hello');\n```"}}

最后会自动渲染成带高亮的：

console.log('Hello')

没有闪烁、不卡顿、不会破坏流式输出。

⸻

🚀 如需更强的效果（可选升级）

如果你想进一步增强：

功能	可做吗？
支持代码块显示语言标签（JavaScript、SQL 等）	✔
行号	✔
支持复制代码块（独立 copy 按钮）	✔
支持主题切换（明亮 / 暗黑）	✔
支持 “展开/折叠” 大段代码	✔
自动识别并格式化 JSON 代码块	✔

我可以帮你扩展。

⸻

👇 要不要我继续帮你做“代码块复制按钮 + 行号”？

只需加几行即可，非常适合你的 AI 输出页面。
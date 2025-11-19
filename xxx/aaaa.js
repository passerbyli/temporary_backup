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





明白，既然你这页主要是做分析报告类文档，而不是技术文档/代码展示，那高亮风格就应该是：
	•	以正文可读性为主（像报告/文章）
	•	代码块只是“点缀”，不要喧宾夺主
	•	整体排版更像一份「分析报告」而不是 IDE

我帮你在现有组件的基础上补充一套更适合“报告类”的配置，你只需要按下面几步改一下即可，不用重写整页。

⸻

1. <script> 部分：引入 highlight.js 并配置 marked

在你组件顶部（现在已经有 import marked from 'marked' 的位置）改成这样：

import marked from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css' // 报告风格、清爽

然后在组件里加一个 created()（如果已经有，就把 setOptions 写进去）：

export default {
  name: 'LLMStreamDemo',
  // ... data / computed / methods 省略

  created() {
    marked.setOptions({
      gfm: true,
      breaks: true, // 换行更自然，适合报告类
      highlight: (code, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value
        }
        return hljs.highlightAuto(code).value
      }
    })
  },

  // 原有 beforeDestroy 等保持不变
}

✅ 你的 renderedMarkdown 计算属性可以保持不变：

renderedMarkdown() {
  return marked(this.outputMarkdown || '')
}


⸻

2. Markdown 样式：更偏“分析报告”

在你现有的 <style scoped> 里，把和 .markdown-body 相关的部分改成下面这一套（保留上面的布局样式，比如 .output-scroll、.metrics 等）：

.markdown-body {
  font-size: 14px;
  line-height: 1.8;
  color: #1f2933;
}

/* 标题层级清晰一点，像报告的小节 */
.markdown-body h1 {
  font-size: 20px;
  margin: 12px 0 8px;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 4px;
}
.markdown-body h2 {
  font-size: 18px;
  margin: 12px 0 6px;
  font-weight: 600;
}
.markdown-body h3 {
  font-size: 16px;
  margin: 10px 0 4px;
  font-weight: 600;
}

/* 段落 & 列表，更像文档 */
.markdown-body p {
  margin: 6px 0;
}
.markdown-body ul,
.markdown-body ol {
  padding-left: 22px;
  margin: 4px 0 6px;
}
.markdown-body li {
  margin: 2px 0;
}

/* 引用区，适合总结 / 注意事项 */
.markdown-body blockquote {
  margin: 8px 0;
  padding: 6px 10px;
  border-left: 3px solid #d0e2ff;
  background: #f7f9ff;
  color: #4b5563;
  border-radius: 4px;
}

/* 行内代码 - 不突兀 */
.markdown-body code {
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  background: #f3f4f6;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 13px;
}

/* 代码块 - 使用 highlight.js 的主题，外面稍微做个容器 */
.markdown-body pre {
  margin: 8px 0;
  padding: 0;              /* 交给主题内的 code 处理 */
  background: transparent; /* 避免和主题背景冲突 */
  border-radius: 6px;
  overflow-x: auto;
}
.markdown-body pre code {
  display: block;
  padding: 10px 12px !important;
  border-radius: 6px;
  font-size: 13px;
}

/* 表格（如果模型生成表格） */
.markdown-body table {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
  font-size: 13px;
}
.markdown-body th,
.markdown-body td {
  border: 1px solid #e5e7eb;
  padding: 6px 8px;
}
.markdown-body th {
  background: #f3f4f6;
  font-weight: 600;
}

这套样式的效果是：

整体看起来像一份排版比较好的分析报告：
	•	标题层级清晰
	•	列表、引用区域看着很清楚
	•	代码块有高亮，但不会压过正文

⸻

3. 输出区域配合“报告感”的小优化（可选）

如果想让报告看起来更舒服一点，可以稍微调整一下 .output-scroll 的字体和背景：

.output-scroll {
  height: 260px;
  overflow-y: auto;
  background: #ffffff;
  border-radius: 8px;
  padding: 12px;
  position: relative;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 滚动条保持之前细窄样式即可 */
.output-scroll::-webkit-scrollbar {
  width: 6px;
}
.output-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.18);
  border-radius: 999px;
}
.output-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}


⸻

4. 模型生成“报告文档”的提示（给你后面接入时参考）

既然主要是分析报告类，你在调用大模型时可以：
	•	用 系统 prompt 要求模型：
	•	一级标题用 ## 总结，## 原因分析，## 建议 等
	•	用列表列出关键点
	•	需要强调的用 **加粗**
	•	以「结论→原因→建议」的结构输出

这样你的渲染层不用动，报告结构自然就会很好看。

⸻

如果你之后想：
	•	添加「目录」（根据 h2/h3 动态生成侧边导航）
	•	支持“折叠某个章节”（长文的时候很好用）
	•	支持导出 Markdown / PDF

也可以在这套基础上再堆一层，我可以帮你把“报告查看器”做成一个可复用的组件。


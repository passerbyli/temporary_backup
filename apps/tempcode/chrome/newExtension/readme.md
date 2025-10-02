# 浏览器插件开发

## 学习资料

- **官方文档**：[Chrome 扩展开发文档](https://developer.chrome.com/docs/extensions?hl=zh-cn)
- **示例仓库**：[GitHub Chrome 扩展示例](https://github.com/GoogleChrome/chrome-extensions-samples)

- [Chrome 扩展程序](https://developer.chrome.com/docs/extensions/)
- [Chrome 扩展程序 API 参考](https://developer.chrome.com/docs/extensions/reference/)
- [Chrome 扩展程序示例](https://developer.chrome.com/docs/extensions/samples/)
- [Chrome 扩展程序开发](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome 扩展程序开发文档](https://developer.chrome.com/docs/extensions/mv3/overview/)
- [Chrome 扩展程序开发示例](https://developer.chrome.com/docs/extensions/mv3/getstarted/)
- [Chrome 扩展程序开发 API](https://developer.chrome.com/docs/extensions/reference/)
- [Chrome 扩展程序开发 API 示例](https://developer.chrome.com/docs/extensions/samples/)

## Chrome 插件目录结构

```
my-chrome-extension/
├── manifest.json 配置文件。必须
├── background.js 插件后台运行脚本。必须
├── content.js 插件内容脚本。必须
├── popup.html 插件弹出窗口HTML文件。可选
├── popup.js 插件弹出窗口脚本。可选
├── inject.js 插件注入脚本。可选
├── inject.html 插件注入HTML文件。可选
├── options.html 插件选项页面HTML文件。可选
├── options.js 插件选项页面脚本。可选
├── devtools.html 插件开发者工具HTML文件。可选
├── devtools.js 插件开发者工具脚本。可选
├── icons/
│   ├── icon16.png 插件图标16x16
│   ├── icon32.png 插件图标32x32
│   ├── icon48.png 插件图标48x48
│   └── icon128.png 插件图标128x128
└── styles/
    └── popup.css 插件弹出窗口样式。可选
    └── inject.css 插件注入样式。可选
```

## Chrome 插件核心概念

1. **后台运行脚本**
   `background.js`，插件在后台运行的脚本，用于处理事件和数据。常驻后台。可以监听和处理浏览器事件，例如页面加载，标签切换，网络请求等。
   - 处理消息传递
     通常充当与各个组件的桥梁，协调它们之间的交互。
     与内容脚本进行交互。可以使用`chrome.runtime.onMessage`和`chrome.runtime.sendMessage`接收和发送消息，可与内容脚本，popup,options 进行交互。
     可拦截和修改网络请求。例如监听，阻止，修改请求头或相应。
     可检测插件首次安装，更新等事件。
2. **内容脚本**
   `content.js`，插件在页面加载时注入的脚本，用于操作页面元素和数据。只能访问 Dom，和页面的 js 环境是隔离的，不能相互访问。
3. **inject.js**
   `inject.js`，插件在页面加载时注入的脚本，用于操作页面元素和数据。
4. **弹出窗口**
   `popup.html`、`popup.js`，插件弹出的窗口，用于展示插件功能和数据。运行在黑盒环境，不能访问插件的 js 环境。
5. **选项页面**
   `options.html`、`options.js`，插件选项页面，用于配置插件功能。运行在黑盒环境，不能访问插件的 js 环境。
6. **消息传递**
   插件与页面之间的消息传递，用于插件与页面之间的交互。
   正式由于沙箱机制的处理，Chrome 扩展的不同组件运行在独立的上下文中，彼此权限不同：

| 组件                                        | 权限范围                                                                                                                            |
| :------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------- |
| **内容脚本（Content Scripts）**             | - 可以访问当前网页的 DOM，但**无法直接调用敏感浏览器 API**（如 `chrome.tabs`）。 - 需通过消息传递与后台脚本（Service Worker）通信。 |
| **后台脚本（Service Worker）**              | - 可以调用浏览器 API（如操作标签页、书签、存储数据），但**无法直接访问网页 DOM**。 - 不持久化运行，仅在事件触发时激活。             |
| **弹出页（Popup）或选项页（Options Page）** | - 普通网页环境，默认**无法直接访问浏览器 API**，需通过 `chrome.runtime` API 与后台通信。                                            |

## 消息传递

|                   | popup.js                   | background.js              | content.js         | inject.js          |
| ----------------- | -------------------------- | -------------------------- | ------------------ | ------------------ |
| **popup.js**      |                            | chrome.runtime.sendMessage |                    |                    |
| **background.js** | chrome.runtime.sendMessage |                            | sendResponse       |                    |
| **content.js**    |                            | chrome.tab.sendMessage     |                    | window.postMessage |
| **inject.js**     |                            |                            | window.postMessage |                    |

1. 一次性的简单消息发送&接收
   发送 API 有：
   - `chrome.runtime.sendMessage`：广播消息，各个组件都可以监听。
   - `chrome.tabs.sendMessage`：发送消息到当前标签页的内容脚本。
2. 接收消息的 API

```js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // 处理消息
  if (request.action === 'getData') {
    // 发送数据给页面
    sendResponse({ data: '插件返回的数据' })
  }
})
```

// content.js

// ===========================
// 注入 inject-graph.js 到页面上下文
// ===========================
;(function injectGraphBridge() {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('inject-graph.js')
  script.onload = () => script.remove()
  document.documentElement.appendChild(script)
})()

// ===========================
// 注入样式文件
// ===========================
function injectStyle(filePath) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = chrome.runtime.getURL(filePath)
  document.head.appendChild(link)
}
injectStyle('sidebar/panel.css')

// ===========================
// 与 inject-graph 通信工具函数
// ===========================
function invokeGraph(action, params = {}) {
  const requestId = `${action}_${Date.now()}`
  window.postMessage({ type: 'INVOKE_GRAPH_API', requestId, action, params }, '*')
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      const { type, requestId: rid, result, error } = event.data || {}
      if (type === 'GRAPH_API_RESULT' && rid === requestId) {
        window.removeEventListener('message', handler)
        error ? reject(error) : resolve(result)
      }
    }
    window.addEventListener('message', handler)
  })
}

// ===========================
// 快捷键：Command+X 显示/关闭面板
// ===========================
window.addEventListener('keydown', (e) => {
  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const isCommandX = (isMac && e.metaKey && e.key === 'x') || (!isMac && e.ctrlKey && e.key === 'x')
  if (isCommandX) {
    e.preventDefault()
    const panel = document.getElementById('x6-floating-panel')
    if (panel) {
      panel.remove()
    } else {
      createFloatingPanel()
    }
  }

  window.graphClient.getAllNodes().then((nodes) => {
    console.log('所有节点：', nodes)
  })
})

// ===========================
// 创建悬浮面板（可拖动）
// ===========================
function createFloatingPanel() {
  if (document.getElementById('x6-floating-panel')) return

  const wrapper = document.createElement('div')
  wrapper.innerHTML = `
      <div id="x6-floating-panel">
        <div id="x6-floating-panel-header">🧩 X6 节点面板</div>
        <div id="x6-floating-panel-body">加载中...</div>
        <button id="x6-panel-toggle">➖</button>
      </div>
      <button id="x6-panel-mini-icon" style="display: none">📋</button>
    `
  document.body.appendChild(wrapper)

  enablePanelDrag()
  setupPanelActions()
  loadNodeList()
}

function enablePanelDrag() {
  const panel = document.getElementById('x6-floating-panel')
  const header = document.getElementById('x6-floating-panel-header')
  let offsetX = 0,
    offsetY = 0

  header.addEventListener('mousedown', (e) => {
    offsetX = e.clientX - panel.offsetLeft
    offsetY = e.clientY - panel.offsetTop

    function onMove(e) {
      panel.style.left = e.clientX - offsetX + 'px'
      panel.style.top = e.clientY - offsetY + 'px'
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
}

function setupPanelActions() {
  document.getElementById('x6-panel-toggle').addEventListener('click', () => {
    document.getElementById('x6-floating-panel').style.display = 'none'
    document.getElementById('x6-panel-mini-icon').style.display = 'block'
  })
  document.getElementById('x6-panel-mini-icon').addEventListener('click', () => {
    document.getElementById('x6-floating-panel').style.display = 'block'
    document.getElementById('x6-panel-mini-icon').style.display = 'none'
  })
}

// ===========================
// 加载节点信息列表
// ===========================
async function loadNodeList() {
  const body = document.getElementById('x6-floating-panel-body')
  body.innerHTML = '加载中...'
  try {
    const nodes = await invokeGraph('getAllNodeInfo')
    body.innerHTML = ''
    nodes.forEach((node) => {
      const div = document.createElement('div')
      div.className = 'x6-node-item'
      div.innerHTML = `
          <strong>${node.id}</strong> - ${node.label || ''}
          <span>
            <button data-id="${node.id}" data-action="jump">🎯</button>
            <button data-id="${node.id}" data-action="delete">❌</button>
          </span>
        `
      body.appendChild(div)
    })
  } catch (e) {
    body.innerHTML = '加载失败：' + e
  }
}

// ===========================
// 节点操作按钮：跳转/删除
// ===========================
document.addEventListener('click', async (e) => {
  if (e.target.tagName !== 'BUTTON') return
  const id = e.target.dataset.id
  const action = e.target.dataset.action
  if (!id || !action) return

  if (action === 'delete') {
    // await invokeGraph('removeNode', { id })
    window.graphClient.removeNode(id)
    await loadNodeList()
  } else if (action === 'jump') {
    // await invokeGraph('centerNode', { id })
    window.graphClient.centerNode(id)

  }
})

// ===========================
// 悬停节点信息浮窗
// ===========================
function injectHoverPanel() {
  if (document.getElementById('x6-hover-panel')) return
  const panel = document.createElement('div')
  panel.id = 'x6-hover-panel'
  panel.innerHTML = `
      <strong>悬停节点信息</strong>
      <pre id="hover-data" style="white-space: pre-wrap; margin-top: 6px;"></pre>
    `
  document.body.appendChild(panel)
}

function listenHoverMessage() {
  window.addEventListener('message', (event) => {
    const data = event.data || {}
    if (data.type === 'GRAPH_CUSTOM_EVENT' && data.eventName === 'node:hover') {
      const pre = document.getElementById('hover-data')
      if (pre) {
        pre.textContent = JSON.stringify(data.payload, null, 2)
      }
    }
  })
}
injectHoverPanel()
listenHoverMessage()

// ===========================
// 💡 支持来自 popup 的通信请求
// ===========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GRAPH_CALL') {
    const { action, params } = message
    const requestId = `${action}_${Date.now()}`

    const handler = (event) => {
      const { type, requestId: rid, result, error } = event.data || {}
      if (type === 'GRAPH_API_RESULT' && rid === requestId) {
        window.removeEventListener('message', handler)
        sendResponse({ result, error })
      }
    }

    window.addEventListener('message', handler)
    window.postMessage({ type: 'INVOKE_GRAPH_API', requestId, action, params }, '*')

    return true
  }
})

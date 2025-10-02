// ===========================
// popup.js
// ===========================



// 发送请求到 content.js -> inject-graph.js
async function invokeGraphFromPopup(action, params) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || !tab.id) throw new Error('未找到活动页面标签')

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { type: 'GRAPH_CALL', action, params }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('lastError', chrome.runtime.lastError) // ✅ 打印具体错误
        reject(new Error('通信失败: ' + chrome.runtime.lastError.message))
      } else if (response?.error) {
        reject(new Error('❌ ' + response.error))
      } else {
        resolve(response.result)
      }
    })
  })
}

// 绑定按钮点击事件
async function onRunClick() {
  const action = document.getElementById('action').value.trim()
  const nodeId = document.getElementById('nodeId').value.trim()
  const label = document.getElementById('label').value.trim()
  const resultEl = document.getElementById('result')

  const params = {}
  if (nodeId) params.id = nodeId
  if (label) params.label = label

  resultEl.textContent = '执行中...'

  try {
    const result = await invokeGraphFromPopup(action, params)
    resultEl.textContent = '✅ ' + JSON.stringify(result, null, 2)
  } catch (err) {
    resultEl.textContent = err.message
  }
}

// 初始化绑定
function initPopupUI() {
  document.getElementById('run').addEventListener('click', onRunClick)
}

document.addEventListener('DOMContentLoaded', initPopupUI)

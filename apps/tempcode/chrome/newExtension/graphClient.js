// graphClient.js
// 通用封装：content.js / popup.js / panel 等均可调用

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

function listenGraphCustomEvent(eventName, callback) {
  window.addEventListener('message', (event) => {
    const data = event.data || {}
    if (data.type === 'GRAPH_CUSTOM_EVENT' && data.eventName === eventName) {
      callback?.(data.payload)
    }
  })
}

// 示例：快速调用
async function getAllNodes() {
  return await invokeGraph('getAllNodeInfo')
}

async function getNodeById(id) {
  return await invokeGraph('getNodeInfo', { id })
}

async function centerNode(id) {
  return await invokeGraph('centerNode', { id })
}

async function highlightNode(id) {
  return await invokeGraph('highlightNode', { id })
}

async function removeNode(id) {
  return await invokeGraph('removeNode', { id })
}

async function updateNodeLabel(id, label) {
  return await invokeGraph('updateNodeLabel', { id, label })
}

async function createNode({ id, label, x = 100, y = 100, data = {} }) {
  return await invokeGraph('createNode', { id, label, x, y, data })
}

window.graphClient = {
  invokeGraph,
  listenGraphCustomEvent,
  getAllNodes,
  getNodeById,
  centerNode,
  highlightNode,
  removeNode,
  updateNodeLabel,
  createNode,
}

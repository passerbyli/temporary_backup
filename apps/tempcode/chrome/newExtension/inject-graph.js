// inject-graph.js
// 注入脚本，用于监听来自插件的消息并调用 window.custom_epo_utils（Graph 实例）

;(function () {
  const graph = window.custom_epo_utils

  if (!graph || typeof graph.getCellById !== 'function') {
    console.warn('[inject-graph] custom_epo_utils 未挂载或不是 Graph 实例')
    return
  }

  // ========= 注册 Graph 方法监听器 =========
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return

    const { type, requestId, action, params = {} } = event.data || {}
    if (type !== 'INVOKE_GRAPH_API') return

    let result
    try {
      switch (action) {
        case 'centerNode': {
          const node = graph.getCellById(params.id)
          if (!node) throw new Error(`节点 ${params.id} 不存在`)
          graph.centerCell(node)
          result = true
          break
        }

        case 'getAllNodeInfo': {
          result = graph.getNodes().map((node) => ({
            id: node.id,
            label: node.attrs?.label?.text,
            data: node.getData(),
            position: node.getPosition(),
          }))
          break
        }

        case 'getNodeInfo': {
          const node = graph.getCellById(params.id)
          if (!node) throw new Error(`节点 ${params.id} 不存在`)
          result = {
            id: node.id,
            label: node.attrs?.label?.text,
            data: node.getData(),
            position: node.getPosition(),
            size: node.getSize(),
          }
          break
        }

        case 'createNode': {
          result = graph.addNode({
            id: params.id,
            x: params.x ?? 100,
            y: params.y ?? 100,
            width: 120,
            height: 40,
            shape: 'rect',
            label: params.label || '新节点',
            data: params.data || {},
          })
          break
        }

        case 'removeNode': {
          const node = graph.getCellById(params.id)
          if (!node) throw new Error(`节点 ${params.id} 不存在`)
          graph.removeCell(node)
          result = true
          break
        }

        case 'updateNodeLabel': {
          const node = graph.getCellById(params.id)
          if (!node) throw new Error(`节点 ${params.id} 不存在`)
          node.setAttrs({ label: { text: params.label } })
          result = true
          break
        }

        case 'highlightNode': {
          const node = graph.getCellById(params.id)
          if (!node) throw new Error(`节点 ${params.id} 不存在`)
          node.addTools({ name: 'boundary' })
          result = true
          break
        }

        default:
          throw new Error(`未知操作: ${action}`)
      }

      // 响应结果
      window.postMessage({ type: 'GRAPH_API_RESULT', requestId, result }, '*')
    } catch (err) {
      window.postMessage({ type: 'GRAPH_API_RESULT', requestId, error: err.message }, '*')
    }
  })

  // ========= 节点悬停监听（只注册一次） =========
  if (!graph.__hover_event_attached) {
    graph.__hover_event_attached = true
    graph.on('node:mouseenter', ({ node }) => {
      window.postMessage(
        {
          type: 'GRAPH_CUSTOM_EVENT',
          eventName: 'node:hover',
          payload: {
            id: node.id,
            label: node.attrs?.label?.text || '',
            data: node.getData?.(),
            position: node.getPosition?.(),
          },
        },
        '*'
      )
    })
  }
})()

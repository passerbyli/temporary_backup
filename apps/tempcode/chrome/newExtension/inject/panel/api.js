;(function () {
  window.graphPanelAPI = {
    invokeGraph(action, params = {}) {
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
    },
    getAllNodes() {
      return this.invokeGraph('getAllNodeInfo')
    },
  }
})()

;(function () {
  window.graphPanelEvents = {
    bindPanelEvents() {
      const closeBtn = document.getElementById('x6-panel-close')
      closeBtn.onclick = () => document.getElementById('x6-main-panel')?.remove()

      const tabBtns = document.querySelectorAll('.tab-btn')
      tabBtns.forEach((btn) => {
        btn.onclick = () => {
          document.querySelectorAll('.tab-content').forEach((c) => (c.style.display = 'none'))
          document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block'
        }
      })

      // 示例：加载 tab-nodes 内容
      window.graphPanelAPI.getAllNodes().then((nodes) => {
        const container = document.getElementById('tab-nodes')
        container.innerHTML = nodes.map((n) => `<div>${n.id} - ${n.label}</div>`).join('')
      })
    },
  }
})()

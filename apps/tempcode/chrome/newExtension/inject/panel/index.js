;(function () {
  const { createPanelTemplate } = window.graphPanelTemplate
  const { bindPanelEvents } = window.graphPanelEvents

  window.graphPanel = window.graphPanel || {}
  window.graphPanel.mountMainPanel = function () {
    if (document.getElementById('x6-main-panel')) return

    const wrapper = document.createElement('div')
    wrapper.innerHTML = createPanelTemplate()
    document.body.appendChild(wrapper)

    bindPanelEvents()
  }
})()

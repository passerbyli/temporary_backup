const injectScript = (src) => {
  const s = document.createElement('script')
  s.src = chrome.runtime.getURL(src)
  document.documentElement.appendChild(s)
}

injectScript('inject/panel/template.js')
injectScript('inject/panel/api.js')
injectScript('inject/panel/events.js')
injectScript('inject/panel/index.js')

setTimeout(() => {
  window.graphPanel?.mountMainPanel?.()
}, 500)

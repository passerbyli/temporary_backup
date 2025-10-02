;(function () {
  window.graphPanelTemplate = {
    createPanelTemplate() {
      return `
          <div id="x6-main-panel">
            <div class="header">🧩 X6 控制面板 <span id="x6-panel-close">❌</span></div>
            <div class="tabs">
              <button class="tab-btn" data-tab="nodes">节点</button>
              <button class="tab-btn" data-tab="info">详情</button>
              <button class="tab-btn" data-tab="log">日志</button>
            </div>
            <div class="tab-content" id="tab-nodes">加载中...</div>
            <div class="tab-content" id="tab-info" style="display:none">节点信息</div>
            <div class="tab-content" id="tab-log" style="display:none">日志内容</div>
          </div>
        `
    },
  }
})()

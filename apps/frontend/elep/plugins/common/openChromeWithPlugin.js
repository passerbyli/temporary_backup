const { exec } = require('child_process')
const os = require('os')
const path = require('path')
const fs = require('fs')

function openChromeWithPlugin(pluginDir, guidePagePath) {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

  if (!fs.existsSync(pluginDir) || !fs.existsSync(path.join(pluginDir, 'manifest.json'))) {
    console.error('❌ 插件目录无效或缺失 manifest.json:', pluginDir)
    return
  }

  if (!fs.existsSync(guidePagePath)) {
    console.error('❌ 引导页面不存在:', guidePagePath)
    return
  }

  const pluginEscaped = pluginDir.replace(/ /g, '\\ ')
  const guideUrl = 'file://' + guidePagePath
  const command = `open -na "Google Chrome" --args --load-extension="${pluginEscaped}" "${guideUrl}"`

  exec(command, err => {
    if (err) {
      console.error('❌ 启动 Chrome 失败:', err.message)
    } else {
      console.log('✅ Chrome 已启动并加载插件')
    }
  })
}

module.exports = { openChromeWithPlugin }

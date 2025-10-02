// pluginManager.js
const path = require('path')
const { session } = require('electron')

let EXTENSION_PATH = path.join(
  __dirname,
  '/Users/lihaomin/projects/GitHub/test/chrome/my-extensiondebug',
) // 插件目录

EXTENSION_PATH = '/Users/lihaomin/projects/GitHub/test/chrome/my-extensiondebug'

let installedExtensionId = null

async function isPluginInstalled(pluginName) {
  const extensions = session.defaultSession.getAllExtensions()
  return Object.values(extensions).some((ext) => ext.name === pluginName)
}

async function installPlugin() {
  const ext = await session.defaultSession.loadExtension(EXTENSION_PATH, {
    allowFileAccess: true,
  })
  installedExtensionId = ext.id
  return ext.name
}

function uninstallPlugin(pluginName) {
  const extensions = session.defaultSession.getAllExtensions()
  const target = Object.values(extensions).find((ext) => ext.name === pluginName)
  if (target) {
    session.defaultSession.removeExtension(target.id)
    return true
  }
  return false
}

module.exports = {
  installPlugin,
  uninstallPlugin,
  isPluginInstalled,
}

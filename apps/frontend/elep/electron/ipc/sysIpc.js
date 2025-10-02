const { shell, app, dialog } = require('electron')
const { exec } = require('child_process')
const path = require('node:path')
const fs = require('node:fs')
const { getBasePath } = require('../db/configDb')

const { exportToExcelFile } = require('../../plugins/excel/excel')
const { openChromeWithPlugin } = require('../../plugins/common/openChromeWithPlugin')

function registerAuthIpc(ipcMain) {
  ipcMain.handle('sys:readLogs', (_, params) => {
    return readLogFile(params.date)
  })
  ipcMain.handle('sys:openDirectory', (_, params) => {
    return openDirectory(params.path, params.type)
  })
  ipcMain.handle('sys:openChrome', (_, params) => {
    return openChrome(params.url)
  })
  ipcMain.handle('sys:selectFolder', async _ => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return canceled ? null : filePaths // 返回绝对路径
  })
  ipcMain.handle('sys:selectFile', async _ => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择 SQL 或 JSON 文件',
      filters: [{ name: 'SQL/JSON', extensions: ['sql', 'json'] }],
      properties: ['openFile']
    })
    if (canceled) return null
    const filePath = filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return { filePath, content }
  })

  ipcMain.handle('plugin:launch-chrome', async () => {
    let pluginPath = path.join(__dirname, 'chrome/my-extensiondebug')
    pluginPath = '/Users/lihaomin/projects/GitHub/test/chrome/my-extensiondebug'
    const guidePath = path.join(__dirname, './public/plugin-guide.html')
    openChromeWithPlugin(pluginPath, guidePath)
    return 'done'
  })

  ipcMain.handle('export-excel', async (event, { list, headers }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '保存 Excel 文件',
      defaultPath: '导出结果.xlsx',
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
    })

    if (canceled || !filePath) {
      return { success: false, message: '用户取消导出' }
    }

    try {
      exportToExcelFile(list, headers, filePath)
      return { success: true, path: filePath }
    } catch (err) {
      return { success: false, message: err.message }
    }
  })
}

function readLogFile(params) {
  console.log('读取日志文件', params)
  const logPath = path.join(getBasePath(), 'logs', `request_${params}.log`)
  if (!fs.existsSync(logPath)) {
    return { success: false, message: '日志文件不存在', data: [] }
  }

  const raw = fs.readFileSync(logPath, 'utf-8')
  const blocks = raw.split(/\n(?=\[\d{4}-\d{2}-\d{2}T)/g)
  const data = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const metaLine = lines[0] || ''
    const typeMatch = metaLine.match(/\] (.+?)(?: \[(.+?)\])?$/)
    const timeMatch = metaLine.match(/^\[(.+?)\]/)

    const type = typeMatch?.[1] || ''
    const tag = typeMatch?.[2] || ''
    const time = timeMatch?.[1] || ''
    let method = '',
      url = '',
      status = '',
      duration = '',
      error = ''
    let params = '',
      requestData = '',
      responseData = ''

    for (let line of lines) {
      line = line.trim()
      if (line.startsWith('URL:')) {
        const parts = line.replace('URL:', '').trim().split(' ')
        method = parts[0]
        url = parts[1]
      } else if (line.startsWith('Params:')) {
        params = line.replace('Params:', '').trim()
      } else if (line.startsWith('Data:')) {
        requestData = line.replace('Data:', '').trim()
      } else if (line.startsWith('Response:')) {
        responseData = line.replace('Response:', '').trim()
      } else if (line.startsWith('Status:')) {
        status = line.replace('Status:', '').trim()
      } else if (line.startsWith('Duration:')) {
        duration = line.replace('Duration:', '').trim()
      } else if (line.startsWith('Error:')) {
        error = line.replace('Error:', '').trim()
      }
    }

    data.push({
      time,
      type,
      tag,
      method,
      url,
      status,
      duration,
      error,
      params,
      requestData,
      responseData
    })
  }
  return { success: true, data: data }
}

function openChrome(params) {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const targetUrl = params
  const profile = 'Default'

  exec(`"${chromePath}" --profile-directory="${profile}" "${targetUrl}"`, error => {
    if (error) {
      console.error('打开失败:', error)
    } else {
      console.log('Chrome 已打开')
    }
  })
}
function openDirectory(dirPath, type) {
  let folderPath = dirPath
  if (type === 'config') {
    folderPath = path.join(app.getPath('userData'))
  } else if (type === 'log') {
    folderPath = path.join(getBasePath(), 'logs')
  } else if (type === 'export') {
    folderPath = path.join(getBasePath(), 'export')
  }

  if (!fs.existsSync(folderPath)) {
    fs.mkdir(folderPath, { recursive: true }, error => {
      if (error) {
        console.log('Error creating directory', error)
      } else {
        console.log('Directory created successfully')
      }
    })
  }

  shell
    .openPath(folderPath)
    .then(() => {
      consoleUtil.log('文件夹已打开')
    })
    .catch(err => {
      consoleUtil.error('无法打开文件夹:', err)
    })
}

/**
 * 如果是文件则返回其所在目录；如果是目录则原样返回；不存在则返回 null
 * @param {string} targetPath
 * @returns {string|null}
 */
function getDirectoryFromPath(targetPath) {
  if (!fs.existsSync(targetPath)) return null

  const stat = fs.statSync(targetPath)

  if (stat.isFile()) {
    return path.dirname(targetPath)
  } else if (stat.isDirectory()) {
    return targetPath
  } else {
    return null
  }
}
module.exports = registerAuthIpc

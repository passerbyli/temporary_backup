const { Notification, shell, BrowserWindow } = require('electron')
const path = require('path')
const { getConfig } = require('../db/configDb')

const noticeTitle = 'Test'
function sendNotice(msg, url) {
  const config = getConfig()
  const reminder = config.global.notify.disable

  if (reminder) {
    const notif = new Notification({
      icon: path.join(__dirname, '../../public/favicon.png'),
      title: noticeTitle,
      body: msg,

      sound: path.join(__dirname, '../../public/朴树+-+平凡之路.mp3'),
      silent: true // 系统默认的通知声音
    })
    notif.on('click', () => {
      if (url) shell.openExternal(url)
    })

    notif.show()
  }
}

function deepSort(value) {
  if (Array.isArray(value)) {
    return value.map(deepSort).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  } else if (value && typeof value === 'object') {
    const sorted = {}
    Object.keys(value)
      .sort()
      .forEach(key => {
        sorted[key] = deepSort(value[key])
      })
    return sorted
  } else {
    return value
  }
}

function compareJsonDeep(a, b) {
  a = deepSort(a)
  b = deepSort(b)

  const result = {
    added: {},
    removed: {},
    changed: {},
    unchanged: {}
  }

  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  for (const key of keys) {
    const valA = a?.[key]
    const valB = b?.[key]

    if (!(key in a)) {
      result.added[key] = valB
    } else if (!(key in b)) {
      result.removed[key] = valA
    } else if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      if (typeof valA === 'object' && typeof valB === 'object') {
        // 深度递归
        const childDiff = compareJsonDeep(valA, valB)
        result.changed[key] = childDiff
      } else {
        result.changed[key] = { old: valA, new: valB }
      }
    } else {
      result.unchanged[key] = valA
    }
  }

  return result
}

function compareJsonSendToFrontend(jsonA, jsonB) {
  const diff = compareJsonDeep(jsonA, jsonB)
  const windows = BrowserWindow.getAllWindows()
  const win = windows.find(w => w?.title === 'Vite App')
  win?.webContents?.send('fromMain', { event: 'json-diff', data: diff })
}

module.exports = { sendNotice, compareJsonSendToFrontend }

const { app } = require('electron')

const fs = require('node:fs')
const { getVersion, queryKg } = require('../utils/requestUtil')
const { CronJob } = require('../../plugins/cron/cronUtil')
const { mainSendToRender } = require('../utils/mainSendToRender')

const registerAuthIpc = require('./authIpc')
const registerConfigIpc = require('./configIpc')
const registerDataSourceIpc = require('./dataSourceIpc')
const registerSysIpc = require('./sysIpc')

function registerAllIpc(ipcMain) {
  registerAuthIpc(ipcMain)
  registerConfigIpc(ipcMain)
  registerDataSourceIpc(ipcMain)
  registerSysIpc(ipcMain)
  console.log('[IPC] 所有 IPC handler 已注册完成')
}

async function ipcHandle(e, args) {
  if (!args || !args.event) {
    return
  }

  const event = args.event
  const params = args.params
  let data
  if (event == 'appInfo') {
    job()
    data = {
      version: app.getVersion()
    }
  } else if (event === 'kg') {
    data = await queryKg(params)
  }
  return data
}

const jobTask = new CronJob('updateJob')

function job() {
  const cron = '0 0 8 * * *' //每天8点执行一次
  jobTask.setExpression(cron)
  jobTask.setCallback(() => {
    getVersion().then(res => {
      console.log(res.version, app.getVersion())
      if (compareVersion(res.version, app.getVersion()) == 1) {
        mainSendToRender('appNewVersion', res)
      }
    })
  })
  jobTask.start()
}

function compareVersion(v1, v2) {
  const arr1 = v1.split('.').map(Number)
  const arr2 = v2.split('.').map(Number)
  const len = Math.max(arr1.length, arr2.length)

  for (let i = 0; i < len; i++) {
    const n1 = arr1[i] || 0
    const n2 = arr2[i] || 0
    if (n1 > n2) return 1
    if (n1 < n2) return -1
  }
  return 0
}
module.exports = { registerAllIpc, ipcHandle }

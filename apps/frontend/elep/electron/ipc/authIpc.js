const constants = require('../constants.js')
const { getConfig, updateConfig } = require('../db/configDb.js')
const { sendNotice } = require('../utils/commonUtil.js')
const consoleUtil = require('../utils/consoleLogUtil.js')
const { CronJob } = require('../../plugins/cron/cronUtil.js')
const { mainSendToRender } = require('../utils/mainSendToRender.js')
const myAxios = require('../utils/myAxios.js')

function registerAuthIpc(ipcMain) {
  ipcMain.handle('auth:login', (_, { username, password, role }) => {
    return loninHandle(username, password, role)
  })

  ipcMain.handle('auth:logout', () => {
    const config = getConfig()
    updateConfig({
      global: {
        ...config.global,
        isLogin: false
      }
    })
    return { success: true }
  })

  ipcMain.handle('auth:changeRole', (_, { role }) => {
    const config = getConfig()
    let auth = config.global.auth
    auth.role = role
    updateConfig({
      global: {
        ...config.global,
        auth
      }
    })
    return { success: true }
  })

  ipcMain.handle('auth:checkLogin', () => {
    return checkLoginHandle()
  })
  ipcMain.handle('auth:authLogin', () => {
    return authLogin()
  })
}

const jobTask = new CronJob('AuthJob')

function loninHandle(username, password, role, isAuto = false) {
  const config = getConfig()
  let auth = config.global.auth || {}
  let resultData = { success: false, isLogin: false, message: '', global: config.global }
  if (isAuto && auth.errorCount > 2) {
    return new Promise((resolve, reject) => {
      resolve({})
    })
  }

  return myAxios
    .post(constants.API.prod.login, {
      username: username,
      password: password
    })
    .then(response => {
      consoleUtil.log('登录成功', response)
      auth = {
        username,
        password,
        role,
        errorCount: 0,
        errorMessage: '',
        displayName: username,
        cookies: response.headers['set-cookie']
      }
      updateConfig({
        global: {
          ...config.global,
          auth: auth,
          isLogin: true
        }
      })

      job()
      return { ...resultData, isLogin: true, success: true, type: '', message: '登录成功' }
    })
    .catch(err => {
      consoleUtil.log(err.response?.data.message)
      auth.cookies = ''
      auth.errorCount = auth.errorCount + 1
      auth.errorMessage = err.response?.data.message
      updateConfig({
        global: {
          ...config.global,
          auth,
          isLogin: false
        }
      })
      return { ...resultData, message: err.response?.data.message }
    })
}

function checkLoginHandle() {
  const config = getConfig()
  let auth = config.global.auth
  let resultData = { success: false, isLogin: false, message: '', global: config.global }
  return myAxios
    .get(constants.API.prod.checkLogin, {
      headers: {
        Cookie: auth.cookies
      }
    })
    .then(response => {
      auth.displayName = response.data.data.username
      updateConfig({
        global: {
          ...config.global,
          auth
        }
      })
      return { ...resultData, success: true, type: '' }
    })
    .catch(err => {
      if (err.status == 401) {
        auth.cookies = ''
        updateConfig({
          global: {
            ...config.global,
            auth,
            isLogin: false
          }
        })
        return { ...resultData, message: err.response.data.message }
      }
      return { ...resultData, message: '用户名或密码错误' }
    })
}

function authLogin() {
  const config = getConfig()
  let auth = config.global.auth
  if (auth && auth.errorCount > 2) {
    jobTask.stop()
    mainSendToRender('loginInfo', { message: 'xxx' })
    return
  }
  if (auth && auth.username && auth.password && auth.role) {
    loninHandle(auth.username, auth.password, auth.role, true)
      .then(res => {
        job()
      })
      .catch(err => {
        console.log('err', err)
      })
  }
}

function job() {
  const config = getConfig()
  const cron = config.global.autoLogin.cron || '* */30 * * * *'
  jobTask.setExpression(cron)
  jobTask.setCallback(() => {
    console.log('定时任务触发', new Date().toLocaleTimeString())
    checkLoginHandle().then(res => {
      mainSendToRender('loginInfo', { global: res.global })
      sendNotice('xxxxxx')
      if (res.message == '未登录，请先登录') {
        authLogin()
      }
    })
  })
  jobTask.start()
}

module.exports = registerAuthIpc

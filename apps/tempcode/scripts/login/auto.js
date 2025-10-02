const puppeteer = require('puppeteer')

const LOGIN_URL = 'https://example.com/login'
const TARGET_URL = 'https://example.com/dashboard'
const USERNAME = 'your_username'
const PASSWORD = 'your_password'

;(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // 指定 Chrome 路径
    userDataDir:
      'C:\\Users\\你的用户名\\AppData\\Local\\Google\\Chrome\\User Data\\puppeteer_profile', // 模拟持久用户目录
    defaultViewport: null,
  })

  const page = await browser.newPage()

  // 1. 打开登录页
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' })

  // 2. 填写账号密码（请替换选择器）
  await page.type('#username', USERNAME, { delay: 80 })
  await page.type('#password', PASSWORD, { delay: 80 })
  await page.click('#login-button')

  // 3. 等待跳转或确认登录成功
  await page.waitForNavigation({ waitUntil: 'networkidle2' })

  // 4. 跳转到你想访问的页面
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2' })

  console.log('已登录并跳转成功')
})()

async function b(){
  const data = await fetch()
  return data.data
}

function a(){
  return b()
}
function main(){
  const data = a()
  console.log(data)
}
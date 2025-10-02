const puppeteer = require("puppeteer");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs-extra");
const path = require("path");
const FormData = require("form-data");
const config = require("./config.json");

// 自动打开浏览器，并要求用户手动登录
async function openBrowserForManualLogin(site, cookiesFilePath) {
  const browser = await puppeteer.launch({ headless: false }); // 打开可见的浏览器窗口
  const page = await browser.newPage();

  // 导航到登录页面
  await page.goto(site.loginUrl);

  console.log("请在浏览器中完成登录操作...");
  // 等待用户登录完成后手动关闭浏览器
  await new Promise((resolve) => {
    page.on("framenavigated", () => {
      resolve(); // 登录完成时解决Promise
    });
  });

  // 获取登录后的cookies
  const cookies = await page.cookies();
  await fs.writeJSON(cookiesFilePath, cookies);

  await browser.close();
  console.log("登录完成，已保存cookies。");
  return cookies;
}

// 从cookies文件中加载cookies
function loadCookies(filePath) {
  return fs.readJSON(filePath);
}

// 使用cookies进行请求
async function fetchArticles(cookies) {
  const cookieHeader = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const response = await axios.get(config.siteA.articlesUrl, {
    headers: { Cookie: cookieHeader },
  });
  return response.data;
}

// 下载图片
async function downloadImage(imageUrl, cookies) {
  const cookieHeader = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    headers: { Cookie: cookieHeader },
  });
  return response.data;
}

// 上传图片到站点B
async function uploadImage(imageData, cookies) {
  const cookieHeader = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const form = new FormData();
  form.append("file", imageData, { filename: "image.jpg" });

  const response = await axios.post(config.siteB.uploadUrl, form, {
    headers: {
      ...form.getHeaders(),
      Cookie: cookieHeader,
    },
  });
  return response.data.imageUrl;
}

// 处理文章中的图片
async function processArticle(article, cookies) {
  const $ = cheerio.load(article.htmlContent);
  const imageUrls = [];

  $("img").each((index, element) => {
    const img = $(element);
    const src = img.attr("src");
    if (src) {
      imageUrls.push(src);
    }
  });

  for (const imageUrl of imageUrls) {
    const imageData = await downloadImage(imageUrl, cookies);
    const newImageUrl = await uploadImage(imageData, cookies);
    $('img[src="' + imageUrl + '"]').attr("src", newImageUrl);
  }

  return {
    title: article.title,
    content: $.html(),
  };
}

// 主程序
(async () => {
  // 第一次运行时，要求用户登录站点A并保存cookies
  const cookiesPathA = path.join(__dirname, "cookies_a.json");
  const cookiesPathB = path.join(__dirname, "cookies_b.json");

  if (!fs.existsSync(cookiesPathA)) {
    await openBrowserForManualLogin(config.siteA, cookiesPathA);
  }

  if (!fs.existsSync(cookiesPathB)) {
    await openBrowserForManualLogin(config.siteB, cookiesPathB);
  }

  const cookiesA = await loadCookies(cookiesPathA);
  const cookiesB = await loadCookies(cookiesPathB);

  // 获取文章数据
  const articles = await fetchArticles(cookiesA);
  const processedArticles = [];

  // 处理每篇文章
  for (const article of articles) {
    const processedArticle = await processArticle(article, cookiesB);
    processedArticles.push(processedArticle);
  }

  // 将处理后的文章保存到本地 JSON 文件中
  await fs.writeJSON(config.localJsonFile, processedArticles, { spaces: 2 });
})();

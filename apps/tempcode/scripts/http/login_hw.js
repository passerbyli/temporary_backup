const axios = require("axios");
const qs = require("qs");
const fs = require("fs");
const path = require("path");

// 持久化存储的cookie文件路径
const cookieFilePath = path.join(__dirname, "cookies.json");

// 检查并创建目录
const cookieDir = path.dirname(cookieFilePath);
if (!fs.existsSync(cookieDir)) {
  fs.mkdirSync(cookieDir, { recursive: true });
}

// 构建表单数据
const formData = {
  pageToken: "0D4F27E9263FCE11A6E2C172E34EE2E066670A65B230EE6DF38056131FAE604F",
  pageTokenKey:
    "27202ED8BF3361175B05065DB5DC63BDFD3541EF2AA500AF7227A22EB1DAD44B",
  reqClientType: "26",
  loginChannel: "26000000",
  clientID: "10049053",
  lang: "zh-cn",
  languageCode: "zh-cn",
  state: "null",
  loginUrl: "https://id1.cloud.huawei.com:443/CAS/portal/loginAuth.html",
  service:
    "https://oauth-login1.cloud.huawei.com/oauth2/v3/loginCallback?access_type=offline&client_id=10049053&code_challenge_method=S256&display=page&flowID=0a8a166b000001d17247114550248472&h=1724711455.0250&include_granted_scopes=true&lang=zh-cn&nonce=default&prompt=login&redirect_uri=https%3A%2F%2Fwww.vmall.com%2Faccount%2Fatlogin%3Furl%3Dhttps%253A%252F%252Fwww.vmall.com%252Findex.html&response_type=code&scope=openid+https%3A%2F%2Fwww.huawei.com%2Fauth%2Faccount%2Fbase.profile+https%3A%2F%2Fwww.huawei.com%2Fauth%2Faccount%2Faccountlist+https%3A%2F%2Fwww.huawei.com%2Fauth%2Faccount%2Fnopwdlowlogin&v=7f3be603d80e8f3fc32e1a600292e4585c51b1a17722bde6f951485cc5510ae7",
  quickAuth: "false",
  isThirdBind: "0",
  hwmeta: "null",
  lowLogin: "false",
  userAccount: "休息休息",
  password: "qqqqqqq",
  scope: "https://www.huawei.com/auth/account/nopwdlowlogin",
};

// 发送登录请求
async function login() {
  try {
    // 如果有存储的cookie，先尝试读取
    let cookies = {};
    if (fs.existsSync(cookieFilePath)) {
      cookies = JSON.parse(fs.readFileSync(cookieFilePath, "utf-8"));
    } else {
      console.log("Cookie文件不存在，将创建新的文件");
    }

    // 配置请求选项，包括cookie
    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies
          ? Object.entries(cookies)
              .map(([key, value]) => `${key}=${value}`)
              .join("; ")
          : "",
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400, // 不要自动处理重定向
    };

    const response = await axios.post(
      "https://id1.cloud.huawei.com/CAS/IDM_W/ajaxHandler/remoteLogin",
      qs.stringify(formData),
      config
    );

    if (response.status === 302 && response.headers["set-cookie"]) {
      // 处理重定向并保存cookie
      const newCookies = response.headers["set-cookie"].reduce(
        (acc, cookie) => {
          const [name, value] = cookie.split(";")[0].split("=");
          acc[name] = value;
          return acc;
        },
        cookies
      );

      fs.writeFileSync(cookieFilePath, JSON.stringify(newCookies), "utf-8");
      console.log("登录成功，Cookie已保存！");
    } else if (response.status === 200) {
      // 检查响应内容，判断是否登录成功
      console.log("响应内容:", response.data);

      if (response.data.includes("登录成功")) {
        console.log("登录成功！");
      } else {
        console.log("登录可能失败，请检查响应内容。");
      }
    } else {
      console.error("登录失败，状态码:", response.status);
    }
  } catch (error) {
    console.error("登录失败:", error);
  }
}

// 定期检查cookie是否过期，如果过期则重新登录
async function checkLoginStatus() {
  try {
    // 检查当前登录状态
    const cookies = JSON.parse(fs.readFileSync(cookieFilePath, "utf-8"));
    const response = await axios.get("https://www.vmall.com/", {
      headers: {
        Cookie: Object.entries(cookies)
          .map(([key, value]) => `${key}=${value}`)
          .join("; "),
      },
    });

    if (response.status === 200) {
      console.log("已登录，无需重新登录");
    } else {
      console.log("Cookie已失效，重新登录中...");
      await login();
    }
  } catch (error) {
    console.error("检查登录状态失败:", error);
    // 如果检查失败，尝试重新登录
    await login();
  }
}

// 主函数调用
(async () => {
  await checkLoginStatus();
})();

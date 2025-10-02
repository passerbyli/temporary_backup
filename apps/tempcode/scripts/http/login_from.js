const https = require("https");
const fs = require("fs");
const querystring = require("querystring");
const path = require("path");

const cookieFilePath = path.resolve(__dirname, "cookies.txt");

// 登录信息
const LOGIN_URL = "/api/login";
const LOGIN_HOST = "example.com";
const LOGIN_DATA = querystring.stringify({
  username: "your-username",
  password: "your-password",
});

let cookies = {};

// 从文件加载 cookies
function loadCookiesFromFile() {
  if (fs.existsSync(cookieFilePath)) {
    const cookieStr = fs.readFileSync(cookieFilePath, "utf-8");
    cookies = cookieStr.split("; ").reduce((acc, curr) => {
      const [name, value] = curr.split("=");
      acc[name] = value;
      return acc;
    }, {});
    console.log("Cookies loaded from file.");
  }
}

// 保存 cookies 到文件
function saveCookiesToFile() {
  const cookieStr = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  fs.writeFileSync(cookieFilePath, cookieStr);
  console.log("Cookies saved to file.");
}

// 解析并存储 cookies
function storeCookies(setCookieHeaders) {
  setCookieHeaders.forEach((header) => {
    const [cookie] = header.split(";");
    const [name, value] = cookie.split("=");
    cookies[name] = value;
  });
  saveCookiesToFile();
}

// 发起HTTPS请求
function makeRequest(options, postData, callback) {
  const req = https.request(options, (res) => {
    let data = "";

    // 存储 cookies
    if (res.headers["set-cookie"]) {
      storeCookies(res.headers["set-cookie"]);
    }

    res.on("data", (chunk) => {
      data += chunk;
    });

    res.on("end", () => {
      callback(null, data);
    });
  });

  req.on("error", (e) => {
    callback(e, null);
  });

  if (postData) {
    req.write(postData);
  }

  req.end();
}

// 登录并获取 cookies
function loginAndGetCookies(callback) {
  const options = {
    hostname: LOGIN_HOST,
    path: LOGIN_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": LOGIN_DATA.length,
    },
  };

  makeRequest(options, LOGIN_DATA, (err, data) => {
    if (err) {
      console.error("Login failed:", err);
    } else {
      console.log("Login successful.");
      callback();
    }
  });
}

// 检查 cookies 是否有效
function isCookieValid(callback) {
  const options = {
    hostname: LOGIN_HOST,
    path: "/protected", // 替换为实际受保护资源路径
    method: "GET",
    headers: {
      Cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    },
  };

  makeRequest(options, null, (err, data) => {
    if (err) {
      console.error("Error checking cookie validity:", err);
      callback(false);
    } else {
      // 检查响应内容判断 cookies 是否有效
      callback(true);
    }
  });
}

// 确保已经登录
function ensureAuthenticated(callback) {
  isCookieValid((isValid) => {
    if (!isValid) {
      loginAndGetCookies(callback);
    } else {
      callback();
    }
  });
}

// 示例请求：访问受保护资源
function fetchProtectedResource() {
  ensureAuthenticated(() => {
    const options = {
      hostname: LOGIN_HOST,
      path: "/protected", // 替换为实际受保护资源路径
      method: "GET",
      headers: {
        Cookie: Object.entries(cookies)
          .map(([name, value]) => `${name}=${value}`)
          .join("; "),
      },
    };

    makeRequest(options, null, (err, data) => {
      if (err) {
        console.error("Error fetching protected resource:", err);
      } else {
        console.log("Protected resource content:", data);
      }
    });
  });
}

// 启动时加载 cookies 并发起请求
loadCookiesFromFile();
fetchProtectedResource();

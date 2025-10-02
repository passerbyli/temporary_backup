const axios = require("axios");
const tough = require("tough-cookie"); // 用于处理cookie
const axiosCookieJarSupport = require("axios-cookiejar-support").default;

axiosCookieJarSupport(axios);

const cookieJar = new tough.CookieJar(); // 创建一个cookie jar

async function loginAndGetCookies() {
  try {
    const loginUrl = "https://example.com/api/login";

    const loginData = {
      username: "your-username",
      password: "your-password",
    };

    // 配置axios实例，使用cookie jar
    const instance = axios.create({
      jar: cookieJar,
      withCredentials: true,
    });

    // 发起POST请求，模拟登录
    let response = await instance.post(loginUrl, loginData, {
      headers: {
        "Content-Type": "application/json",
      },
      maxRedirects: 0, // 禁用自动重定向
      validateStatus: function (status) {
        return status >= 200 && status < 400; // 处理200到399状态码
      },
    });

    // 手动处理重定向
    while (response.status === 302 || response.status === 301) {
      const redirectUrl = response.headers.location;
      response = await instance.get(redirectUrl, {
        headers: {
          "Content-Type": "application/json",
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        },
      });
    }

    // 最终响应后的cookie
    const cookies = cookieJar.getCookiesSync(loginUrl);
    console.log("Final Cookies:", cookies);

    return cookies;
  } catch (error) {
    console.error("Error during login:", error);
  }
}

loginAndGetCookies();

async function makeAuthenticatedRequest(cookies) {
  try {
    const response = await axios.get("https://example.com/protected", {
      headers: {
        Cookie: cookies.join("; "),
      },
    });

    console.log("Protected Page Content:", response.data);
  } catch (error) {
    console.error("Error making authenticated request:", error);
  }
}

loginAndGetCookies().then((cookies) => {
  if (cookies) {
    makeAuthenticatedRequest(cookies);
  }
});

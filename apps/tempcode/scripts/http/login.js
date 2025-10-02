const axios = require("axios");

async function loginAndGetCookies() {
  try {
    // 登录的初始URL
    const loginUrl = "https://example.com/api/login";

    // 登录请求的数据
    const loginData = {
      username: "your-username",
      password: "your-password",
    };

    // 创建一个axios实例，配置自动处理重定向和cookie
    const instance = axios.create({
      withCredentials: true, // 允许axios处理并保存cookie
      maxRedirects: 5, // 设置最大重定向次数
    });

    // 发起POST请求，模拟登录
    const response = await instance.post(loginUrl, loginData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // 获取重定向后的最终响应的cookie
    const cookies = response.headers["set-cookie"];
    console.log("Final Cookies:", cookies);

    return cookies;
  } catch (error) {
    console.error("Error during login:", error);
  }
}

loginAndGetCookies();

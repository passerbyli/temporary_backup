const axios = require("axios");
const CryptoJS = require("crypto-js");
const { CookieJar } = require("tough-cookie");
const fs = require("fs");

// AES加密函数
function aesEncrypt(text, secKey) {
  const cipher = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(secKey), {
    iv: CryptoJS.enc.Utf8.parse("0102030405060708"),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return cipher.toString();
}

// RSA加密函数
function rsaEncrypt(text, pubKey, modulus) {
  text = text.split("").reverse().join("");
  const biText = BigInt(`0x${Buffer.from(text).toString("hex")}`);
  const biEx = BigInt(`0x${pubKey}`);
  const biMod = BigInt(`0x${modulus}`);
  const biRet = biText ** biEx % biMod;
  return biRet.toString(16).padStart(256, "0");
}

// 创建请求需要的加密数据
function createEncryptedData(data) {
  const text = JSON.stringify(data);
  const secKey = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
  const encText = aesEncrypt(aesEncrypt(text, "0CoJUm6Qyw8W8jud"), secKey);
  const encSecKey = rsaEncrypt(secKey, ENCRYPTED_KEY, ENCRYPTED_MODULUS);
  return {
    params: encText,
    encSecKey: encSecKey,
  };
}

// 常量定义
const ENCRYPTED_KEY = "010001";
const ENCRYPTED_MODULUS =
  "00e0b509f6259df8642dbc35662901477df22677ec152b7f2e3a202d78e7d42ad3152a2e7a7aad" +
  "b8d9246db95f57c9375d1e78932c0620c86fbeee4ec68c72ad..."; // 完整的 modulus 可以从分析网易云音乐 API 得到

const cookieJar = new CookieJar();

// 持久化 Cookie
function saveCookies() {
  const cookieFilePath = "./cookies.json";
  const cookies = cookieJar.toJSON();
  fs.writeFileSync(cookieFilePath, JSON.stringify(cookies, null, 2));
}

function loadCookies() {
  const cookieFilePath = "./cookies.json";
  if (fs.existsSync(cookieFilePath)) {
    const cookies = JSON.parse(fs.readFileSync(cookieFilePath, "utf-8"));
    cookieJar.restore(cookies);
  }
}

// 登录函数
async function login(phone, password) {
  const data = {
    phone,
    password,
    countrycode: "86",
    rememberLogin: "true",
  };

  const encryptedData = createEncryptedData(data);

  const response = await axios({
    url: "https://music.163.com/weapi/login/cellphone",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://music.163.com",
    },
    data: new URLSearchParams(encryptedData).toString(),
    jar: cookieJar,
    withCredentials: true,
  });

  if (response.data.code === 200) {
    console.log("Login successful");
    saveCookies();
  } else {
    console.log("Login failed:", response.data);
  }
}

// 示例使用
loadCookies();

login("your_phone_number", "your_password")
  .then(() => {
    console.log("Logged in");
  })
  .catch((err) => {
    console.error("Login error:", err);
  });

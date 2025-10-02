// 保存原始 fetch
const originalFetch = window.fetch;

// 重写 fetch
window.fetch = async function (input, init) {
  let url = input;

  // 如果是 Request 对象，需要取出 url
  if (input instanceof Request) {
    url = input.url;
  }

  // 判断是否包含 /v1/，替换为 /v2/
  if (typeof url === "string" && url.includes("/v1/")) {
    url = url.replace("/v1/", "/v2/");
  }

  // 如果原始传入的是 Request 对象，需要克隆一个新的
  if (input instanceof Request) {
    input = new Request(url, input);
  } else {
    input = url;
  }

  // 调用原始 fetch
  return originalFetch(input, init);
};





(function () {
  const original = Object.getOwnPropertyDescriptor(
    window.Location.prototype,
    "href"
  );

  Object.defineProperty(window.location, "href", {
    configurable: true,
    enumerable: true,
    get: function () {
      return original.get.call(this);
    },
    set: function (url) {
      // 判断是否需要替换
      if (typeof url === "string" && url.includes("a.example.com")) {
        url = url.replace("a.example.com", "b.example.com");
        console.log("[跳转拦截] 替换跳转地址:", url);
      }
      return original.set.call(this, url);
    },
  });
})();
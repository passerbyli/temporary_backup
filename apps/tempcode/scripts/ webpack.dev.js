// webpack.dev.js (webpack 4)
const path = require('path');

module.exports = {
  mode: 'development',
  // ... 你的其它配置
  devServer: {
    // 如能上 https 更稳（用 mkcert 自签）
    // https: true,
    port: 3000,
    // 如果需要从其它网段访问，按需打开
    // host: '0.0.0.0',
    // headers: { 'Access-Control-Allow-Origin': '*' }, // 代理同源通常不需要 CORS 头

    proxy: {
      // 代理你的后端路由前缀
      '/api': {
        target: 'http://your-backend.example.com', // 🔁 后端地址
        changeOrigin: true,
        secure: false, // 目标是 https 且证书不受信时，开发环境设 false

        /**
         * 关键：改写 Set-Cookie 让 localhost 接受
         */
        onProxyRes(proxyRes, req, res) {
          const setCookie = proxyRes.headers['set-cookie'];
          if (!setCookie) return;

          // 多个 cookie 逐条改写
          const rewritten = setCookie.map((cookie) => {
            let c = cookie;

            // 1) 去掉 Domain（或替换成 localhost）
            c = c.replace(/;\s*domain=[^;]*/i, '');
            // // 如果你想明确写 localhost：
            // c = c.replace(/;\s*domain=[^;]*/i, '; Domain=localhost')

            // 2) 本地是 http 时，去掉 Secure（仅开发）
            c = c.replace(/;\s*secure/gi, '');

            // 3) 如果后端发 SameSite=None，但你本地又是 http，
            //    浏览器会丢弃。开发期可改为 Lax（注意与业务兼容性）
            c = c.replace(/;\s*samesite=None/gi, '; SameSite=Lax');

            return c;
          });

          proxyRes.headers['set-cookie'] = rewritten;
        },

        // 按需重写路径
        // pathRewrite: { '^/api': '' },
        // logLevel: 'debug', // 调试时可打开看看代理日志
      },
    },
    // historyApiFallback: true,
  },
};

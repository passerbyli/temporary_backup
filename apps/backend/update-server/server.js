// server.js
const express = require('express');
const path = require('path');

const app = express();
const publicDir = path.join(__dirname, 'public');

app.use(
  '/',
  express.static(publicDir, {
    setHeaders(res, filePath) {
      // 避免 latest*.yml 被缓存导致客户端一直拿不到新版本
      if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

app.listen(3000, '0.0.0.0', () => {
  console.log('Update server:');
  console.log('  Win: http://<server-ip>:3000/win/');
  console.log('  Mac: http://<server-ip>:3000/mac/');
});

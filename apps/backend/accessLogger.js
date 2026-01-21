const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// 每天一个日志文件
function getLogFile() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(logDir, `access-${date}.log`);
}

function accessLogger(req, res, next) {
  const start = Date.now();

  // 真实 IP（兼容本地 & 代理）
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '-';

  res.on('finish', () => {
    const cost = Date.now() - start;
    const time = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const log = `[${time}] ${ip} ${req.method} ${req.originalUrl} ${res.statusCode} ${cost}ms\n`;

    fs.appendFile(getLogFile(), log, (err) => {
      if (err) {
        console.error('写日志失败:', err);
      }
    });
  });

  next();
}

module.exports = accessLogger;

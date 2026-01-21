const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const accessLogger = require('./accessLogger');
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 一定要放在路由之前
app.use(accessLogger);
// health check
app.get('/health', (req, res) => res.json({ ok: true }));
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
});
app.listen(PORT, () => {
  console.log(`HTTP server running: http://localhost:${PORT}`);
});

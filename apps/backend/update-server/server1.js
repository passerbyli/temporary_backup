const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const useHttps = process.argv.includes('--https');
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 安全 JSON 字符串：防止换行/引号导致 JSON 解析失败
function toJsonLine(content) {
  return `data:${JSON.stringify({
    errorCode: 0,
    result: { content },
  })}\n\n`;
}

// 读取 riskDesc.md（你可以换成从数据库/模板生成）
function loadRiskDesc() {
  const file = path.join(__dirname, 'riskDesc.md');
  if (!fs.existsSync(file)) {
    // 没有文件就给个默认内容，方便先跑起来
    return [
      '# 风险评测报告',
      '',
      '**运营风险**',
      '- 示例：运营流程波动导致效率降低',
      '',
      '**财务风险**',
      '- 示例：应收账款回收周期较长',
      '',
      '**合规风险**',
      '- （本段将被前端替换为另一个 API 的结果）',
      '',
      '**市场风险**',
      '- 示例：行业景气度变化带来不确定性',
      '',
    ].join('\n');
  }
  return fs.readFileSync(file, 'utf8');
}
// 简单 token 切分：更像 LLM（中文按字/标点，英文按单词+空格），但仅用于“模拟”
function* tokenize(text) {
  // 按中英文/空白/标点拆分，保留分隔符
  const re = /[\u4e00-\u9fa5]|[A-Za-z0-9]+|[\r\n]+|\s+|[^\sA-Za-z0-9\u4e00-\u9fa5]/g;
  let m;
  while ((m = re.exec(text)) !== null) yield m[0];
}
/**
 * /llm/stream
 * SSE 输出：data:{"errorCode":0,"result":{"content":"..."}} \n\n
 *
 * 支持模式：
 * - mode=normal：标准逐条输出
 * - mode=messy：故意制造“堆积/拆分/跨 chunk”
 * - mode=once：一次性写完（前端当做一次性返回）
 *
 * 你前端传的 body：{ partnerCode, customerCode }
 */
app.post('/llm/stream', async (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // ✅ 避免小包合并影响“流感”
  res.socket?.setNoDelay(true);
  res.socket?.setKeepAlive(true);
  res.socket?.setTimeout(0);

  const send = (content) => {
    if (res.writableEnded) return;
    res.write(`data:${JSON.stringify({ errorCode: 0, result: { content } })}\n\n`);
  };

  // ✅ 先发一段 padding，防止某些链路缓冲（可选但很稳）
  res.write(':' + ' '.repeat(1024) + '\n\n');

  // ✅ 心跳，避免长连接被误判空闲
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(':\n\n');
  }, 15000);

  res.on('close', () => clearInterval(heartbeat));

  // === 仍然从 loadRiskDesc() 取内容 ===
  const body = req.body || {};
  const header =
    `# 风险评测报告\n\n` +
    `> 伙伴编码：${body.partnerCode || '（未传）'}  客户编码：${body.customerCode || '（未传）'}\n\n`;

  const fullText = header + loadRiskDesc();

  // === token 流合并策略（关键）===
  const minChars = 40; // ✅ 每次至少发 40 字符（像 token 但不至于太碎）
  const maxChars = 120; // ✅ 单次上限，避免一次发太多
  const maxDelayMs = 120; // ✅ 最长 120ms 必须发一次，保证“连续感”
  const baseDelayMs = 25; // ✅ token 生成的节奏
  const jitterMs = 25; // ✅ 随机抖动，更像模型

  let buf = '';
  let lastFlushAt = Date.now();

  const shouldFlush = (token) => {
    const now = Date.now();
    const timeDue = now - lastFlushAt >= maxDelayMs;
    const sizeDue = buf.length >= minChars;
    const hardLimit = buf.length >= maxChars;

    // 自然断点：段落/标题/列表/句末
    const boundary =
      token.includes('\n\n') ||
      token === '\n' ||
      /[。！？.!?]\s?$/.test(buf) ||
      /(\n- |\n\d+\. )/.test(buf) ||
      buf.endsWith('**'); // markdown 加粗边界（简单保护）

    return hardLimit || timeDue || (sizeDue && boundary);
  };

  try {
    for (const tk of tokenize(fullText)) {
      if (res.writableEnded) break;

      buf += tk;

      // 模拟 token 延迟（不要太大，不然太慢）
      await sleep(baseDelayMs + Math.floor(Math.random() * jitterMs));

      if (shouldFlush(tk)) {
        send(buf);
        buf = '';
        lastFlushAt = Date.now();
      }
    }

    // 尾巴输出
    if (!res.writableEnded && buf) {
      send(buf);
    }
  } catch (e) {
    console.error('[llm/stream] error:', e);
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
});

/**
 * /compliance/risk
 * 返回合规风险 markdown
 * 你前端现在按 data.markdown || data.content 取
 */
app.post('/compliance/risk', async (req, res) => {
  const { partnerCode, customerCode } = req.body || {};

  // 模拟耗时
  await sleep(5000);

  // 返回 markdown（这里不包含 **合规风险** 标题更合适，
  // 因为前端已经在主报告里输出了标题并插入 marker）
  const md = [
    {
      item: '风险点:合同条款缺失',
    },
    {
      item: '等级:高',
    },
    {
      item: '建议:补齐关键条款并法务复核',
    },
    {
      item: '证据:缺少违约责任123条款',
    },
  ];

  res.json({
    errorCode: 0,
    content: md,
    // 也可以返回 markdown 字段：markdown: md
  });
});

// health check
app.get('/health', (req, res) => res.json({ ok: true }));

// 启动 HTTP 或 HTTPS
if (!useHttps) {
  app.listen(PORT, () => {
    console.log(`HTTP server running: http://localhost:${PORT}`);
    console.log(`LLM stream:  http://localhost:${PORT}/llm/stream?mode=normal`);
    console.log(`LLM messy:   http://localhost:${PORT}/llm/stream?mode=messy`);
    console.log(`LLM once:    http://localhost:${PORT}/llm/stream?mode=once`);
    console.log(`Compliance:  http://localhost:${PORT}/compliance/risk`);
  });
} else {
  const https = require('https');
  const keyPath = path.join(__dirname, 'cert', 'localhost.key');
  const crtPath = path.join(__dirname, 'cert', 'localhost.crt');

  if (!fs.existsSync(keyPath) || !fs.existsSync(crtPath)) {
    console.error('Missing cert files. Please generate cert/localhost.key and cert/localhost.crt first.');
    process.exit(1);
  }

  const server = https.createServer(
    {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(crtPath),
    },
    app,
  );

  server.listen(PORT, () => {
    console.log(`HTTPS server running: https://localhost:${PORT}`);
    console.log(`LLM stream:  https://localhost:${PORT}/llm/stream?mode=normal`);
    console.log(`LLM messy:   https://localhost:${PORT}/llm/stream?mode=messy`);
    console.log(`LLM once:    https://localhost:${PORT}/llm/stream?mode=once`);
    console.log(`Compliance:  https://localhost:${PORT}/compliance/risk`);
  });
}

const ExcelJS = require("exceljs");

async function readHeaderInfo(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // 假设我们只读取第一个工作表
  const worksheet = workbook.worksheets[0];

  // 方式1：通过第一行获取表头内容
  const headerRow = worksheet.getRow(1);

  const headers = [];
  headerRow.eachCell((cell, colNumber) => {
    headers.push({
      name: cell.value, // 表头名称
      index: colNumber, // 列下标（从 1 开始）
      width: worksheet.getColumn(colNumber).width || "default", // 列宽
    });
  });

  console.log("表头信息:", headers);
  return headers;
}

(async () => {
  await readHeaderInfo("./apis.xlsx");
})();



// validate_apis.js
const path = require('path');
const ExcelJS = require('exceljs');
const axios = require('axios');
const JSON5 = require('json5');
const fs = require('fs');

const CONFIG_PATH = path.resolve(__dirname, 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`缺少配置文件：${CONFIG_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function toBooleanY(cellVal) {
  if (cellVal == null) return false;
  const s = String(cellVal).trim().toUpperCase();
  return s === 'Y' || s === 'YES' || s === 'TRUE' || s === '1';
}

function isAbsoluteUrl(u = '') {
  return /^https?:\/\//i.test(u);
}

function buildUrl(baseUrl, apiPath) {
  if (!apiPath) return '';
  if (isAbsoluteUrl(apiPath)) return apiPath;
  if (!baseUrl) return apiPath;
  if (apiPath.startsWith('/')) return baseUrl.replace(/\/+$/, '') + apiPath;
  return baseUrl.replace(/\/+$/, '') + '/' + apiPath;
}

function safeParseParams(val) {
  if (val == null) return {};
  const s = String(val).trim();
  if (!s || s === '暂无') return {};
  try {
    // 先尝试 JSON5（支持单引号/未加引号key等）
    return JSON5.parse(s);
  } catch (e1) {
    // 再尝试“将单引号替换为双引号”的简易兜底
    try {
      const maybeJson = s.replace(/'/g, '"');
      return JSON5.parse(maybeJson);
    } catch (e2) {
      // 再兜底：直接当作字符串参数
      return { _raw: s };
    }
  }
}

function in2xx(status) {
  return status >= 200 && status < 300;
}

function decidePass(hasPermissionY, status, cfg) {
  if (hasPermissionY) {
    return in2xx(status);
  } else {
    if (cfg.strictUnauthorized) {
      return cfg.unauthorizedStatuses.includes(status);
    } else {
      return !in2xx(status);
    }
  }
}

function redFill() {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFC7CE' } // 浅红
  };
}

function wrapTextStyle(cell) {
  cell.alignment = { wrapText: true, vertical: 'top' };
}

async function fireRequest({ url, method, paramsObj, cookie, headers, timeoutMs }) {
  const axiosCfg = {
    url,
    method: (method || 'GET').toUpperCase(),
    headers: { ...headers },
    timeout: timeoutMs,
    validateStatus: () => true // 我们自己判断
  };

  if (cookie) {
    axiosCfg.headers['Cookie'] = cookie;
  }

  // GET/DELETE → params；其他 → data
  if (['GET', 'DELETE'].includes(axiosCfg.method)) {
    if (paramsObj && Object.keys(paramsObj).length) {
      axiosCfg.params = paramsObj;
    }
  } else {
    if (paramsObj && Object.keys(paramsObj).length) {
      axiosCfg.data = paramsObj;
      axiosCfg.headers['Content-Type'] = axiosCfg.headers['Content-Type'] || 'application/json';
    }
  }

  try {
    const res = await axios(axiosCfg);
    const { status, headers: resHeaders, data } = res;
    let bodySnippet;
    if (typeof data === 'string') {
      bodySnippet = data.slice(0, 500);
    } else {
      bodySnippet = JSON.stringify(data).slice(0, 500);
    }
    return { ok: true, status, bodySnippet, headers: resHeaders };
  } catch (err) {
    const status = err.response?.status ?? 0;
    const bodySnippet = err.response ? (typeof err.response.data === 'string'
      ? err.response.data.slice(0, 500)
      : JSON.stringify(err.response.data || '').slice(0, 500)) : String(err.message).slice(0, 500);
    return { ok: false, status, bodySnippet };
  }
}

async function main() {
  const cfg = loadConfig();

  const inputPath = process.argv[2] || path.resolve(__dirname, 'apis.xlsx');
  const outputPath = process.argv[3] || path.resolve(__dirname, 'apis_checked.xlsx');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inputPath);

  // 默认处理第一个工作表
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('工作簿没有工作表');

  // 建表头索引（按名称找列）
  const headerRow = ws.getRow(1);
  const name2col = {};
  headerRow.eachCell((cell, colNumber) => {
    const key = String(cell.value).trim();
    if (key) name2col[key] = colNumber;
  });

  const COLS = {
    url: name2col['接口地址'],
    method: name2col['请求方式'],
    name: name2col['接口名称'],
    roleA: name2col['角色 A'],
    roleB: name2col['角色 B'],
    roleC: name2col['角色 C'],
    params: name2col['入参']
  };

  const missing = Object.entries(COLS)
    .filter(([k, v]) => v == null && !['roleA','roleB','roleC','name'].includes(k)); // name/角色列可选？
  if (missing.length) {
    throw new Error(`缺少以下必要表头：${missing.map(([k]) => k).join(', ')}`);
  }

  // 在原有末尾追加结果列（每个角色三列）
  const lastCol = ws.columnCount;
  const outCols = {
    '角色 A': { status: lastCol + 1, pass: lastCol + 2, resp: lastCol + 3 },
    '角色 B': { status: lastCol + 4, pass: lastCol + 5, resp: lastCol + 6 },
    '角色 C': { status: lastCol + 7, pass: lastCol + 8, resp: lastCol + 9 }
  };

  ws.getRow(1).getCell(outCols['角色 A'].status).value = '角色A-Status';
  ws.getRow(1).getCell(outCols['角色 A'].pass).value = '角色A-Pass';
  ws.getRow(1).getCell(outCols['角色 A'].resp).value = '角色A-Resp';

  ws.getRow(1).getCell(outCols['角色 B'].status).value = '角色B-Status';
  ws.getRow(1).getCell(outCols['角色 B'].pass).value = '角色B-Pass';
  ws.getRow(1).getCell(outCols['角色 B'].resp).value = '角色B-Resp';

  ws.getRow(1).getCell(outCols['角色 C'].status).value = '角色C-Status';
  ws.getRow(1).getCell(outCols['角色 C'].pass).value = '角色C-Pass';
  ws.getRow(1).getCell(outCols['角色 C'].resp).value = '角色C-Resp';

  // 结果列样式：自动换行
  for (const role of Object.keys(outCols)) {
    const { status, pass, resp } = outCols[role];
    ws.getColumn(resp).width = 60;
    ws.getColumn(status).width = 12;
    ws.getColumn(pass).width = 10;
  }

  // 遍历数据行
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const urlCell = row.getCell(COLS.url)?.value;
    const methodCell = row.getCell(COLS.method)?.value;
    const paramsCell = COLS.params ? row.getCell(COLS.params)?.value : null;

    const rawUrl = urlCell ? String(urlCell).trim() : '';
    if (!rawUrl) continue;

    const method = methodCell ? String(methodCell).trim().toUpperCase() : 'GET';
    const paramsObj = safeParseParams(paramsCell);
    const fullUrl = buildUrl(cfg.baseUrl, rawUrl);

    // 逐角色请求
    for (const roleName of ['角色 A', '角色 B', '角色 C']) {
      if (!COLS[roleKey(roleName)]) continue;

      const permCell = row.getCell(COLS[roleKey(roleName)]);
      const hasY = toBooleanY(permCell?.value);

      const cookie = cfg.roles?.[roleName]?.cookie || '';
      const { status, bodySnippet } = await fireRequest({
        url: fullUrl,
        method,
        paramsObj,
        cookie,
        headers: cfg.headers || {},
        timeoutMs: cfg.timeoutMs || 10000
      });

      const pass = decidePass(hasY, status, cfg);

      // 写入结果列
      const { status: cStatus, pass: cPass, resp: cResp } = outCols[roleName];
      row.getCell(cStatus).value = status || 0;
      row.getCell(cPass).value = pass ? 'Y' : 'N';
      row.getCell(cResp).value = bodySnippet;
      wrapTextStyle(row.getCell(cResp));

      // 若不匹配 → 高亮“权限单元格”（角色列）
      if (!pass) {
        permCell.fill = redFill();
        // 同时把 Pass 列也标红，便于快速扫错
        row.getCell(cPass).fill = redFill();
      }
    }

    row.commit();
  }

  await wb.xlsx.writeFile(outputPath);
  console.log(`✅ 校验完成：${outputPath}`);
}

function roleKey(roleName) {
  // 将 “角色 A/B/C” 转换为 COLS 的键名：roleA/roleB/roleC
  if (roleName === '角色 A') return 'roleA';
  if (roleName === '角色 B') return 'roleB';
  if (roleName === '角色 C') return 'roleC';
  return '';
}

main().catch(err => {
  console.error('❌ 发生错误：', err);
  process.exit(1);
});
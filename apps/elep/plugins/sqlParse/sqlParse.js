// sqlParse.js（最终版：增强 + 字段级血缘 + 详细中文注释）
// 说明：
// - 不引入第三方语法解析器，在正则/启发式的前提下尽量稳健。
// - 修复 VSCode 在模板字符串中使用反引号/方括号导致的高亮/解析问题。
// - 关键增强：
//   1) 更稳健的标识符解析与正则转义（支持 "name"、[name]、`name`、schema.table、db.schema.table）。
//   2) CTE 名称解析支持 WITH RECURSIVE 与列清单：WITH cte(col1, col2) AS (...)
//   3) USING 误判修复：仅在 MERGE ... USING <table> 时采集来源，不把 JOIN USING(col) 的列名当表。
//   4) 临时表判断：不再因“无 schema”而默认临时；仅在 CREATE TEMP TABLE、CTE 同名、约定命名 temp_/tmp 时返回 true。
//   5) RENAME 提取与循环修复：两种调用形式分别遍历，避免互相抢匹配指针。
//   6) 字段级血缘：顶层逗号切分；支持 FROM 源表别名（s.col 展开到真实表列）。
//   7) 语句级边：补充 TRUNCATE TABLE 作为目标操作（可被视作写/变更）。

/* -------------------------------- 工具函数 -------------------------------- */

/** 对放入动态 RegExp 的字符串进行转义 */
function escapeRegExp(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 去除标识符外围引号/括号（name、"name"、`name`、[name]）
 * 仅去除一层外围包裹，不修改内部字符。
 */
function stripIdentifierQuotes(id) {
  if (!id) return id;
  const s = id.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('`') && s.endsWith('`'))) {
    return s.slice(1, -1);
  }
  if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1);
  return s;
}

/**
 * 拆分限定名：db.schema.table / schema.table / table
 * 只返回 { schema, table }，忽略 db 这一级（若存在）。
 */
function splitQualifiedName(raw) {
  const cleaned = stripIdentifierQuotes(raw || '');
  if (!cleaned) return { schema: 'public', table: '' };
  const parts = cleaned.split('.');
  if (parts.length >= 2) {
    // 取末两段作为 schema、table，忽略更高层级（如数据库名）
    const table = parts.pop();
    const schema = parts.pop();
    return { schema: schema || 'public', table };
  }
  return { schema: 'public', table: cleaned };
}

/**
 * 顶层逗号切分：保留括号与引号内的逗号。
 */
function splitTopLevelCSV(input = '') {
  const s = input.trim();
  const out = [];
  let buf = '';
  let depth = 0;
  let inSingle = false,
    inDouble = false,
    inBack = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = s[i - 1];
    if (ch === "'" && !inDouble && !inBack) {
      if (inSingle && prev === '\\') {
        buf += ch;
        continue;
      }
      inSingle = !inSingle;
      buf += ch;
      continue;
    }
    if (ch === '"' && !inSingle && !inBack) {
      if (inDouble && prev === '\\') {
        buf += ch;
        continue;
      }
      inDouble = !inDouble;
      buf += ch;
      continue;
    }
    if (ch === '`' && !inSingle && !inDouble) {
      inBack = !inBack;
      buf += ch;
      continue;
    }
    if (!inSingle && !inDouble && !inBack) {
      if (ch === '(') {
        depth++;
        buf += ch;
        continue;
      }
      if (ch === ')') {
        depth = Math.max(0, depth - 1);
        buf += ch;
        continue;
      }
      if (ch === ',' && depth === 0) {
        out.push(buf.trim());
        buf = '';
        continue;
      }
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/* ------------------------------ 关键字/工具 ------------------------------ */

const SQL_KEYWORDS = new Set([
  'select',
  'insert',
  'update',
  'delete',
  'set',
  'from',
  'where',
  'join',
  'on',
  'using',
  'with',
  'into',
  'values',
  'union',
  'intersect',
  'except',
  'group',
  'order',
  'by',
  'limit',
  'offset',
  'create',
  'drop',
  'alter',
]);

function isValidTableName(name) {
  const n = (name || '').trim();
  return n && !SQL_KEYWORDS.has(n.toLowerCase());
}

function detectDatabaseType(sqlContent) {
  // 依旧使用启发式，但尽量避免过度匹配（例如 BEGIN/END 在多方言中都常见）
  if (/ENGINE\s*=\s*InnoDB|AUTO_INCREMENT|DELIMITER/i.test(sqlContent)) return 'MySQL';
  if (/\bIDENTITY\b|\bNVARCHAR\b|\bGO\b(?!\s*LANGUAGE)/i.test(sqlContent)) return 'SQL Server';
  if (/VARCHAR2|PL\s*\/\s*SQL|NUMBER\b|NVL$begin:math:text$/i.test(sqlContent)) return 'Oracle';
  if (/\\bSERIAL\\b|\\bBIGSERIAL\\b|\\bRETURNING\\b/i.test(sqlContent)) return 'PostgreSQL';
  return 'Unknown';
}

function removeComments(sql) {
  let out = '';
  let i = 0,
    n = sql.length;

  let inSingle = false; // '...'
  let inDouble = false; // "..."
  let inBack = false; // `...` (MySQL)
  let inLine = false; // -- ...
  let inBlock = false; // /* ... */
  let inDollar = false; // $tag$ ... $tag$ (PostgreSQL)
  let dollarTag = '';

  const startsWithDollar = (s, pos) => {
    const m = s.slice(pos).match(/^\$([a-zA-Z0-9_]*)\$/);
    return m ? m[0] : null; // "$$" 或 "$tag$"
  };

  while (i < n) {
    const ch = sql[i];
    const next = i + 1 < n ? sql[i + 1] : '';

    if (inLine) {
      // 行注释
      if (ch === '\n' || ch === '\r') {
        inLine = false;
        out += ch;
        i++;
        continue;
      }
      i++;
      continue;
    }
    if (inBlock) {
      // 块注释
      if (ch === '*' && next === '/') {
        inBlock = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (inDollar) {
      // $tag$ 字符串
      const endTag = `$${dollarTag}$`;
      if (sql.startsWith(endTag, i)) {
        inDollar = false;
        out += endTag;
        i += endTag.length;
      } else {
        out += ch;
        i++;
      }
      continue;
    }

    // 进入 $tag$ 字符串
    if (!inSingle && !inDouble && !inBack) {
      const tag = startsWithDollar(sql, i);
      if (tag) {
        inDollar = true;
        dollarTag = tag.slice(1, -1);
        out += tag;
        i += tag.length;
        continue;
      }
    }

    // 处理引号进入/退出（简单处理反斜杠转义）
    if (!inDouble && !inBack && ch === "'") {
      if (sql[i - 1] !== '\\') inSingle = !inSingle;
      out += ch;
      i++;
      continue;
    }
    if (!inSingle && !inBack && ch === '"') {
      if (sql[i - 1] !== '\\') inDouble = !inDouble;
      out += ch;
      i++;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inBack = !inBack;
      out += ch;
      i++;
      continue;
    }

    // 不在字符串中：检测注释开始
    if (!inSingle && !inDouble && !inBack) {
      if (ch === '-' && next === '-') {
        inLine = true;
        i += 2;
        continue;
      } // --
      if (ch === '/' && next === '*') {
        inBlock = true;
        i += 2;
        continue;
      } // /* */
    }

    out += ch;
    i++;
  }
  return out;
}

/**
 * 提取 WITH 子句中的 CTE 名称（统一转小写）。
 * 支持 WITH RECURSIVE；支持 cte(col1, col2) AS (...)
 */
function getCTENames(sql) {
  const lowered = sql.toLowerCase();
  const names = [];
  const withMatch = lowered.match(/\\bwith\\b\\s+(recursive\\s+)?([\\s\\S]+)/i);
  if (!withMatch) return names;
  let remaining = withMatch[2] || '';
  let index = 0,
    length = remaining.length;
  while (index < length) {
    const slice = remaining.slice(index);
    const nameMatch = slice.match(/^([a-z0-9_]+)\s*(?:\([^)]*\))?\s+as\s+(?:(?:not\s+)?materialized\s*)?\(/i);
    if (!nameMatch) break;
    names.push(nameMatch[1]);
    index += nameMatch[0].length;
    // 跳过匹配到的括号体
    let depth = 1;
    while (index < length && depth > 0) {
      const ch = remaining[index];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      index++;
    }
    // 跳过逗号/空白，进入下一个 CTE
    while (index < length && /[\s,]/.test(remaining[index])) index++;
  }
  return names;
}

/** 更稳健的临时表判定（仅根据明确信号判定） */
function isTemporaryTableAccurate(sql, tableName, schema) {
  const loweredSql = sql.toLowerCase();
  const loweredTable = (tableName || '').toLowerCase();
  if (!loweredTable) return false;

  // 匹配 CREATE TEMP TABLE <name> —— 采用字符串拼接而非模板字符串，避免 VSCode 高亮混乱
  const pattern =
    'create\\s+(?:global\\s+)?temp(?:orary)?\\s+table\\s+["\'`\\[]?' +
    escapeRegExp(loweredTable) +
    '["\'`\\]]?[\\s\\(]';

  const createTempRegex = new RegExp(pattern, 'i');
  if (createTempRegex.test(loweredSql)) return true;

  // CTE 名同表名视作“中间结果”
  if (getCTENames(sql).includes(loweredTable)) return true;

  // 约定式命名
  if (loweredTable.startsWith('temp_') || loweredTable.includes('tmp')) return true;

  // 无 schema 不再默认判定为临时表
  if (!schema) return false;

  return false;
}

/** 去重表集合（按 schema.table 小写键） */
function deduplicateTables(tables) {
  const seen = new Set();
  return tables.filter(({ schema, table }) => {
    const key = `${(schema || 'public').toLowerCase()}.${(table || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 标准化为 schema.table（忽略更高层级；无 schema 则为 public） */
function normalizeTableId(raw) {
  const { schema, table } = splitQualifiedName(raw);
  return `${schema}.${table}`;
}

/* -------------------------- 语句级边（表到表） -------------------------- */

function extractEdgesByStatement(sqlContent, procedureNames = []) {
  const statements = sqlContent
    .split(/;\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const edges = [];

  for (const stmt of statements) {
    const sources = [],
      targets = [];

    // 来源：FROM、JOIN、MERGE ... USING <table>
    const sourceRegexes = [
      /(?<!delete\s)from\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)/gi,
      /join\s+([a-zA-Z0-9_\.\[\]`"]+)/gi,
      /merge[\s\S]*?\susing\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)/gi,
    ];

    // 目标：INSERT INTO、UPDATE、DELETE FROM、MERGE INTO、SELECT ... INTO <table>、TRUNCATE TABLE
    const targetRegexes = [
      /insert\s+into\s+([a-zA-Z0-9_\.\[\]`"]+)/gi,
      /update\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)/gi,
      /delete\s+from\s+([a-zA-Z0-9_\.\[\]`"]+)/gi,
      /merge\s+into\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)/gi,
      /select\s+[\s\S]*?\sinto\s+([a-zA-Z0-9_\.\[\]`"]+)/gi,
      /truncate\s+table\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)/gi,
    ];

    for (const r of sourceRegexes) {
      let m;
      while ((m = r.exec(stmt)) !== null) sources.push(m[1]);
    }
    for (const r of targetRegexes) {
      let m;
      while ((m = r.exec(stmt)) !== null) targets.push(m[1]);
    }

    for (const src of sources) {
      for (const tgt of targets) {
        edges.push({
          source: `table:${normalizeTableId(src)}`,
          target: `table:${normalizeTableId(tgt)}`,
          label: `TRANSFORM${procedureNames.length ? ' via ' + procedureNames[0].name : ''}`,
        });
      }
    }
  }
  return edges;
}

/* ---------------------------- RENAME 提取 ---------------------------- */

function extractRenameTables(sqlContent) {
  const renameCalls = [];
  const regex1 = /p_rename_table\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/gi;
  const regex2 =
    /p_rename_table\s*\(\s*sourceSchema\s*=>\s*'([^']+)'\s*,\s*sourceTable\s*=>\s*'([^']+)'\s*,\s*targetSchema\s*=>\s*'([^']+)'\s*,\s*targetTable\s*=>\s*'([^']+)'\s*\)/gi;

  let m;
  while ((m = regex1.exec(sqlContent)) !== null) {
    const [sourceSchema, sourceTable, targetSchema, targetTable] = m.slice(1);
    renameCalls.push({
      source: { schema: sourceSchema, table: sourceTable },
      target: { schema: targetSchema, table: targetTable },
    });
  }
  while ((m = regex2.exec(sqlContent)) !== null) {
    const [sourceSchema, sourceTable, targetSchema, targetTable] = m.slice(1);
    renameCalls.push({
      source: { schema: sourceSchema, table: sourceTable },
      target: { schema: targetSchema, table: targetTable },
    });
  }
  return renameCalls;
}

/* ------------------------------ 主解析入口 ------------------------------ */

function parseSql(sqlContent, options = { includeTemporaryTables: true }) {
  let sourceTables = [],
    targetTables = [],
    procedures = [],
    functionNames = [];

  // 预处理
  sqlContent = removeComments(sqlContent);
  const databaseType = detectDatabaseType(sqlContent);
  const renameInfo = extractRenameTables(sqlContent);

  // 表名捕获规则（启发式）：
  const patterns = [
    { type: 'source', regex: /(?<!delete\s)from\s+([a-zA-Z0-9_\.\[\]`"]+)/gi },
    { type: 'source', regex: /join\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)/gi },
    { type: 'source', regex: /merge[\s\S]*?\susing\s+([a-zA-Z0-9_\.\[\]`"]+)/gi },

    { type: 'target', regex: /delete\s+from\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)/gi },
    { type: 'target', regex: /insert\s+into\s+([a-zA-Z0-9_\.\[\]`"]+)/gi },
    { type: 'target', regex: /update\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)/gi },
    { type: 'target', regex: /merge\s+into\s+([a-zA-Z0-9_\.\[\]`"]+)/gi },
    { type: 'target', regex: /select\s+[\s\S]*?\sinto\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)/gi },
    { type: 'target', regex: /truncate\s+table\s+([a-zA-Z0-9_\.\[\]`"]+)/gi },

    { type: 'source', regex: /select\s+[\s\S]*?\sfrom\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)/gi },
  ];

  for (const { type, regex } of patterns) {
    let match;
    while ((match = regex.exec(sqlContent)) !== null) {
      const ident = match[1];
      const { schema, table } = splitQualifiedName(ident);
      if (!isValidTableName(table)) continue;
      const entry = {
        schema: schema || 'public',
        table,
        isTemporary: isTemporaryTableAccurate(sqlContent, table, schema),
      };
      if (type === 'source') sourceTables.push(entry);
      else targetTables.push(entry);
    }
  }

  // RENAME：source 视作临时（旧名），target 为正式（新名）
  for (const { source, target } of renameInfo) {
    sourceTables.push({ ...source, isTemporary: true });
    targetTables.push({ ...target, isTemporary: false });
    // 避免 target 集合中残留旧名
    targetTables = targetTables.filter((t) => !(t.schema === source.schema && t.table === source.table));
  }

  // 过程/函数提取：支持 schema.name 和仅 name（无 schema）
  const procedureRegex = /CREATE\s+(OR\s+REPLACE\s+)?(PROCEDURE|FUNCTION)\s+((?:[a-zA-Z0-9_]+\.)?)([a-zA-Z0-9_]+)/gi;
  let m;
  while ((m = procedureRegex.exec(sqlContent)) !== null) {
    const schemaName = m[3] && m[3].endsWith('.') ? m[3].slice(0, -1) : 'public';
    const name = m[4];
    if ((m[2] || '').toUpperCase() === 'PROCEDURE') {
      procedures.push({ type: 'PROCEDURE', schema: schemaName, name });
    } else {
      functionNames.push({ type: 'FUNCTION', schema: schemaName, name });
    }
  }

  const sourceSet = deduplicateTables(sourceTables);
  const targetSet = deduplicateTables(targetTables);

  // 构造节点（去重）
  const nodes = [];
  const nodeIds = new Set();
  const shouldInclude = (isTemp) => options.includeTemporaryTables || !isTemp;

  function pushNode(node) {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  }

  for (const { schema, table, isTemporary } of sourceSet) {
    if (!shouldInclude(isTemporary)) continue;
    pushNode({
      id: `table:${schema}.${table}`,
      label: table,
      type: 'table',
      isTemporary,
      style: { fill: isTemporary ? '#FFD700' : '#87CEFA' },
    });
  }

  for (const { schema, table, isTemporary } of targetSet) {
    if (!shouldInclude(isTemporary)) continue;
    const id = `table:${schema}.${table}`;
    pushNode({ id, label: table, type: 'table', isTemporary, style: { fill: isTemporary ? '#FFD700' : '#87CEFA' } });
  }

  for (const { schema, name } of procedures) {
    pushNode({ id: `procedure:${schema}.${name}`, label: name, type: 'procedure', style: { fill: '#FFB6C1' } });
  }
  for (const { schema, name } of functionNames) {
    pushNode({ id: `function:${schema}.${name}`, label: name, type: 'function', style: { fill: '#DDA0DD' } });
  }

  // 语句级表间边
  const edges = extractEdgesByStatement(sqlContent, procedures.concat(functionNames));

  // RENAME 边
  for (const { source, target } of renameInfo) {
    edges.push({
      source: `table:${source.schema}.${source.table}`,
      target: `table:${target.schema}.${target.table}`,
      label: 'RENAME',
    });
  }

  // 将“过程/函数”与目标表之间建立调用/写入关系（保持原有语义：从表指向过程/函数）
  for (const tgt of targetSet) {
    for (const proc of procedures) {
      if (!shouldInclude(tgt.isTemporary)) continue;
      edges.push({
        source: `table:${tgt.schema}.${tgt.table}`,
        target: `procedure:${proc.schema}.${proc.name}`,
        label: 'CALL PROCEDURE',
      });
    }
    for (const fn of functionNames) {
      if (!shouldInclude(tgt.isTemporary)) continue;
      edges.push({
        source: `table:${tgt.schema}.${tgt.table}`,
        target: `function:${fn.schema}.${fn.name}`,
        label: 'CALL FUNCTION',
      });
    }
  }

  /* -------------------------- 字段级血缘提取 -------------------------- */
  // 覆盖常见形态：
  // INSERT INTO tgt(col1, col2, ...) SELECT expr1 AS col1, expr2 AS col2, ... FROM src [AS s]
  // - 支持 FROM 源表别名，若 SELECT 列形如 s.col，会展开为 schema.table.col
  // - 复杂 JOIN/子查询/多来源仅做启发式支持，建议在需要高精度时改 AST 方案

  const columnEdges = [];
  const selectMapRegex =
    /insert\s+into\s+([a-zA-Z0-9_\.\[\]`"]+)\s*$begin:math:text$([^)]+)$end:math:text$\s*select\s+([\s\S]+?)\s+from\s+([a-zA-Z0-9_\.$begin:math:display$$end:math:display$`"]+)(?:\s+as)?\s*([a-zA-Z0-9_]+)?/gi;
  let match2;
  while ((match2 = selectMapRegex.exec(sqlContent)) !== null) {
    const [, targetTableFull, targetColsRaw, selectColsRaw, sourceTableFull, sourceAliasRaw] = match2;
    if (!targetTableFull || !sourceTableFull) continue;

    const { schema: targetSchema, table: targetTable } = splitQualifiedName(targetTableFull);
    const { schema: sourceSchema, table: sourceTable } = splitQualifiedName(sourceTableFull);
    const sourceAlias = (sourceAliasRaw || '').trim();

    const targetColumns = splitTopLevelCSV(targetColsRaw).map((c) => stripIdentifierQuotes(c));
    const sourceItems = splitTopLevelCSV(selectColsRaw).map((c) => c.trim());

    // 解析 SELECT 列项：expr [AS] alias
    const sourceColumns = sourceItems.map((item) => {
      let m = item.match(/^[\s\S]*?\s+as\s+([a-zA-Z0-9_\"`$begin:math:display$$end:math:display$]+)$/i);
      if (m) {
        const alias = stripIdentifierQuotes(m[1]);
        const expr = item.replace(/\s+as\s+[\s\S]+$/i, '').trim();
        return { expr, alias };
      }
      m = item.match(/^[\s\S]*?\s+([a-zA-Z0-9_\"`\[\]]+)$/);
      if (m) {
        const alias = stripIdentifierQuotes(m[1]);
        const expr = item.replace(/\s+([a-zA-Z0-9_\"`$begin:math:display$$end:math:display$]+)$/, '').trim();
        return { expr, alias };
      }
      return { expr: item, alias: item };
    });

    if (targetColumns.length === sourceColumns.length) {
      for (let i = 0; i < targetColumns.length; i++) {
        let srcExpr = sourceColumns[i].expr;
        const tgtCol = targetColumns[i];
        if (!tgtCol) continue;
        // 展开来源别名：alias.col -> col（表前缀在 source 中已拼接）
        if (sourceAlias && srcExpr.startsWith(sourceAlias + '.')) {
          srcExpr = srcExpr.slice(sourceAlias.length + 1);
        }
        columnEdges.push({
          source: `${sourceSchema}.${sourceTable}.${srcExpr}`,
          target: `${targetSchema}.${targetTable}.${tgtCol}`,
          label: 'FIELD_MAP',
        });
      }
    }
  }

  return {
    databaseType,
    procedures,
    functionNames,
    sourceTables: deduplicateTables(sourceTables),
    targetTables: deduplicateTables(targetTables),
    nodes,
    edges,
    columnEdges,
  };
}

module.exports = { parseSql };

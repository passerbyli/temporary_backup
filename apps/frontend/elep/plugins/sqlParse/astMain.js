// test.js
const fs = require('fs');
const path = require('path');
const { parseSql } = require('./sqlParseAst'); // 注意路径是否正确

// 示例 SQL 内容（也可以读取文件）
const sqlContent = `
  INSERT INTO public.orders_clean
  SELECT * FROM public.raw_orders;

  UPDATE public.orders_clean
  SET status = 'done'
  FROM public.orders;

  DELETE FROM public.orders_archive
  WHERE created_at < NOW();
`;

// 调用解析函数
const result = parseSql(sqlContent);

// 打印结果（含 G6 nodes 和 edges）
console.log('📊 G6 血缘图节点（nodes）：');
console.log(JSON.stringify(result.nodes, null, 2));

console.log('\n🔗 G6 血缘图连线（edges）：');
console.log(JSON.stringify(result.edges, null, 2));

console.log('\n📋 来源表：');
console.log(JSON.stringify(result.sourceTables, null, 2));

console.log('\n📥 目标表：');
console.log(JSON.stringify(result.targetTables, null, 2));

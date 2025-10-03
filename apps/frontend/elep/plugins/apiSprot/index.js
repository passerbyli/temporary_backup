const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { insert } = require('../../electron/db/crud'); // 你已有的插入函数路径

const CONFIG = {
  env: 'test',
  dbName: 'pg1',
  schema: 'ads_dl',
  listTable: 'jianshu_list',
  detailTable: 'jianshu_detail',
  listApi: 'http://localhost:3000/api/list',
  detailApi: 'http://localhost:3000/api/detail/',
  pageSize: 50,
};

const syncBatchTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

function stringifyFields(obj) {
  const result = {};
  for (const k in obj) {
    const val = obj[k];
    result[k] = typeof val === 'object' && val !== null ? JSON.stringify(val) : val;
  }
  return result;
}

async function main() {
  let page = 1;
  while (true) {
    const { data } = await axios.get(CONFIG.listApi, {
      params: { page, pageSize: CONFIG.pageSize },
    });

    const items = data?.data || [];
    if (!items.length) break;

    for (const item of items) {
      const id = item.id;
      if (!id) continue;

      const listRecord = {
        ...stringifyFields(item),
        uuid: uuidv4(),
        env: CONFIG.env,
        sync_batch_time: syncBatchTime,
      };
      await insert(CONFIG.dbName, CONFIG.schema, CONFIG.listTable, listRecord);

      try {
        const detailRes = await axios.get(CONFIG.detailApi + id);
        const detail = detailRes?.data?.data;
        if (!detail) continue;

        const detailRecord = {
          ...stringifyFields(detail),
          id,
          uuid: uuidv4(),
          env: CONFIG.env,
          sync_batch_time: syncBatchTime,
        };
        await insert(CONFIG.dbName, CONFIG.schema, CONFIG.detailTable, detailRecord);

        console.log(`✅ 同步成功 ID=${id}`);
      } catch (err) {
        console.warn(`⚠️ 拉取详情失败 ID=${id}`, err.message);
      }
    }

    if (items.length < CONFIG.pageSize) break;
    page++;
  }

  console.log(`🎉 ${CONFIG.env} 同步完成`);
}

main().catch((err) => {
  console.error('❌ 爬虫执行失败：', err);
});

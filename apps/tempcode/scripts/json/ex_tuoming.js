// 随机生成 100 内的随机数
/**
 * 脱敏规则
 * @returns
 */

function getRandomAmount() {
  return Math.floor(Math.random() * 100) + 1;
}

// 主函数，处理对象数组
function processData(data) {
  return data.map((item) => {
    // 规则 1：匹配 name 或 note 中包含[新芒，xinmang，星芒，xingmang，xin_mang]，但不包含 [id, code, number]
    const nameNote = item.name + item.note;
    if (
      /[新芒|xinmang|星芒|xingmang|xin_mang]/.test(nameNote) &&
      !/[id|code|number]/.test(nameNote)
    ) {
      item._name = `name_${item.id}`;
    }

    // 规则 2：匹配 name 或 note 中包含 [合同，contract]，但不包含 [编号，id, code, number]
    if (
      /[合同|contract]/.test(nameNote) &&
      !/[编号|id|code|number]/.test(nameNote)
    ) {
      item._contract = `contract_${item.id}`;
    }

    // 规则 3：匹配 name 或 note 中包含 [金额，amount]，但不包含 [占比，同比]
    if (/[金额|amount]/.test(nameNote) && !/[占比|同比]/.test(nameNote)) {
      item._amount = `amount_${getRandomAmount()}`;
    }

    return item;
  });
}

// 测试数据
const data = [
  {
    id: 1,
    brand_id: 49,
    name: "银色星芒刺绣网纱底裤",
    keywords: "银色星芒刺绣网纱底裤",
    note: "银色星芒刺绣网纱底裤",
  },
  {
    id: 1,
    brand_id: 49,
    name: "销售合同",
    keywords: "银色星芒刺绣网纱底裤",
    note: "销售合同",
  },
  {
    id: 1,
    brand_id: 49,
    name: "销售合同编号",
    keywords: "银色星芒刺绣网纱底裤",
    note: "销售合同编号",
  },
];

// 处理数据
const processedData = processData(data);

console.log(JSON.stringify(processedData, null, 2));

const _ = require("lodash");

let sortArr = ["战略", "核心", "价值"];
let sortArr2 = ["金融", "纺织", "钢铁"];
let list = [
  { name: "价值", value: "1", category: "钢铁" },
  { name: "核心", value: "2", category: "纺织" },
  { name: "价值", value: "3", category: "钢铁" },
  { name: "价值", value: "4", category: "纺织" },
  { name: "核心", value: "5", category: "金融" },
  { name: "价值", value: "6", category: "钢铁" },
  { name: "战略", value: "7", category: "钢铁" },
  { name: "核心", value: "8", category: "纺织" },
  { name: "价值", value: "9", category: "金融" },
  { name: "战略", value: "10", category: "纺织" },
];

// 创建映射对象
const namePriority = _.reduce(
  sortArr,
  (result, name, index) => {
    result[name] = index;
    return result;
  },
  {}
);

const categoryPriority = _.reduce(
  sortArr2,
  (result, category, index) => {
    result[category] = index;
    return result;
  },
  {}
);

// 使用 _.orderBy 按照 name 和 category 的优先级排序
const sortedList = _.orderBy(
  list,
  [
    (item) => namePriority[item.name] || Infinity, // 按 name 的优先级
    (item) => categoryPriority[item.category] || Infinity, // 按 category 的优先级
  ],
  ["asc", "asc"] // 升序排序
);

console.log(sortedList);

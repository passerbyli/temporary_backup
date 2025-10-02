// npm i xlsx
const XLSX = require("xlsx");

/**
 * columns 配置支持三种写法：
 * 1) 'id'                      // 按原字段，表头同 key
 * 2) { key: 'id', title: 'ID' } // 重命名表头
 * 3) { key: 'user.name', title: '用户名', map: v => String(v).toUpperCase() } // 嵌套&映射
 */
function exportByColumns(
  dataArray,
  columns,
  filePath,
  sheetName = "Sheet1",
  colWidths = []
) {
  // 1) 规范化 columns
  const cols = columns.map((c) =>
    typeof c === "string" ? { key: c, title: c } : c
  );

  // 2) 头部
  const header = cols.map((c) => c.title || c.key);

  // 3) 安全取值（支持 a.b.c）
  const getByPath = (obj, path) => {
    if (!path) return undefined;
    return path
      .split(".")
      .reduce((o, k) => (o == null ? undefined : o[k]), obj);
  };

  // 4) 组装二维数组（AOA）
  const rows = dataArray.map((row) => {
    return cols.map((c) => {
      const raw = getByPath(row, c.key);
      const mapped = typeof c.map === "function" ? c.map(raw, row) : raw;
      // 处理 null/undefined
      return mapped == null ? "" : mapped;
    });
  });

  // 5) AOA -> Sheet，首行是 header
  const aoa = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 6) 列宽（可选）：传入字符宽度数组，如 [10, 20, 12]
  if (Array.isArray(colWidths) && colWidths.length) {
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  }

  // 7) 生成工作簿并写文件
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);
}

/** ======== 使用示例 ======== */
const data = [
  {
    id: 1,
    user: { name: "Alice" },
    age: 28,
    createdAt: "2025-09-10T10:20:00Z",
  },
  { id: 2, user: { name: "Bob" }, age: 31, createdAt: "2025-09-11T03:15:00Z" },
];

const columns = [
  { key: "id", title: "编号" },
  { key: "user.name", title: "姓名", map: (v) => v || "" },
  { key: "age", title: "年龄" },
  {
    key: "createdAt",
    title: "创建时间",
    map: (v) =>
      v ? new Date(v).toISOString().slice(0, 19).replace("T", " ") : "",
  },
];

exportByColumns(data, columns, "./导出示例.xlsx", "用户清单", [8, 16, 8, 20]);

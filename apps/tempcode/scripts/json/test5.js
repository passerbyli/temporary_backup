const fs = require("fs");

// 定义数据
const sheet = [
  "草稿",
  "评审",
  "概设",
  "开发中",
  "开发完成",
  "sit测试中",
  "sit测试完成",
  "UAT测试",
  "UAT完成",
  "待上线",
  "完成",
];

const stage = {
  开发: ["草稿", "评审", "概设", "开发中", "开发完成"],
  测试: ["sit测试中", "sit测试完成", "UAT测试", "UAT完成"],
  待上线: ["待上线"],
  完成: ["完成"],
};

// 读取 list.json
const loadList = () => {
  try {
    return JSON.parse(fs.readFileSync("list.json", "utf8"));
  } catch (err) {
    console.error("读取 list.json 文件失败:", err);
    return [];
  }
};

// 保存更新的 list.json
const saveList = (list) => {
  try {
    fs.writeFileSync("list.json", JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.error("保存 list.json 文件失败:", err);
  }
};

// 打印日志
const logUpdate = (task, newSheetName, newStatus) => {
  console.log(
    `${task.id}, ${task.name}, ${task.sheetName}, ${task.status}, ${newSheetName}, ${newStatus}`
  );
};

// 更新任务状态
const updateTask = (task, role) => {
  const { status, sheetName } = task;

  if (role === "开发") {
    if (status === "开发") {
      const currentStage = stage.开发;
      const currentIndex = currentStage.indexOf(sheetName);
      if (currentIndex !== -1 && currentIndex + 1 < currentStage.length) {
        // 更新到开发阶段的下一个版列
        const newSheetName = currentStage[currentIndex + 1];
        logUpdate(task, newSheetName, status);
        task.sheetName = newSheetName;
        return true;
      }
    }
    return false; // 不在开发阶段，跳过
  }

  if (role === "测试") {
    if (status === "开发" && sheetName === "开发完成") {
      // 跨阶段：开发 -> 测试阶段的第一步
      const newSheetName = stage.测试[0];
      const newStatus = "测试";
      logUpdate(task, newSheetName, newStatus);
      task.sheetName = newSheetName;
      task.status = newStatus;
      return true;
    } else if (status === "测试") {
      const currentStage = stage.测试;
      const currentIndex = currentStage.indexOf(sheetName);
      if (currentIndex !== -1 && currentIndex + 1 < currentStage.length) {
        // 更新到阶段的下一个版列
        const newSheetName = currentStage[currentIndex + 1];
        logUpdate(task, newSheetName, status);
        task.sheetName = newSheetName;
        return true;
      }
    }
    return false; // 不在测试阶段，跳过
  }

  return false; // 未指定规则，跳过
};

// 主逻辑
const runScript = (role) => {
  const list = loadList();

  // 遍历任务列表，每个任务更新
  list.forEach((task) => {
    updateTask(task, role);
  });

  saveList(list);
};

// 执行脚本
runScript("开发"); // 或 '测试'

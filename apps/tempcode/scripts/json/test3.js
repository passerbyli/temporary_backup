const fs = require("fs");
const path = require("path");

// list.json 文件路径
const listFilePath = path.join(__dirname, "list.json");

let stage = {
  开发: ["草稿", "评审", "概设", "开发中", "开发完成"],
  测试: ["sit测试中", "sit测试完成", "UAT测试", "UAT完成"],
  待上线: ["待上线"],
  完成: ["完成"],
};

// 工具函数：格式化日期为 YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

// 读取任务列表
function readList() {
  try {
    const data = fs.readFileSync(listFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("读取 list.json 文件失败:", error);
    return [];
  }
}

// 写入任务列表
function writeList(list) {
  try {
    fs.writeFileSync(listFilePath, JSON.stringify(list, null, 2), "utf8");
  } catch (error) {
    console.error("写入 list.json 文件失败:", error);
  }
}

// 打印日志
function logUpdate(task, oldSheet, newSheet) {
  const now = new Date().toISOString().replace("T", " ").split(".")[0]; // 格式化日期时间
  const logMessage = `[${now}] taskid: ${task.id}：${task.name} 版列由 ${oldSheet} 更新为 ${newSheet}，状态为：${task.status}`;
  console.log(logMessage);

  // 写入日志文件
  const logFilePath = path.join(__dirname, "update.log");
  fs.appendFileSync(logFilePath, logMessage + "\n", "utf8");
}

// 更新任务列表
function updateTask(role) {
  const today = formatDate(new Date()); // 当前日期（只取日期部分）
  let list = readList(); // 读取任务列表
  const updatedTasks = new Set(); // 用于标记已处理的任务

  list.forEach((task) => {
    const turnTestDate = formatDate(new Date(task.turn_test));
    const testEndDate = formatDate(new Date(task.test_end));
    let oldSheet = task.sheetName;

    if (role === "开发人员") {
      // 开发人员逻辑
      if (
        !updatedTasks.has(task.id) && // 确保任务未被处理
        task.status === "开发" &&
        turnTestDate <= today &&
        task.sheetName !== "开发完成"
      ) {
        const stageList = stage.开发;
        const currentIndex = stageList.indexOf(task.sheetName);
        if (currentIndex !== -1 && currentIndex < stageList.length - 1) {
          task.sheetName = stageList[currentIndex + 1]; // 更新版列
          logUpdate(task, oldSheet, task.sheetName); // 打印日志
          updatedTasks.add(task.id); // 标记任务已处理
        }
      }
    } else if (role === "测试人员") {
      // 测试人员逻辑
      if (!updatedTasks.has(task.id)) {
        if (
          // 第一阶段：处理从 "开发完成" 转到 "测试" 的任务
          task.sheetName === "开发完成" &&
          turnTestDate <= today
        ) {
          const stageList = stage.测试;
          const currentIndex = stage.开发.indexOf(task.sheetName);
          if (currentIndex !== -1) {
            task.sheetName = stageList[0]; // 更新版列
            task.status = "测试"; // 更新状态
            logUpdate(task, oldSheet, task.sheetName); // 打印日志
            updatedTasks.add(task.id); // 标记任务已处理
          }
        } else if (
          // 第二阶段：推进测试状态下的版列
          task.status === "测试" &&
          testEndDate <= today &&
          task.sheetName !== "UAT完成"
        ) {
          const stageList = stage.测试;
          const currentIndex = stageList.indexOf(task.sheetName);
          if (currentIndex !== -1 && currentIndex < stageList.length - 1) {
            task.sheetName = stageList[currentIndex + 1]; // 更新版列
            logUpdate(task, oldSheet, task.sheetName); // 打印日志
            updatedTasks.add(task.id); // 标记任务已处理
          }
        }
      }
    }
  });

  // 保存更新后的列表
  writeList(list);
}

// 定时器每五分钟执行一次
// setInterval(() => {
//   updateTask("开发人员"); // 更新开发人员任务
//   updateTask("测试人员"); // 更新测试人员任务
//   console.log("任务更新完成");
// }, 300000); // 5 分钟
// updateTask("测试人员");

updateTask("开发人员");

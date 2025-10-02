
let list = [
  { name: '1', status: '开发完成', transferTime: '2025-06-27',testCompletionTime:'2025-06-28' },
  { name: '1', status: '开发完成', transferTime: '2025-06-28',testCompletionTime:'2025-06-29' },
  { name: '1', status: '开发完成', transferTime: '2025-06-28',testCompletionTime:'2025-06-29' },
  { name: '1', status: '开发完成', transferTime: '2025-06-24',testCompletionTime:'2025-06-26' },
  { name: '1', status: '开发测试', transferTime: '2025-06-26',testCompletionTime:'2025-06-29' },
  { name: '1', status: '开发完成', transferTime: '2025-06-27',testCompletionTime:'2025-06-29' }
]
let devStatus=["草稿", "评审", "概设", "开发中", "开发完成"]
let testStatus=["开发完成","sit测试中", "sit测试完成", "UAT测试", "UAT完成"]
let toBeLaunchedStatus=["待上线"]
let finishStatus = ["完成"]




如果角色为【开发】，
1.按照transferTime顺序排列
2.小于等于当天且status为devStatus里的值排前面，并根据状态位置附加不同颜色。
3.status不为devStatus里的值时排最后。

如果角色为【测试】
1.按照testCompletionTime顺序排列
2.小于等于当天且status为testStatus里的值排前面，并根据状态位置附加不同颜色。
3.status为toBeLaunchedStatus和finishStatus里的值时排最后。
const list = [
  { name: '1', status: '开发完成', transferTime: '2025-06-27', testCompletionTime: '2025-06-28' },
  { name: '1', status: '开发完成', transferTime: '2025-06-28', testCompletionTime: '2025-06-29' },
  { name: '1', status: '开发完成', transferTime: '2025-06-28', testCompletionTime: '2025-06-29' },
  { name: '1', status: '开发完成', transferTime: '2025-06-24', testCompletionTime: '2025-06-26' },
  { name: '1', status: '开发测试', transferTime: '2025-06-26', testCompletionTime: '2025-06-29' },
  { name: '1', status: '开发完成', transferTime: '2025-06-27', testCompletionTime: '2025-06-29' },
]

const devStatus = ['草稿', '评审', '概设', '开发中', '开发完成']
const testStatus = ['开发完成', 'sit测试中', 'sit测试完成', 'UAT测试', 'UAT完成']
const toBeLaunchedStatus = ['待上线']
const finishStatus = ['完成']

// 颜色列表（可自定义）
const statusColors = ['gray', 'blue', 'orange', 'purple', 'green']

function processList(list, role) {
  const today = new Date().toISOString().slice(0, 10)

  let statusList, sortKey, excludeStatus

  if (role === '开发') {
    statusList = devStatus
    sortKey = 'transferTime'
    excludeStatus = [] // 不特别排除其他状态
  } else if (role === '测试') {
    statusList = testStatus
    sortKey = 'testCompletionTime'
    excludeStatus = [...toBeLaunchedStatus, ...finishStatus]
  } else {
    return list // 未知角色原样返回
  }

  // 加工 list 增加颜色、优先级信息
  const result = list.map((item) => {
    const statusIndex = statusList.indexOf(item.status)
    const dateValue = item[sortKey]
    const isPast = dateValue <= today
    const isIncluded = statusIndex >= 0

    let order = 999
    if (isIncluded && isPast) order = 0
    else if (isIncluded) order = 1
    else if (excludeStatus.includes(item.status)) order = 9
    else order = 5

    const color = isIncluded ? statusColors[statusIndex] : 'default'

    return {
      ...item,
      _order: order,
      _color: color,
      _sortTime: dateValue,
    }
  })

  // 排序
  return result.sort((a, b) => {
    if (a._order !== b._order) return a._order - b._order
    return a._sortTime.localeCompare(b._sortTime)
  })
}
const devView = processList(list, '开发')
console.log('【开发视图】', devView)

// const testView = processList(list, '测试')
// console.log('【测试视图】', testView)
const XLSX = require('xlsx')
const path = require('path')

// 模拟数据（可替换为实际数据源）
const mockData = [
  { title: '张三', col1: 'A1', col2: 'B1', col3: 'C1', col4: 'D1', col5: 'E1' },
  { title: '李四', col1: 'A2', col2: 'B2', col3: 'C2', col4: 'D2', col5: 'E2' },
  { title: '张三', col1: 'A3', col2: 'B3', col3: 'C3', col4: 'D3', col5: 'E3' },
]

function processExcel(inputFilePath, outputFilePath) {
  try {
    // 读取 Excel 文件
    const workbook = XLSX.readFile(inputFilePath)

    // 获取“明细”页签
    const detailSheetName = '明细'
    const detailSheet = workbook.Sheets[detailSheetName]
    if (!detailSheet) {
      throw new Error('未找到“明细”页签')
    }

    // 转换“明细”页签为二维数组
    const detailData = XLSX.utils.sheet_to_json(detailSheet, { header: 1 })

    // 获取标题列索引
    const headerRow = detailData[0]
    const titleColumnIndex = headerRow.indexOf('标题')
    if (titleColumnIndex === -1) {
      throw new Error('“明细”页签未找到“标题”字段')
    }

    // 检查并新增“链接”列
    let linkColumnIndex = headerRow.indexOf('链接')
    if (linkColumnIndex === -1) {
      linkColumnIndex = headerRow.length
      detailData[0].push('链接')
    }

    // 遍历“明细”数据，生成 Sheet 页并添加/更新链接
    for (let i = 1; i < detailData.length; i++) {
      const row = detailData[i]
      const title = row[titleColumnIndex]
      if (!title) continue

      // 检查是否已有对应 Sheet 页
      let sheetName = title
      let sheetExists = !!workbook.Sheets[sheetName]

      if (!sheetExists) {
        // 如果 Sheet 不存在，创建新的 Sheet 页
        const newSheetData = [['col1', 'col2', 'col3', 'col4', 'col5']] // 表头
        const newSheet = XLSX.utils.aoa_to_sheet(newSheetData)
        XLSX.utils.book_append_sheet(workbook, newSheet, sheetName)
      }

      // 获取或更新指定 Sheet 页
      const targetSheet = workbook.Sheets[sheetName]
      const filteredData = mockData.filter((item) => item.title === title) // 根据标题过滤数据

      // 填充数据到 Sheet 页（保留表头）
      const existingSheetData = XLSX.utils.sheet_to_json(targetSheet, {
        header: 1,
      })
      const updatedSheetData =
        existingSheetData.length > 0
          ? existingSheetData
          : [['col1', 'col2', 'col3', 'col4', 'col5']]
      filteredData.forEach((item) => {
        updatedSheetData.push([item.col1, item.col2, item.col3, item.col4, item.col5])
      })

      // 写回 Sheet 页数据
      const updatedSheet = XLSX.utils.aoa_to_sheet(updatedSheetData)
      workbook.Sheets[sheetName] = updatedSheet

      // 在第 1 行最后一列添加返回首页链接
      const colCount = updatedSheetData[0].length
      XLSX.utils.sheet_add_aoa(
        updatedSheet,
        [[{ t: 's', v: '首页', l: { Target: `#${detailSheetName}!A1` } }]],
        {
          origin: { r: 0, c: colCount },
        },
      )

      // 在“明细”页新增/更新链接
      const link = `#${sheetName}!A1`
      row[linkColumnIndex] = { t: 's', v: sheetName, l: { Target: link } }
    }

    // 将更新的“明细”数据写回原 Sheet
    const updatedDetailSheet = XLSX.utils.aoa_to_sheet(detailData)
    workbook.Sheets[detailSheetName] = updatedDetailSheet

    // 保存新的 Excel 文件
    XLSX.writeFile(workbook, outputFilePath)
    console.log(`处理完成，文件已保存至：${outputFilePath}`)
  } catch (error) {
    console.error('处理 Excel 文件时发生错误：', error.message)
  }
}

const date = new Date()
// 示例使用
const inputFilePath = path.join(__dirname, 'a_test.xlsx') // 输入文件路径
const outputFilePath = path.join(__dirname, `output_${date.getTime()}.xlsx`)
processExcel(inputFilePath, outputFilePath)

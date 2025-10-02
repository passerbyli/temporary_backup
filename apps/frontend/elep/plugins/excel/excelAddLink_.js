const fs = require('fs')
const path = require('path')
const xlsx = require('sheetjs-style')

// 模拟数据（可替换为实际数据源）
const mockData = [
  { title: '张三', col1: 'A1', col2: 'B1', col3: 'C1', col4: 'D1', col5: 'E1' },
  { title: '李四', col1: 'A2', col2: 'B2', col3: 'C2', col4: 'D2', col5: 'E2' },
  { title: '张三', col1: 'A3', col2: 'B3', col3: 'C3', col4: 'D3', col5: 'E3' },
]

function processExcel(inputFilePath, outputFilePath) {
  try {
    // 读取原始 Excel 文件
    const workbook = xlsx.readFile(inputFilePath)

    // 获取“明细”页签
    const detailSheetName = '明细'
    const detailSheet = workbook.Sheets[detailSheetName]
    if (!detailSheet) {
      throw new Error('未找到“明细”页签')
    }

    const detailData = xlsx.utils.sheet_to_json(detailSheet, { header: 1 })

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

    // 用于记录已创建的 sheet 页
    const createdSheets = {}

    // 遍历“明细”数据，生成 Sheet 页并添加链接
    for (let i = 1; i < detailData.length; i++) {
      const row = detailData[i]
      console.log(row)
      const title = row[titleColumnIndex]
      if (!title) continue

      // 如果 Sheet 不存在，创建新的 Sheet
      if (!createdSheets[title]) {
        createdSheets[title] = true

        // 创建新的 Sheet 数据
        const filteredData = mockData.filter((item) => item.title === title)

        // 初始化新 Sheet 数据（添加表头）
        const newSheetData = [['col1', 'col2', 'col3', 'col4', 'col5']] // 表头
        filteredData.forEach((item) => {
          newSheetData.push([item.col1, item.col2, item.col3, item.col4, item.col5])
        })

        // 为新 Sheet 页添加“首页”链接
        const lastRowIndex = newSheetData.length - 1
        newSheetData[lastRowIndex].push({
          v: '首页',
          l: { Target: `#${detailSheetName}!A1` }, // 在最后一列添加“首页”链接
          s: { font: { bold: true, color: { rgb: '0000FF' } } }, // 设置样式（蓝色、加粗）
        })

        // 将新的 sheet 页加入工作簿
        workbook.Sheets[title] = xlsx.utils.aoa_to_sheet(newSheetData)
      }

      // 更新“明细”页中的链接列
      const link = `#${title}!A1`
      row[linkColumnIndex] = { v: title, l: { Target: link } }
    }

    // 将“明细”页更新后的数据写回
    const updatedDetailSheet = xlsx.utils.aoa_to_sheet(detailData)
    // workbook.Sheets[detailSheetName] = updatedDetailSheet;

    // 保存新的 Excel 文件
    const timestamp = new Date().toISOString().replace(/[:\-T\.]/g, '')
    const outputFileWithTimestamp = path.join(__dirname, `output_${timestamp}.xlsx`)
    xlsx.writeFile(workbook, outputFileWithTimestamp)
    console.log(`处理完成，文件已保存至：${outputFileWithTimestamp}`)
  } catch (error) {
    console.error('处理 Excel 文件时发生错误：', error.message)
  }
}

// 示例使用
// const inputFilePath = path.join(__dirname, "a_test.xlsx"); // 输入文件路径
// processExcel(inputFilePath);

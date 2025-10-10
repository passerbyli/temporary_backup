// const xlsx = require('xlsx')
// const ExcelJS = require('exceljs')
// const nodeXlsx = require('node-xlsx')
// const sheetJsStyle = require('sheetjs-style')
// const XlsxPopulate = require('xlsx-populate')

// /**
//  * 根据指定库读取 Excel 文件
//  * @param {string} library - 库名称，可选值：'xlsx', 'exceljs', 'node-xlsx', 'sheetjs-style', 'xlsx-populate'
//  * @param {string} filePath - 文件路径
//  * @param {object} options - 配置选项
//  * @param {string} [options.sheetName] - 指定 sheet 名称
//  * @param {number} [options.sheetIndex] - 指定 sheet 索引
//  * @param {boolean} [options.useActiveSheet] - 是否使用激活 sheet
//  * @param {string[]} [options.columns] - 需要筛选的列名
//  * @returns {Promise<object[]>} - 返回解析后的 JSON 数据
//  */
// async function readExcel(library, filePath, options = {}) {
//   switch (library) {
//     case 'xlsx':
//       return readWithXlsx(filePath, options)
//     case 'exceljs':
//       return readWithExceljs(filePath, options)
//     case 'node-xlsx':
//       return readWithNodeXlsx(filePath, options)
//     case 'sheetjs-style':
//       return readWithSheetjsStyle(filePath, options)
//     case 'xlsx-populate':
//       return readWithXlsxPopulate(filePath, options)
//     default:
//       throw new Error('Unsupported library')
//   }
// }

// // 使用 xlsx 库读取文件
// function readWithXlsx(filePath, options) {
//   const workbook = xlsx.readFile(filePath, {
//     cellFormula: true,
//     cellText: true,
//     cellDates: true
//   })
//   const sheet = getTargetSheetXlsx(workbook, options)
//   const data = xlsx.utils.sheet_to_json(sheet, { raw: false })
//   return filterColumns(data, options.columns)
// }

// // 使用 exceljs 库读取文件
// async function readWithExceljs(filePath, options) {
//   const workbook = new ExcelJS.Workbook()
//   await workbook.xlsx.readFile(filePath)
//   const sheet = getTargetSheetExceljs(workbook, options)

//   const data = []
//   sheet.eachRow((row, rowIndex) => {
//     if (rowIndex === 1) return // 跳过表头
//     const rowData = {}
//     row.eachCell((cell, colIndex) => {
//       const header = sheet.getRow(1).getCell(colIndex).value
//       rowData[header] = cell.value
//     })
//     data.push(rowData)
//   })

//   return filterColumns(data, options.columns)
// }

// // 使用 node-xlsx 库读取文件
// function readWithNodeXlsx(filePath, options) {
//   const workbook = nodeXlsx.parse(filePath)
//   const sheet = getTargetSheetNodeXlsx(workbook, options)
//   const rows = sheet.data

//   const headers = rows[0]
//   const data = rows.slice(1).map(row =>
//     headers.reduce((acc, header, index) => {
//       acc[header] = row[index]
//       return acc
//     }, {})
//   )

//   return filterColumns(data, options.columns)
// }

// // 使用 sheetjs-style 库读取文件
// function readWithSheetjsStyle(filePath, options) {
//   const workbook = sheetJsStyle.readFile(filePath, {
//     cellFormula: true,
//     cellText: true,
//     cellDates: true
//   })
//   const sheet = getTargetSheetXlsx(workbook, options)
//   const data = sheetJsStyle.utils.sheet_to_json(sheet, { raw: false })
//   return filterColumns(data, options.columns)
// }

// // 使用 xlsx-populate 库读取文件
// async function readWithXlsxPopulate(filePath, options) {
//   const workbook = await XlsxPopulate.fromFileAsync(filePath)
//   const sheet = getTargetSheetXlsxPopulate(workbook, options)

//   const rows = sheet.usedRange().value()
//   const headers = rows[0]
//   const data = rows.slice(1).map(row =>
//     headers.reduce((acc, header, index) => {
//       acc[header] = row[index]
//       return acc
//     }, {})
//   )

//   return filterColumns(data, options.columns)
// }

// // 根据配置获取目标 sheet - xlsx 和 sheetjs-style 通用
// function getTargetSheetXlsx(workbook, { sheetName, sheetIndex, useActiveSheet }) {
//   if (useActiveSheet && workbook.Workbook?.WBProps?.activeTab !== undefined) {
//     return workbook.Sheets[workbook.SheetNames[workbook.Workbook.WBProps.activeTab]]
//   }
//   if (sheetName) {
//     return workbook.Sheets[sheetName]
//   }
//   if (typeof sheetIndex === 'number') {
//     return workbook.Sheets[workbook.SheetNames[sheetIndex]]
//   }
//   return workbook.Sheets[workbook.SheetNames[0]] // 默认第一个 Sheet
// }

// // 根据配置获取目标 sheet - exceljs
// function getTargetSheetExceljs(workbook, { sheetName, sheetIndex, useActiveSheet }) {
//   if (useActiveSheet) {
//     return workbook.getWorksheet(workbook.views[0].activeTab + 1)
//   }
//   if (sheetName) {
//     return workbook.getWorksheet(sheetName)
//   }
//   if (typeof sheetIndex === 'number') {
//     return workbook.worksheets[sheetIndex]
//   }
//   return workbook.worksheets[0] // 默认第一个 Sheet
// }

// // 根据配置获取目标 sheet - node-xlsx
// function getTargetSheetNodeXlsx(workbook, { sheetName, sheetIndex }) {
//   if (sheetName) {
//     return workbook.find(sheet => sheet.name === sheetName)
//   }
//   if (typeof sheetIndex === 'number') {
//     return workbook[sheetIndex]
//   }
//   return workbook[0] // 默认第一个 Sheet
// }

// // 根据配置获取目标 sheet - xlsx-populate
// function getTargetSheetXlsxPopulate(workbook, { sheetName, sheetIndex, useActiveSheet }) {
//   if (useActiveSheet) {
//     return workbook.activeSheet()
//   }
//   if (sheetName) {
//     return workbook.sheets().find(sheet => sheet.name() === sheetName)
//   }
//   if (typeof sheetIndex === 'number') {
//     return workbook.sheets()[sheetIndex]
//   }
//   return workbook.sheet(0) // 默认第一个 Sheet
// }

// // 筛选指定列的数据
// function filterColumns(data, columns) {
//   if (!Array.isArray(columns) || columns.length === 0) return data
//   return data.map(row =>
//     columns.reduce((filteredRow, column) => {
//       filteredRow[column] = row[column] || ''
//       return filteredRow
//     }, {})
//   )
// }

// function exportToExcelFile(list, headers, outputPath) {
//   if (!Array.isArray(list) || !Array.isArray(headers)) {
//     throw new Error('list 和 headers 必须是数组')
//   }

//   const filteredHeaders = headers.filter(h => h.export !== false)
//   const sheetData = [filteredHeaders.map(h => h.title || h.key)]
//   const linkCells = {}

//   list.forEach((row, rowIndex) => {
//     const sheetRow = []

//     filteredHeaders.forEach((h, colIndex) => {
//       let val = row[h.key]
//       if (h.type === 'date' && val) {
//         val = new Date(val).toISOString().slice(0, 10)
//       } else if (h.type === 'number') {
//         val = Number(val)
//       } else {
//         val = val != null ? String(val) : ''
//       }

//       sheetRow.push(val)

//       if (h.link && row[h.linkKey]) {
//         const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex })
//         linkCells[cellRef] = {
//           l: { Target: row[h.linkKey] }
//         }
//       }
//     })

//     sheetData.push(sheetRow)
//   })

//   const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
//   Object.entries(linkCells).forEach(([cell, link]) => {
//     worksheet[cell].l = link.l
//   })

//   const workbook = XLSX.utils.book_new()
//   XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

//   XLSX.writeFile(workbook, outputPath)
//   console.log(`✅ Excel 导出成功：${outputPath}`)
// }

// module.exports = { exportToExcelFile, readExcel }

// const inputFilePath = path.join(__dirname, 'a_test.xlsx') // 输入文件路径

// // let res = readExcel('xlsx', inputFilePath, {
// //   useActiveSheet: true
// //   //   sheetIndex: 0,
// //   //   columns: ["标题"],
// // })
// // console.log(res)

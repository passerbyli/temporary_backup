const ExcelJS = require("exceljs");
const fs = require("fs");

class ExcelReader {
  constructor(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    this.filePath = filePath;
    this.workbook = new ExcelJS.Workbook();
  }

  async load() {
    await this.workbook.xlsx.readFile(this.filePath);
  }

  getSheetNames() {
    return this.workbook.worksheets.map((ws) => ws.name);
  }

  getHeaders(sheetName) {
    const sheet = this.workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`未找到 Sheet：${sheetName}`);

    const headerRow = sheet.getRow(1);
    const headers = [];

    headerRow.eachCell((cell, colNumber) => {
      const column = sheet.getColumn(colNumber);
      headers.push({
        header: this._getCellPlainText(cell),
        col: colNumber,
        width: column.width || null,
      });
    });

    return headers;
  }

  sheetToJson(sheetName) {
    const sheet = this.workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`未找到 Sheet：${sheetName}`);

    const headers = this.getHeaders(sheetName).map((h) => h.header);
    const data = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const item = {};
      row.eachCell((cell, colIndex) => {
        const header = headers[colIndex - 1];
        item[header] = this._getCellPlainText(cell);
      });

      data.push(item);
    });

    return data;
  }

  getAllSheetsJson() {
    const result = {};
    this.getSheetNames().forEach((sheetName) => {
      result[sheetName] = this.sheetToJson(sheetName);
    });
    return result;
  }

  /**
   * 获取单元格纯文本，兼容 richText / 公式 / 普通值
   * @param {ExcelJS.Cell} cell
   * @returns {string|any}
   */
  _getCellPlainText(cell) {
    const val = cell.value;

    if (!val) return "";
    if (typeof val === "object") {
      if (val.richText) {
        return val.richText.map((rt) => rt.text).join("");
      }
      if (val.formula && val.result !== undefined) {
        return val.result;
      }
      if (val.text) return val.text; // 超链接
    }

    return val;
  }

  getCellStyle(sheetName, rowIndex, colIndex) {
    const sheet = this.workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`未找到 Sheet：${sheetName}`);

    const row = sheet.getRow(rowIndex);
    const cell = row.getCell(colIndex);

    return {
      font: cell.font || {},
      alignment: cell.alignment || {},
      border: cell.border || {},
      fill: cell.fill || {},
      numFmt: cell.numFmt || null,
      style: cell.style || {},
    };
  }
}

module.exports = ExcelReader;

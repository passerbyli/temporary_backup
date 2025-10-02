const ExcelJS = require("exceljs");
const fs = require("fs");

class ExcelWriter {
  constructor() {
    this.workbook = new ExcelJS.Workbook();
  }

  /**
   * 添加 Sheet（支持多次调用，支持同名覆盖）
   * @param {Array} sheets - Sheet 配置数组，每项包含：
   * {
   *   name: 'Sheet名称',
   *   data: [ { ... } ],  // JSON数组
   *   columns: [ // 可选，配置表头字段
   *     {
   *       key: '字段名',
   *       header: '表头名',
   *       width: 20,
   *       filter: true,
   *       headerBgColor: 'FFFFCC',
   *       headerFontColor: 'FF0000',
   *       highlightKeywords: true,
   *       keywords: ['CREATE', 'TABLE'],
   *       fontColor: 'FF0000',
   *       fontBold: true
   *     }
   *   ]
   * }
   */
  addSheets(sheets = []) {
    for (const sheetConfig of sheets) {
      const { name, data, columns } = sheetConfig;
      const sheetName = name || "Sheet";

      // 删除旧的同名 Sheet
      const existingSheet = this.workbook.getWorksheet(sheetName);
      if (existingSheet) this.workbook.removeWorksheet(existingSheet.id);

      const ws = this.workbook.addWorksheet(sheetName);
      let finalColumns = [];

      // 自动生成字段
      if (!columns || columns.length === 0) {
        const sample = data[0] || {};
        finalColumns = Object.keys(sample).map((key) => ({ key, header: key }));
      } else {
        finalColumns = columns;
      }

      // 设置列定义
      ws.columns = finalColumns.map((col) => ({
        key: col.key,
        header: col.header || col.key,
        width: col.width || 15,
      }));

      // 设置筛选
      const filterEnabled = finalColumns.some((col) => col.filter);
      if (filterEnabled && ws.columns.length > 0) {
        const endCol = String.fromCharCode(64 + ws.columns.length);
        ws.autoFilter = {
          from: "A1",
          to: `${endCol}1`,
        };
      }

      // 设置表头样式
      const headerRow = ws.getRow(1);
      finalColumns.forEach((col, colIndex) => {
        const cell = headerRow.getCell(colIndex + 1);
        cell.font = {
          color: col.headerFontColor
            ? { argb: col.headerFontColor }
            : undefined,
          bold: true,
        };
        if (col.headerBgColor) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: col.headerBgColor },
          };
        }
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      headerRow.commit();

      // 写入数据行（支持高亮关键词）
      data.forEach((item, rowIdx) => {
        const row = ws.getRow(rowIdx + 2);
        finalColumns.forEach((col, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          const rawValue = item[col.key];

          if (!col.highlightKeywords || typeof rawValue !== "string") {
            cell.value = rawValue;
          } else {
            // 关键词高亮
            const rich = this._splitTextWithKeywords(
              rawValue,
              col.keywords || [],
              {
                color: col.fontColor || "FF0000",
                bold: col.fontBold || false,
              }
            );
            cell.value = { richText: rich };
          }

          // 样式统一设置
          cell.alignment = { wrapText: true, vertical: "top" };
        });
        row.commit();
      });
    }
  }

  /**
   * 拆分文本，构造富文本数组
   * @param {string} text 原始文本
   * @param {string[]} keywords 高亮关键词
   * @param {{color: string, bold: boolean}} style 样式
   * @returns ExcelJS.RichText[]
   */
  _splitTextWithKeywords(text, keywords, style) {
    if (!keywords || keywords.length === 0) return [{ text }];

    const regex = new RegExp(`(${keywords.join("|")})`, "gi");
    const segments = text.split(regex);

    return segments.map((seg) => {
      if (keywords.some((k) => k.toLowerCase() === seg.toLowerCase())) {
        return {
          text: seg,
          font: {
            color: { argb: style.color },
            bold: style.bold,
          },
        };
      } else {
        return { text: seg };
      }
    });
  }

  /**
   * 保存为 Excel 文件
   * @param {string} filePath
   */
  async save(filePath) {
    await this.workbook.xlsx.writeFile(filePath);
  }

  /**
   * 导出为 Buffer
   * @returns {Promise<Buffer>}
   */
  async toBuffer() {
    return await this.workbook.xlsx.writeBuffer();
  }
}

module.exports = ExcelWriter;

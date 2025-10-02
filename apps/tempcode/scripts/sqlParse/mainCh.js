const mysql = require("mysql2");
const fs = require("fs");
// const axios = require("axios");

/**
 * 数据库配置
 */
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "admin2312",
  database: "mall2",
  port: "3306",
  timezone: "+00:00",
};

/**
 * 创建数据库连接并提供连接和断开方法
 * @param {Object} dbConfig - 数据库配置对象
 * @returns {Object} - 包含数据库连接、连接和断开方法的对象
 */
function createConnection(dbConfig) {
  const connection = mysql.createConnection(dbConfig).promise();

  const connect = () => connection.connect();
  const disconnect = () => connection.end();

  return { connection, connect, disconnect };
}

/**
 * 生成带时间戳的文件名
 * @param {string} baseName - 文件基础名称
 * @returns {string} - 带时间戳的文件名
 */
function generateTimestampedFilename(baseName) {
  const timestamp =
    new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 17) +
    "." +
    new Date().getMilliseconds().toString().padStart(3, "0");
  return `${baseName}_${timestamp}.sql`;
}

/**
 * 将内容写入文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 写入的内容
 */
function writeToFile(filePath, content) {
  fs.writeFile(filePath, content, (err) => {
    if (err) throw err;
    console.log(`SQL scripts written to ${filePath}`);
  });
}

/**
 * 将值格式化为SQL兼容的格式
 * @param {any} value - 要格式化的值
 * @param {string} dataType - 数据库字段的类型
 * @returns {string} - 格式化后的值
 */
function formatValue(value, dataType) {
  if (value === null || value === undefined) {
    return "null";
  } else if (dataType === "decimal") {
    // 保留decimal类型的原始精度
    return value.toString();
  } else if (dataType === "BLOB" || dataType === "LONG_BLOB") {
    // 将 BLOB 字段转为十六进制
    return `x'${value.toString("hex")}'`;
  } else if (typeof value === "string") {
    return `'${value}'`;
  } else if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  } else {
    return value;
  }
}

/**
 * 获取指定表的主键列信息
 * @param {Object} connection - 数据库连接对象
 * @param {string} tableName - 表名称
 * @returns {Object} - 主键列及其是否为自增的信息
 */
async function getPrimaryKeyColumns(connection, tableName) {
  const query = `
        SELECT COLUMN_NAME, EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_KEY = 'PRI';
    `;
  const [rows] = await connection.query(query, [dbConfig.database, tableName]);

  const primaryKeyColumns = {};
  rows.forEach((row) => {
    primaryKeyColumns[row.COLUMN_NAME] = row.EXTRA.includes("auto_increment");
  });

  return primaryKeyColumns;
}

/**
 * 生成INSERT语句，考虑字段替换以及主键是否为自增
 * @param {string} tableName - 表名称
 * @param {Object} rowData - 行数据
 * @param {Object} fieldsToUpdate - 需要替换的字段内容
 * @param {Object} primaryKeyColumns - 主键列及其自增信息
 * @param {boolean} [ignorePK=false] - 是否忽略主键列
 * @returns {string} - 生成的INSERT语句
 */
function generateInsertScript(
  tableName,
  rowData,
  fieldsToUpdate,
  primaryKeyColumns,
  ignorePK = false
) {
  const columns = [];
  const values = [];

  for (const [col, val] of Object.entries(rowData)) {
    if (ignorePK || !primaryKeyColumns[col]) {
      columns.push(col);
      values.push(
        formatValue(
          fieldsToUpdate[col] !== undefined ? fieldsToUpdate[col] : val
        )
      );
    }
  }

  return `INSERT INTO ${dbConfig.database}.${tableName} (${columns.join(
    ", "
  )}) VALUES (${values.join(", ")});`;
}

/**
 * 生成UPDATE语句，更新所有非主键字段并考虑字段替换
 * @param {string} tableName - 表名称
 * @param {Object} rowData - 行数据
 * @param {Object} fieldsToUpdate - 需要替换的字段内容
 * @param {Array<string>} primaryKeyColumns - 主键列
 * @param {string} whereClause - WHERE 子句
 * @returns {string} - 生成的UPDATE语句
 */
function generateUpdateScript(
  tableName,
  rowData,
  fieldsToUpdate,
  primaryKeyColumns,
  whereClause
) {
  const updates = [];

  for (const [col, val] of Object.entries(rowData)) {
    if (!primaryKeyColumns.includes(col)) {
      updates.push(
        `${col} = ${formatValue(
          fieldsToUpdate[col] !== undefined ? fieldsToUpdate[col] : val
        )}`
      );
    }
  }

  return `UPDATE ${dbConfig.database}.${tableName} SET ${updates.join(
    ", "
  )} WHERE ${whereClause};`;
}

/**
 * 生成EDIT语句，仅更新指定字段
 * @param {string} tableName - 表名称
 * @param {Object} fieldsToUpdate - 需要替换的字段内容
 * @param {string} whereClause - WHERE 子句
 * @returns {string} - 生成的EDIT语句
 */
function generateEditScript(tableName, fieldsToUpdate, whereClause) {
  const updates = Object.entries(fieldsToUpdate)
    .map(([col, val]) => `${col} = ${formatValue(val)}`)
    .join(", ");

  return `UPDATE ${dbConfig.database}.${tableName} SET ${updates} WHERE ${whereClause};`;
}

/**
 * 构建WHERE子句
 * @param {Object} whereClause - 用户指定的条件
 * @param {Object} primaryKeyColumns - 主键列及其值（仅用于更新和编辑操作）
 * @param {Object} rowData - 当前行数据
 * @returns {string} - 生成的WHERE子句
 */
function buildWhereClause(whereClause, primaryKeyColumns = null, rowData = {}) {
  const clauses = [];

  // 构建基于用户传入的 WHERE 条件
  if (whereClause) {
    for (const [col, val] of Object.entries(whereClause)) {
      if (Array.isArray(val)) {
        // 如果条件值是数组，使用 IN 语句
        clauses.push(
          `${col} IN (${val.map((v) => formatValue(v)).join(", ")})`
        );
      } else {
        clauses.push(`${col} = ${formatValue(val)}`);
      }
    }
  }

  // 如果传入了主键信息，且有对应的行数据，则加上主键条件
  if (primaryKeyColumns && rowData) {
    for (const [pkCol] of Object.entries(primaryKeyColumns)) {
      if (rowData[pkCol] !== undefined) {
        clauses.push(`${pkCol} = ${formatValue(rowData[pkCol])}`);
      }
    }
  }

  // 返回最终的 WHERE 子句
  return clauses.length > 0 ? clauses.join(" AND ") : "1=1";
}

/**
 * 处理指定表的操作类型并生成相应的SQL脚本
 * @param {Object} connection - 数据库连接对象
 * @param {Object} tableConfig - 表的配置
 * @returns {string} - 生成的SQL脚本
 */
async function processTable(connection, tableConfig) {
  const { tableName, operationType, whereClause, fieldsToUpdate, ignorePK } =
    tableConfig;
  const primaryKeyColumns = await getPrimaryKeyColumns(connection, tableName);

  // 构建 SELECT 查询，确保 WHERE 子句仅基于传入的条件
  const selectQuery = `SELECT * FROM ${
    dbConfig.database
  }.${tableName} WHERE ${buildWhereClause(whereClause)}`;
  const [rows] = await connection.query(selectQuery);

  // 初始化 SQL 语句注释
  let sqlStatements = `-- ${operationType.toUpperCase()} on table ${tableName}, Query: ${selectQuery};\n`;

  // 逐行处理查询结果
  rows.forEach((row) => {
    const whereClauseStr = buildWhereClause(
      whereClause,
      primaryKeyColumns,
      row
    );

    switch (operationType) {
      case "insert":
        sqlStatements +=
          generateInsertScript(
            tableName,
            row,
            fieldsToUpdate,
            primaryKeyColumns,
            ignorePK
          ) + "\n";
        break;
      case "update":
        sqlStatements +=
          generateUpdateScript(
            tableName,
            row,
            fieldsToUpdate,
            Object.keys(primaryKeyColumns),
            whereClauseStr
          ) + "\n";
        break;
      case "edit":
        sqlStatements +=
          generateEditScript(tableName, fieldsToUpdate, whereClauseStr) + "\n";
        break;
      default:
        throw new Error(`Unsupported operation type: ${operationType}`);
    }
  });

  return sqlStatements;
}

/**
 * 处理所有表的操作配置并将SQL脚本写入文件
 * @param {Array<Object>} tablesConfig - 所有表的操作配置
 * @param {string} outputPath - 输出文件路径
 */
async function processTablesAndGenerateSQL(tablesConfig, outputPath) {
  const { connection, connect, disconnect } = createConnection(dbConfig);

  try {
    await connect();
    const sqlStatementsArray = [];

    for (const tableConfig of tablesConfig) {
      const sqlStatements = await processTable(connection, tableConfig);
      sqlStatementsArray.push(sqlStatements);
    }

    let finalSQL = sqlStatementsArray.join("\n");

    // 定义要查找的图片路径的正则表达式（假设路径以http://或https://开头，且以jpg、png等图片格式结尾）
    // const imagePathPattern = /https?:\/\/\S+\.(?:jpg|png|gif)/g;
    // finalSQL = await replaceImagePathsInSql(finalSQL, imagePathPattern);

    writeToFile(outputPath, finalSQL);
  } catch (error) {
    console.error("Error processing tables:", error);
  } finally {
    await disconnect();
  }
}

/**
 * 生成备份脚本
 * @param {Array} tables - 要备份的表信息数组
 */
async function generateBackupScript(tables) {
  const { connection, connect, disconnect } = createConnection(dbConfig);
  let sqlScript = `-- Backup generated on ${new Date().toISOString()}\n`;
  sqlScript += `USE ${dbConfig.database};\n`;

  try {
    await connect();

    for (const tableInfo of tables) {
      const { tableName, whereClause } = tableInfo;

      // 获取表的字段信息，包括字段名和数据类型
      const [columnsInfo] = await connection.query(
        `
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `,
        [dbConfig.database, tableName]
      );

      const columnDataTypes = {};
      columnsInfo.forEach((col) => {
        columnDataTypes[col.COLUMN_NAME] = col.DATA_TYPE;
      });

      const query = `SELECT * FROM ${
        dbConfig.database
      }.${tableName} WHERE ${buildWhereClause(whereClause)}`;
      sqlScript += `\n-- Backup table: ${dbConfig.database}.${tableName}\n`;
      sqlScript += `-- Query: ${query}\n`;

      sqlScript += `DELETE FROM ${
        dbConfig.database
      }.${tableName} WHERE ${buildWhereClause(whereClause)};\n`;

      const [results] = await connection.query(query);

      results.forEach((row) => {
        const columns = Object.keys(row)
          .map((col) => `\`${col}\``)
          .join(", ");
        const values = Object.entries(row)
          .map(([col, val]) => formatValue(val, columnDataTypes[col]))
          .join(", ");

        sqlScript += `INSERT INTO ${dbConfig.database}.${tableName} (${columns}) VALUES (${values});\n`;
      });
    }

    const timestampedFilename = generateTimestampedFilename("script_backup");
    const outputFilePath = `./${timestampedFilename}`;
    writeToFile(outputFilePath, sqlScript);
  } catch (error) {
    console.error("Error generating backup script:", error);
  } finally {
    disconnect();
  }
}

/**
 * 通过API获取图片的Base64编码
 * @param {string} imagePath - 图片路径
 * @returns {Promise<string>} - 返回Base64编码
 */
async function getBase64FromImagePath(imagePath) {
  // try {
  //   const response = await axios.get(`api1_url`, {
  //     params: { imagePath },
  //   });
  //   return response.data.base64;
  // } catch (error) {
  //   console.error(`Error fetching base64 for image: ${imagePath}`, error);
  //   throw error;
  // }
}

/**
 * 上传Base64编码的图片到API，获取新URL
 * @param {string} base64Image - Base64编码的图片
 * @returns {Promise<string>} - 返回新图片URL
 */
async function uploadImageAndGetNewUrl(base64Image) {
  try {
    const response = await axios.post("api2_url", { image: base64Image });
    return response.data.newUrl;
  } catch (error) {
    console.error("Error uploading image and fetching new URL", error);
    throw error;
  }
}

/**
 * 查找并替换SQL脚本中的图片路径
 * @param {string} sqlScript - 生成的SQL脚本
 * @param {RegExp} imagePathPattern - 匹配图片路径的正则表达式
 * @returns {Promise<string>} - 返回替换后的SQL脚本
 */
async function replaceImagePathsInSql(sqlScript, imagePathPattern) {
  const matches = sqlScript.match(imagePathPattern);
  if (!matches) return sqlScript;

  for (const oldImagePath of matches) {
    const base64Image = await getBase64FromImagePath(oldImagePath);
    const newImageUrl = await uploadImageAndGetNewUrl(base64Image);
    sqlScript = sqlScript.replace(oldImagePath, newImageUrl);
  }

  return sqlScript;
}

// 示例配置和执行
const tablesConfig = [
  {
    tableName: "pms_product",
    whereClause: { brand_id: "49", id: ["1", "2"] },
    operationType: "insert",
    fieldsToUpdate: { pic: "newValue1", product_sn: "xxxxx" },
    ignorePK: true,
  },
  {
    tableName: "pms_product_attribute",
    whereClause: { type: 1, select_type: "2", id: 21 },
    operationType: "update",
    fieldsToUpdate: { input_type: "888", input_list: "QQQQ" },
  },
  {
    tableName: "pms_brand",
    whereClause: { sort: "500" },
    operationType: "edit",
    fieldsToUpdate: { name: "小米", sort: 1234 },
  },
];
const outputPath = generateTimestampedFilename("backup");
processTablesAndGenerateSQL(tablesConfig, outputPath);

const mysql = require("mysql2");
const fs = require("fs");
const http = require("http");

/**
 * 通过API获取图片的Base64编码
 * @param {string} imagePath - 图片路径
 * @returns {Promise<string>} - 返回Base64编码
 */
function getBase64FromImagePath(imagePath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api1.example.com",
      port: 80,
      path: `/getBase64?imagePath=${encodeURIComponent(imagePath)}`,
      method: "GET",
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData.base64);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * 上传Base64编码的图片到API，获取新URL
 * @param {string} base64Image - Base64编码的图片
 * @returns {Promise<string>} - 返回新图片URL
 */
function uploadImageAndGetNewUrl(base64Image) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ image: base64Image });

    const options = {
      hostname: "api2.example.com",
      port: 80,
      path: "/upload",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData.newUrl);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
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

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "admin2312",
  database: "mall2",
  port: "3306",
  timezone: "+00:00",
};

function createConnection(dbConfig) {
  const connection = mysql.createConnection(dbConfig).promise();

  const connect = () => {
    return connection.connect();
  };

  const disconnect = () => {
    return connection.end();
  };

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
 * 获取主键列及其自增信息
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
 * 将值格式化为SQL兼容的格式
 * @param {any} value - 要格式化的值
 * @returns {string} - 格式化后的值
 */
function formatValue(value, dataType) {
  if (value === null || value === undefined) {
    return "null";
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
 * 生成 INSERT 语句，考虑字段替换以及主键是否为自增
 * @param {string} tableName - 表名称
 * @param {Object} rowData - 行数据
 * @param {Object} fieldsToUpdate - 需要替换的字段内容
 * @param {Object} primaryKeyColumns - 主键列及其自增信息
 * @returns {string} - 返回生成的 INSERT 语句
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
    if (ignorePK) {
      columns.push(col);
      values.push(
        formatValue(
          fieldsToUpdate[col] !== undefined ? fieldsToUpdate[col] : val
        )
      );
    } else {
      if (!primaryKeyColumns[col]) {
        columns.push(col);
        values.push(
          formatValue(
            fieldsToUpdate[col] !== undefined ? fieldsToUpdate[col] : val
          )
        );
      }
    }
  }

  return `INSERT INTO ${dbConfig.database}.${tableName} (${columns.join(
    ", "
  )}) VALUES (${values.join(", ")});`;
}

/**
 * 生成 UPDATE 语句，更新所有非主键字段并考虑字段替换
 * @param {string} tableName - 表名称
 * @param {Object} rowData - 行数据
 * @param {Object} fieldsToUpdate - 需要替换的字段内容
 * @param {Array<string>} primaryKeyColumns - 主键列
 * @param {string} whereClause - WHERE 子句
 * @returns {string} - 返回生成的 UPDATE 语句
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
 * 生成 EDIT 语句，仅更新指定字段
 * @param {string} tableName - 表名称
 * @param {Object} fieldsToUpdate - 需要替换的字段内容
 * @param {string} whereClause - WHERE 子句
 * @returns {string} - 返回生成的 EDIT 语句
 */
function generateEditScript(tableName, fieldsToUpdate, whereClause) {
  const updates = Object.entries(fieldsToUpdate)
    .map(([col, val]) => `${col} = ${formatValue(val)}`)
    .join(", ");

  return `UPDATE ${dbConfig.database}.${tableName} SET ${updates} WHERE ${whereClause};`;
}

/**
 * 构建 WHERE 子句
 * @param {Object} whereClause - 用户指定的条件
 * @param {Object} primaryKeyColumns - 主键列及其值（仅用于更新和编辑操作）
 * @param {Object} rowData - 当前行数据
 * @returns {string} - 返回生成的 WHERE 子句
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
 * @returns {string} - 返回生成的SQL脚本
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
    let whereClauseStr = buildWhereClause(whereClause, primaryKeyColumns, row);
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
    }
  });

  return sqlStatements;
}

/**
 * 生成所有表的SQL脚本并写入文件
 * @param {Array} tablesConfig - 表的配置数组
 */
async function generateSQL(tablesConfig) {
  const { connection, connect, disconnect } = createConnection(dbConfig);
  try {
    await connect();

    console.log("111");
    // 准备插入数据
    const title = "Sample Title";
    const description = "This is a description";
    try {
      // 模拟读取一个文件作为 LONGBLOB 数据
      const blobData = fs.readFileSync("./ZfRGPRC_(Sc)02.pdf"); // 替换为你的文件路径

      console.log("11122", blobData);
      // 插入语句
      const query = `INSERT INTO mall2.pms_product (name,product_sn,file) VALUES ('11','222',?)`;

      // 执行插入
      connection.query(query, [blobData], (error, results) => {
        if (error) {
          console.error("插入失败:", error.message);
        } else {
          console.log("数据插入成功，插入 ID:", results.insertId);
        }
        console.log("99999");
        // connection.end(); // 关闭数据库连接
      });
    } catch (error) {
      console.log(error);
    }

    let sqlScript = "";
    for (const tableConfig of tablesConfig) {
      const sqlStatements = await processTable(connection, tableConfig);
      sqlScript += sqlStatements + "\n";
    }

    const timestampedFilename = generateTimestampedFilename("script_execute");
    const outputFilePath = `./${timestampedFilename}`;
    writeToFile(outputFilePath, sqlScript);
  } catch (error) {
    console.log("generateSQL:", error);
  } finally {
    await disconnect();
  }
}

/**
 * 生成备份脚本
 * @param {Array} tables 要备份的表信息数组
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
      }.${tableName}  WHERE ${buildWhereClause(whereClause)}`;
      sqlScript += `\n-- Backup table:${dbConfig.database}.${tableName}\n`;
      sqlScript += `-- Query:${query}\n`;

      sqlScript += `delete from ${
        dbConfig.database
      }.${tableName} WHERE ${buildWhereClause(whereClause)};\n`;

      const [results, fields] = await connection.query(query);

      // 找到 LONGBLOB 类型的字段
      const blobFields = fields
        .filter(
          (field) =>
            field.type === mysql.Types.BLOB ||
            field.type === mysql.Types.LONG_BLOB
        )
        .map((field) => field.name);

      results.forEach((row) => {
        let columns = Object.keys(row)
          .map((col) => `\`${col}\``)
          .join(", ");
        let values = Object.values(row)
          .map(([col, val]) => {
            console.log(col);
            return formatValue(val, columnDataTypes[col]);
          })
          .join(", ");

        sqlScript += `INSERT INTO ${dbConfig.database}.${tableName} (${columns}) VALUES (${values});\n`;
      });
    }

    const timestampedFilename = generateTimestampedFilename("script_backup");
    const outputFilePath = `./${timestampedFilename}`;
    writeToFile(outputFilePath, sqlScript);
  } catch (error) {
    console.error("Error generateBackupScript:", error);
  } finally {
    disconnect();
  }
}

// 示例
const tables = [
  {
    tableName: "pms_product",
    whereClause: { name: "11" },
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

generateSQL(tables);
generateBackupScript(tables);

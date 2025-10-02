const mysql = require("mysql2/promise");
const BaseAdapter = require("./baseAdapter");
const { convertRowToCamelCase } = require("./utils/format");

class MySQLAdapter extends BaseAdapter {
  async connect() {
    if (!this.pool) {
      this.pool = mysql.createPool(this.config);
    }
  }

  prepare(sql, params = {}) {
    const values = [];
    const transformedSql = sql.replace(/:([a-zA-Z_][\w]*)/g, (_, key) => {
      if (!(key in params)) throw new Error(`缺少参数: ${key}`);
      const val = params[key];
      if (Array.isArray(val)) {
        values.push(...val);
        return `(${val.map(() => "?").join(",")})`;
      } else {
        values.push(val);
        return `?`;
      }
    });
    this.log("sql", `执行SQL: ${transformedSql} [${values.join(", ")}]`);
    return { sql: transformedSql, values };
  }

  async query(sql, params = {}) {
    await this.connect();
    const { sql: finalSql, values } = this.prepare(sql, params);
    const [rows] = await this.pool.execute(finalSql, values);
    return this.camelCase ? rows.map(convertRowToCamelCase) : rows;
  }

  async queryByPage(sql, params = {}, { page = 1, pageSize = 20 } = {}) {
    await this.connect();
    const { sql: preparedSql, values } = this.prepare(sql, params);

    const countSql = `SELECT COUNT(*) as total FROM (${preparedSql}) AS temp`;
    const [countRows] = await this.pool.execute(countSql, values);
    const total = countRows[0].total;

    const offset = (page - 1) * pageSize;
    const pagedSql = `${preparedSql} LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.execute(pagedSql, [
      ...values,
      pageSize,
      offset,
    ]);

    const resultRows = this.camelCase ? rows.map(convertRowToCamelCase) : rows;
    return { total, page, pageSize, rows: resultRows };
  }

  async update(sql, params = {}) {
    return this.execute(sql, params);
  }

  async delete(sql, params = {}) {
    return this.execute(sql, params);
  }

  async execute(sql, params = {}) {
    await this.connect();
    const { sql: finalSql, values } = this.prepare(sql, params);
    const [res] = await this.pool.execute(finalSql, values);
    return res;
  }

  close() {
    this.pool?.end();
  }
}

module.exports = MySQLAdapter;

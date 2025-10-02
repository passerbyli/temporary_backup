const MySQLAdapter = require("./mysqlAdapter");
const PostgresAdapter = require("./postgresAdapter");
const { defaultLogHook } = require("./utils/log");

class DbClient {
  constructor(configMap, options = {}) {
    this.configMap = configMap;
    this.options = options;
    this.adapterMap = {};
  }

  getAdapter(dbName) {
    if (this.adapterMap[dbName]) return this.adapterMap[dbName];

    const cfg = this.configMap[dbName];
    if (!cfg) throw new Error(`数据源 ${dbName} 未配置`);
    const adapterOptions = {
      camelCase: this.options.camelCase || false,
      logHook: this.options.logHook || defaultLogHook,
    };

    let adapter;
    if (cfg.type === "mysql") {
      adapter = new MySQLAdapter(cfg, adapterOptions);
    } else if (cfg.type === "postgres") {
      adapter = new PostgresAdapter(cfg, adapterOptions);
    } else {
      throw new Error(`不支持的数据库类型: ${cfg.type}`);
    }

    this.adapterMap[dbName] = adapter;
    return adapter;
  }

  async query(dbName, sql, params = {}) {
    return this.getAdapter(dbName).query(sql, params);
  }

  async queryByPage(dbName, sql, params = {}, pageOpt = {}) {
    return this.getAdapter(dbName).queryByPage(sql, params, pageOpt);
  }

  async update(dbName, sql, params = {}) {
    return this.getAdapter(dbName).update(sql, params);
  }

  async delete(dbName, sql, params = {}) {
    return this.getAdapter(dbName).delete(sql, params);
  }

  closeAll() {
    for (const adapter of Object.values(this.adapterMap)) {
      adapter.close?.();
    }
  }
}

module.exports = DbClient;

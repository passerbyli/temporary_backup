class BaseAdapter {
  constructor(config, options = {}) {
    this.config = config;
    this.camelCase = options.camelCase;
    this.logger = options.logHook || (() => {});
  }

  log(type, message) {
    this.logger(type, message);
  }

  async connect() {
    throw new Error("connect() not implemented");
  }

  async query(sql, params) {
    throw new Error("query() not implemented");
  }

  async queryByPage(sql, params, pageOptions) {
    throw new Error("queryByPage() not implemented");
  }

  async update(sql, params) {
    throw new Error("update() not implemented");
  }

  async delete(sql, params) {
    throw new Error("delete() not implemented");
  }

  async execute(sql, params) {
    throw new Error("execute() not implemented");
  }

  close() {}
}

module.exports = BaseAdapter;

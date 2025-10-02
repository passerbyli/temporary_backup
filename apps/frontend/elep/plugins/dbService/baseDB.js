class BaseDB {
  constructor(config) {
    this.config = config
  }

  async connect() {
    throw new Error('connect not implemented')
  }
  async getSchemas() {
    throw new Error('getSchemas not implemented')
  }
  async getTables(schema) {
    throw new Error('getTables not implemented')
  }
  async getTableStruct(schema, table) {
    throw new Error('getTableStruct not implemented')
  }
  async getProcedures(schema) {
    throw new Error('getProcedures not implemented')
  }
  async getProcedureDetail(schema, procedure) {
    throw new Error('getProcedureDetail not implemented')
  }

  async getDBQuery() {}
}

module.exports = BaseDB

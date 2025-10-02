const mysql = require('mysql2/promise')
const { Client } = require('pg')

class DBClient {
  constructor(config) {
    this.config = config
    this.dbType = config.dbType
    this.client = null
  }

  async connect() {
    if (this.dbType === 'mysql') {
      this.client = await mysql.createPool({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        port: this.config.port,
        timezone: this.config.timezone,
        waitForConnections: true,
        connectionLimit: 10,
      })
    } else if (
      this.dbType === 'pgsql' ||
      this.dbType === 'postgres' ||
      this.dbType === 'postgresql'
    ) {
      this.client = new Client({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        port: this.config.port,
      })
      await this.client.connect()
    } else {
      throw new Error('Unsupported dbType')
    }
  }

  async query(sql, params = []) {
    if (!this.client) {
      throw new Error('Database not connected.')
    }

    if (this.dbType === 'mysql') {
      const [rows] = await this.client.query(sql, params)
      return rows
    } else {
      const res = await this.client.query(sql, params)
      return res.rows
    }
  }

  async insert(table, data) {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const placeholders = keys.map(() => '?').join(',')

    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`

    return await this.query(sql, values)
  }

  async update(table, data, where) {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const setStr = keys.map((key) => `${key} = ?`).join(',')

    const whereKeys = Object.keys(where)
    const whereValues = Object.values(where)
    const whereStr = whereKeys.map((key) => `${key} = ?`).join(' AND ')

    const sql = `UPDATE ${table} SET ${setStr} WHERE ${whereStr}`

    return await this.query(sql, [...values, ...whereValues])
  }

  async delete(table, where) {
    const whereKeys = Object.keys(where)
    const whereValues = Object.values(where)
    const whereStr = whereKeys.map((key) => `${key} = ?`).join(' AND ')

    const sql = `DELETE FROM ${table} WHERE ${whereStr}`

    return await this.query(sql, whereValues)
  }

  async close() {
    if (this.dbType === 'mysql') {
      await this.client.end()
    } else {
      await this.client.end()
    }
  }
}

module.exports = DBClient

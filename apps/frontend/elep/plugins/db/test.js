//查询数据（含条件查询）
const db = require('./queryUtils')

// 构建查询条件
const { clause, values } = db.buildWhereClause(
  {
    age: { '>=': 18 },
    name: { like: '%Tom%' },
    status: ['active', 'pending'],
    created_at: { between: ['2024-01-01', '2024-12-31'] },
  },
  'postgres',
)

// 拼接 SQL
const sql = `SELECT * FROM "public"."users" ${clause}`

// 查询数据
;(async () => {
  const result = await db.query('pg1', 'public', sql, values)
  console.log('查询结果:', result)
})()

//分页查询
;(async () => {
  const baseSql = 'SELECT * FROM "public"."orders" WHERE status = $1'
  const params = ['paid']
  const pagination = { page: 2, pageSize: 5 }

  const result = await db.queryWithPagination('pg1', 'public', baseSql, params, pagination)
  console.log('分页结果:', result)
})()

//插入数据
;(async () => {
  const newUser = {
    name: 'Alice',
    age: 25,
    status: 'active',
  }

  const result = await db.insert('pg1', 'public', 'users', newUser)
  console.log('插入结果:', result)
})()

//更新数据
;(async () => {
  const updated = await db.update(
    'pg1',
    'public',
    'users',
    { age: 26, status: 'inactive' },
    { name: 'Alice' },
  )
  console.log('更新结果:', updated)
})()

//删除数据
;(async () => {
  const success = await db.remove('pg1', 'public', 'users', { name: 'Alice' })
  console.log('删除结果:', success)
})()

//MySQL 使用示例
;(async () => {
  // MySQL 中 schema 就是数据库名
  const result = await db.query('mysql1', 'testdb', 'SELECT * FROM `users` WHERE age > ?', [18])
  console.log('MySQL 查询:', result)

  const newUser = { name: 'Bob', age: 30 }
  const insertRes = await db.insert('mysql1', 'testdb', 'users', newUser)
  console.log('MySQL 插入:', insertRes)
})()

// 关闭所有连接池
;(async () => {
  const { closeAllConnections } = require('./db')
  await closeAllConnections()
  console.log('所有连接池已关闭')
})()

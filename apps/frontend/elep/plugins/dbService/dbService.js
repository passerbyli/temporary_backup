const { createDBClient } = require('./index')

async function main() {
  const db = await createDBClient({
    dbType: 'mysql',
    host: 'localhost',
    user: 'root',
    password: 'admin2312',
    database: 'information_schema',
    port: 3306,
    timezone: '+00:00',
  })
  // 查询所有 schema
  const schemas = await db.getSchemas()

  // 查询表名
  const tables = await db.getTables('performance_schema')

  // 查询表结构
  // const tableStruct = await db.getTableStruct('mall', 'cms_help')

  // 查询存储过程
  const procedures = await db.getProcedures('sys')

  // // 查询存储过程定义
  const procedureDetail = await db.getProcedureDetail('sys', 'ps_setup_disable_background_threads')
  //
  const procedureDetailParams = await db.getProcedureParams('sys', 'ps_truncate_all_tables')
  // console.log(schemas)
  // console.log(tables)
  // console.log(procedures)
  // console.log(procedureDetail)
  // console.log(procedureDetailParams)
}

async function pgMain() {
  const pgdb = await createDBClient({
    dbType: 'pgsql',
    host: 'localhost',
    user: 'postgres',
    password: 'admin2312',
    database: 'lihaomin',
    port: 5432,
    timezone: '+00:00',
  })
  // 查询所有 schema
  const schemas = await pgdb.getSchemas()

  // 查询表名
  const tables = await pgdb.getTables('da')

  // 查询表结构
  // const tableStruct = await pgd b.getTableStruct('mall', 'cms_help')

  // 查询存储过程
  const procedures = await pgdb.getProcedures('mc_shop')

  // // 查询存储过程定义
  const procedureDetail = await pgdb.getProcedureDetail('mc_shop', 'etl_dwd_to_dws')
  //
  const procedureDetailParams = await pgdb.getProcedureParams('mc_shop', 'manage_partitions')
  // console.log(schemas)
  // console.log(tables)
  // console.log(procedures)
  console.log(procedureDetail)
  console.log(procedureDetailParams)
}

// pgMain()

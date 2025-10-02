const { ipcMain } = require('electron')
const { getConfig, updateConfig } = require('../db/configDb')
const crud = require('../db/crud')

const mysql = require('mysql2/promise')
const { Client } = require('pg')

function registerDataSourceIpc(ipcMain) {
  ipcMain.handle('ds:list', () => {
    const config = getConfig()
    return config.modules?.module4?.sources || []
  })

  ipcMain.handle('ds:save', (_, sources) => {
    const config = getConfig()
    const updated = {
      ...config.modules,
      module4: { ...config.modules.module4, sources }
    }
    updateConfig({ modules: updated })
    return { success: true }
  })

  ipcMain.handle('ds:test', async (_, ds) => {
    try {
      if (ds.type === 'MySQL') {
        const conn = await mysql.createConnection({
          host: ds.host,
          port: ds.port,
          user: ds.username,
          password: ds.password,
          database: ds.database
        })
        await conn.ping()
        await conn.end()
      } else if (ds.type === 'PostgreSQL') {
        const client = new Client({
          host: ds.host,
          port: ds.port,
          user: ds.username,
          password: ds.password,
          database: ds.database
        })
        await client.connect()
        await client.end()
      } else {
        throw new Error('不支持的数据源类型')
      }

      return { success: true, message: '连接成功' }
    } catch (err) {
      return { success: false, message: err.message }
    }
  })

  ipcMain.handle('table/query-all', async (event, args) => {
    const { filters, page, pageSize } = args
    const { keyword, dataSource, schema, layer } = filters

    let sql = `
    SELECT t.id, 
    t.name AS table_name, 
    t.layer, t.type, 
    t.description,
    t.schema_name
    FROM ads_dl.metadata_table t
    WHERE 1=1
  `
    const params = []

    if (keyword) {
      sql += ` AND (t.name ILIKE $${params.length + 1} OR t.description ILIKE $${params.length + 1})`
      params.push(`%${keyword}%`)
    }
    if (dataSource) {
      sql += ` AND d.name = $${params.length + 1}`
      params.push(dataSource)
    }
    if (schema) {
      sql += ` AND s.name = $${params.length + 1}`
      params.push(schema)
    }
    if (layer) {
      sql += ` AND t.layer = $${params.length + 1}`
      params.push(layer)
    }

    return await crud.queryWithPagination('pg1', sql, params, { page, pageSize })
  })

  ipcMain.handle('table/distinct-options', async () => {
    return {
      dataSources: await crud.getDistinctValues('table_metadata', 'name'),
      schemas: await crud.getDistinctValues('schema_metadata', 'name'),
      layers: await crud.getDistinctValues('table_metadata', 'layer')
    }
  })

  ipcMain.handle('table/export-all', async (event, filters) => {
    // 同 query-all 中构造 SQL，只是不分页
    const { keyword, dataSource, schema, layer } = filters
    let sql = `
    SELECT t.name AS table_name, t.layer, t.type, t.description,
           s.name AS schema_name, d.name AS data_source
    FROM table_metadata t
    LEFT JOIN schema_metadata s ON t.schema_uuid = s.uuid
    LEFT JOIN data_source d ON s.data_source_uuid = d.uuid
    WHERE 1=1
  `
    const params = []

    if (keyword) {
      sql += ` AND (t.name ILIKE $${params.length + 1} OR t.description ILIKE $${params.length + 1})`
      params.push(`%${keyword}%`)
    }
    if (dataSource) {
      sql += ` AND d.name = $${params.length + 1}`
      params.push(dataSource)
    }
    if (schema) {
      sql += ` AND s.name = $${params.length + 1}`
      params.push(schema)
    }
    if (layer) {
      sql += ` AND t.layer = $${params.length + 1}`
      params.push(layer)
    }

    return await crud.query(sql, params)
  })

  ipcMain.handle('table/export-all-to-file', async (event, filters) => {
    const data = await crud.queryTableExport(filters)

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: '导出表清单',
      defaultPath: 'table_list_export.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })

    if (canceled || !filePath) return null

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tables')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    fs.writeFileSync(filePath, buffer)
    return filePath
  })

  ipcMain.handle('diffApiByRoute', async (event, route_id) => {
    let sql = `
    SELECT
      COALESCE(p.api_id, t.api_id) AS api_id,

      CASE WHEN p.name IS DISTINCT FROM t.name THEN 'DIFF' ELSE '' END AS name_diff,
      CASE WHEN p.url IS DISTINCT FROM t.url THEN 'DIFF' ELSE '' END AS url_diff,
      CASE WHEN p.input_params IS DISTINCT FROM t.input_params THEN 'DIFF' ELSE '' END AS input_diff,
      CASE WHEN p.output_params IS DISTINCT FROM t.output_params THEN 'DIFF' ELSE '' END AS output_diff,
      CASE WHEN p.backend_script IS DISTINCT FROM t.backend_script THEN 'DIFF' ELSE '' END AS backend_diff,

      p.name  AS prod_name,
      t.name  AS test_name,
      p.url   AS prod_url,
      t.url   AS test_url,
      p.input_params  AS prod_input,
      t.input_params  AS test_input,
      p.output_params AS prod_output,
      t.output_params AS test_output

    FROM
      (SELECT * FROM ads_dl.metadata_api WHERE env = 'prod' AND route_id =$1) p
    FULL OUTER JOIN
      (SELECT * FROM ads_dl.metadata_api WHERE env = 'test' AND route_id = $1) t
    ON p.api_id = t.api_id
    ORDER BY api_id
  `
    const params = []
    if (route_id) {
      params.push(`${route_id}`)
    }
    const result = await crud.query('pg1', '', sql, params)
    return result.rows
  })

  ipcMain.handle('getApiDetailByRouteId', async (event, route_id) => {
    const sql = `
  SELECT env,
         jsonb_build_object(
           'id', id,
           'api_id', api_id,
           'name', name,
           'url', url,
           'description', description,
           'request_example', request_example,
           'input_params', input_params,
           'output_params', output_params,
           'backend_script', backend_script
         ) AS data
  FROM ads_dl.metadata_api
  WHERE route_id = $1 AND env IN ('prod','test')`
    const rows = await crud.query('pg1', '', sql, [route_id])
    const result = { prod: null, test: null }
    rows.forEach(r => (result[r.env] = r.data))
    return result
  })

  ipcMain.handle('queryApiListByRoute', async (event, params) => {
    const { page, pageSize, nameLike, routeLike, urlLike, domain, authType, impl } = {
      ...{
        page: 1,
        pageSize: 20,
        nameLike: '',
        routeLike: '',
        urlLike: '',
        domain: '',
        authType: '',
        impl: ''
      },
      ...params
    }

    console.log(page, pageSize, nameLike, routeLike, urlLike, domain, authType, impl)
    // 过滤条件
    const where = []
    const values = []
    let idx = 1
    if (nameLike) {
      where.push(`(p.name ILIKE $${idx} OR t.name ILIKE $${idx})`)
      values.push(`%${nameLike}%`)
      idx++
    }
    if (routeLike) {
      where.push(`(p.route ILIKE $${idx} OR t.route ILIKE  $${idx})`)
      values.push(`%${routeLike}%`)
      idx++
    }
    if (urlLike) {
      where.push(`(p.url ILIKE $${idx} OR t.url ILIKE  $${idx})`)
      values.push(`%${urlLike}%`)
      idx++
    }
    if (domain) {
      where.push(`COALESCE(p.domain,t.domain)= $${idx}`)
      values.push(`${domain}`)
      idx++
    }
    if (authType) {
      where.push(`COALESCE(p.auth_type,t.auth_type)= $${idx}`)
      values.push(`${authType}`)
      idx++
    }
    if (impl) {
      where.push(`COALESCE(p.impl,t.impl)= $${idx}`)
      values.push(`${impl}`)
      idx++
    }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const baseSQL = `
    FROM
      (SELECT * FROM ads_dl.metadata_api WHERE env='prod') p
    FULL JOIN
      (SELECT * FROM ads_dl.metadata_api WHERE env='test') t
    ON p.route_id = t.route_id
    ${whereSQL}
  `

    // total
    const totalRes = await crud.query('pg1', '', `SELECT COUNT(DISTINCT COALESCE(p.route_id,t.route_id)) ${baseSQL}`, values)
    console.log('--====', totalRes)
    const total = Number(totalRes[0].count)

    // data
    const offset = (page - 1) * pageSize
    const dataSQL = `
    SELECT
      COALESCE(p.route_id,t.route_id)  AS route_id,
      COALESCE(p.route,t.route)        AS route_name,
      p.api_id                         AS prod_api_id,
      t.api_id                         AS test_api_id,
      p.name                           AS prod_name,
      t.name                           AS test_name,
      p.url                            AS prod_url,
      t.url                            AS test_url,
      COALESCE(p.domain,t.domain)      AS domain,
      COALESCE(p.impl,t.impl)          AS impl,
      COALESCE(p.auth_type,t.auth_type)AS auth_type,
      COALESCE(p.description,t.description) AS description
    ${baseSQL}
   GROUP BY COALESCE(p.route_id, t.route_id),
         COALESCE(p.route, t.route),
         prod_api_id, test_api_id, prod_name, test_name,
         prod_url, test_url,
         COALESCE(p.domain, t.domain),
         COALESCE(p.impl, t.impl),
         COALESCE(p.auth_type, t.auth_type),
         COALESCE(p.description, t.description)
    ORDER BY route_id
    LIMIT $${idx} OFFSET $${idx + 1}
  `

    values.push(`${pageSize}`)
    values.push(`${offset}`)

    const dataRes = await crud.query('pg1', '', dataSQL, values)

    return { total, list: dataRes }
  })

  ipcMain.handle('queryApiListByRoute——bak', async event => {
    let sql = `
    SELECT
      COALESCE(prod.route_id, test.route_id) AS route_id,
      COALESCE(prod.route, test.route) AS route,

      prod.api_id AS prod_api_id,
      test.api_id AS test_api_id,

      prod.env AS prod_env,
      test.env AS test_env

    FROM
      (SELECT route_id, route, api_id, env FROM ads_dl.metadata_api WHERE env = 'prod') prod
    FULL OUTER JOIN
      (SELECT route_id, route, api_id, env FROM ads_dl.metadata_api WHERE env = 'test') test
    ON prod.route_id = test.route_id
    ORDER BY route_id;
  `

    const result = await crud.query('pg1', 'xxxaaa', sql)
    console.log('---', result)
    return result
  })

  ipcMain.handle('get-table-detail', async (event, data) => {
    let { id } = data
    let sql = `
SELECT
t.uuid as table_uuid,
    t.name AS table_name,
    t.schema_name as table_schema_name,
    t.layer as table_layer,
    t.type as table_type,
    t.description as table_description,
    t.table_statement,
    c.name AS column_name,
    c.description as column_description
FROM ads_dl.metadata_field c
         LEFT JOIN ads_dl.metadata_table t ON t.uuid = c.table_uuid
  WHERE 1=1`

    const params = []

    if (id) {
      sql += ` AND c.table_uuid = $${params.length + 1}`
      params.push(id)
    }
    const tableInfo = await crud.query('pg1', sql, params)
    return { tableInfo }
  })

  ipcMain.handle('get-table-data-view', async (event, data) => {
    let { table_schema_name, table_name } = data
    let sql = `
SELECT
*
FROM ${table_schema_name}.${table_name}
limit 10
 `

    const params = []

    const tableInfo = await crud.query('pg1', sql, params)
    return tableInfo
  })
}
module.exports = registerDataSourceIpc

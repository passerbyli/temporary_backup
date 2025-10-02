const constants = require('../constants')
const { getConfig } = require('../db/configDb')
const myAxios = require('./myAxios')

async function getVersion() {
  const res = await myAxios.get(constants.API.checkVersion)
  return res.data
}

async function queryKg(params) {
  let config = getConfig()
  let auth = config.global.auth

  url = 'http://127.0.0.1:8081/test/g6/resolve'

  url = `http://127.0.0.1:8081/api/neo4j/lineage/trace?tableId=${params.tableId}&level=${params.level}&direction=${params.direction}`
  console.log('queryKg', url, params)
  return myAxios
    .get(
      `${url}`,
      {
        // tableId: params.id,
        // level: parseInt(params.level),
        // direction: params.direction
        // closed: params.closed,
        // nodeFilter: {
        //   // layer: ['ods', 'ads'],
        //   layer: ['dim']
        // },
        // relFilter: {
        //   // sqlName: ['sql_10', 'sql_debug'],
        // }
      },
      {
        headers: {
          Cookie: auth.cookies
        },
        tag: 'xxajiso'
      }
    )
    .then(response => {
      console.log(response)
      return response.data
    })
    .catch(err => {
      return {
        type: 'error',
        message: err?.response?.data
      }
    })
}

module.exports = {
  queryKg,
  getVersion
}

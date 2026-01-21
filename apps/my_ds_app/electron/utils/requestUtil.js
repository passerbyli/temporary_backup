const constants = require('../constants');
const myAxios = require('./myAxios');

async function getVersion() {
  const res = await myAxios.get(constants.API.checkVersion);
  return res.data;
}


module.exports = {
  getVersion,
};

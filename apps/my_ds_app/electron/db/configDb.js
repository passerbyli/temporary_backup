const Store = require('electron-store');
const { log } = require('../log/logger');
const defaults = require('./defaultConfig.json');

// const store = new Store({
//   name: 'config', // 会保存为 config.json
//   defaults: defaults,
// });

const store = new Store({
  name: 'config',
  defaults: defaults,
  migrations: {
    '1.1.0': (store) => {
      // ===== global.autoLogin =====
      const autoLogin = store.get('global.autoLogin') || {};

      store.set('global.autoLogin', {
        loginApi: 'xxxxx',
        cron: '* * */50 * * *',
        ...autoLogin, // 旧值优先
      });

      // ===== 新 module1 =====
      if (!store.has('modules.module1')) {
        store.set('modules.module1', {
          apiUrl: 'xxxx',
          api2Url: 'xxxx',
        });
      }
    },
  },
});

function getConfig() {
  log.info('获取配置');
  return store.store;
}

function getBasePath() {
  let config = getConfig();
  return config.global.basePath;
}

function updateConfig(newData) {
  log.info('更新配置:', newData);
  store.store = { ...store.store, ...newData };
}

module.exports = { getConfig, updateConfig, getBasePath };

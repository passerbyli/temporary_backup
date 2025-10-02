module.exports = {
  API: {
    checkVersion: 'http://localhost:3000/version',
    beta: {},
    prod: {
      login: 'http://localhost:3000/login',
      logout: 'http://localhost:3000/logout',
      checkLogin: 'http://localhost:3000/userinfo',
    },
  },
}

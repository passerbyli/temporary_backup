export const defaultForm = {
  global: {
    isLogin: false,
    auth: {
      role: '',
      displayName: '',
      username: '',
      password: '',
      errorCount: 0,
      errorMessage: '',
      cookies: []
    },
    menuPosition: 'left',
    theme: 'light',
    language: 'zh_CN',
    notify: { disable: false },
    basePath: '',
    autoLogin: {
      disable: true,
      cron: '* * */30 * * *'
    }
  },
  modules: {
    module2: {
      cronJobs: {
        cronJob1: '',
        cronJob2: ''
      },
      type: 'PI'
    },
    module3: {
      accounts: {
        beta: { username: '', password: '', cookies: [] },
        pord: { username: '', password: '', cookies: [] }
      },
      currentEnv: 'beta'
    }
  }
}

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(ElementPlus)
app.use(router)

if (window.electron) {
  window.electron.onNavigate(route => {
    console.log('主窗口收到 navigate:', route)
    router.push({ name: route }) // 在主窗口跳转
  })
}

app.mount('#app')

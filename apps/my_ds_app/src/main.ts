import './assets/main.css';
import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(ElementPlus);
app.use(router);

if (window.electronAPI) {
  window.electronAPI.onNavigate((route) => {
    console.log('主窗口收到 navigate:', route);
    router.push({ name: route }); // 在主窗口跳转
  });

  // 全局注入：this.$log / 组合式也可用
  app.config.globalProperties.$log = window.logger;
}

app.mount('#app');

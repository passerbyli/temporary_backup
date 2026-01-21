import { createRouter, createWebHashHistory } from 'vue-router';
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/home',
      name: 'home',
      // component: () => import('../views/HomeView.vue'),
      component: () => import('../views/TaskBoardView.vue'),
      meta: {
        display: true,
        title: '首页',
      },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/TaskBoardView.vue'),
      meta: {
        display: true,
        title: '我们',
      },
    },
    {
      path: '/task-board',
      name: 'taskBoard',
      component: () => import('../views/TaskBoardView.vue'),
      meta: {
        display: true,
        title: '任务看板',
      },
    },
    {
      path: '/spotlight',
      name: 'Spotlight',
      component: () => import('../views/SpotlightView.vue'),
      meta: {
        layout: 'empty',
        title: 'Spotlight',
        display: false, // 不在搜索中显示
      },
    },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
  ],
});

router.beforeEach(async (to, from, next) => {
  next();
});

export default router;

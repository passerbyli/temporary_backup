import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import Layout from '../layout/index.vue';

const router = createRouter({
  // history: createWebHistory(import.meta.env.BASE_URL),
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: Layout,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('../views/ai2.vue'),

          meta: {
            display: true,
            title: '首页',
          },
        },
        {
          path: '/dataGovernance',
          name: 'dataGovernance',
          meta: {
            display: true,
            title: '数据治理',
          },
          children: [
            {
              path: '/interfaces',
              name: 'InterfaceList',
              component: () => import('../views/InterfaceList.vue'),
              meta: {
                display: true,
                title: '接口管理',
              },
            },
            {
              path: '/route-detail/:route_id',
              name: 'InterfaceDetail',
              component: () => import('../views/InterfaceDetail.vue'),
              props: true,
              meta: {
                display: true,
                title: '接口详情',
              },
            },
            {
              name: 'dataSource',
              path: '/dataSource',
              component: () => import('../views/DataSourceView.vue'),
              meta: {
                display: true,
                title: '数据源管理',
              },
              children: [],
            },
            {
              path: '/tableAssets',
              name: 'tableAssets',
              component: () => import('../views/TableAssets.vue'),
              meta: {
                display: true,
                title: '表资产',
              },
              children: [],
            },
            {
              path: '/tableDetail/:id',
              name: 'tableDetail',
              component: () => import('../views/TableDetail.vue'),
              meta: {
                display: false,
                title: '表明细',
              },
              children: [],
            },
            {
              path: '/ProcedureAssetOverview',
              name: 'ProcedureAssetOverview',
              component: () => import('../views/ProcedureAssetOverview.vue'),
              meta: {
                display: true,
                title: '存储过程列表',
              },
              children: [],
            },
            {
              path: '/ProcedureDetail',
              name: 'ProcedureDetail',
              component: () => import('../views/ProcedureDetail.vue'),
              meta: {
                display: false,
                title: '存储过程明细',
              },
              children: [],
            },
            {
              path: '/ScheduleTaskOverview',
              name: 'ScheduleTaskOverview',
              component: () => import('../views/ScheduleTaskOverview.vue'),
              meta: {
                display: true,
                title: '调度任务',
              },
              children: [],
            },
            {
              path: '/dataBase',
              name: 'dataBase',
              component: () => import('../views/DataBaseView.vue'),
              meta: {
                display: true,
                title: '数据库',
              },
              children: [],
            },
            {
              path: '/dataScriptAnalysis',
              name: 'dataScriptAnalysis',
              component: () => import('../views/DataScriptAnalysisView.vue'),
              meta: {
                display: true,
                title: '数据脚本分析',
              },
              children: [],
            },
            {
              path: '/dataLineage',
              name: 'dataLineage',
              component: () => import('../views/DataLineageView.vue'),
              meta: {
                display: true,
                title: '数据管理',
              },
            },
          ],
        },
        {
          path: '/test',
          name: 'test',
          meta: {
            display: true,
            title: 'test',
          },
          children: [
            {
              path: '/test1',
              name: 'test1',
              component: () => import('../views/test1.vue'),
              meta: {
                display: true,
                title: 'test1',
              },
            },
            {
              path: '/test2',
              name: 'test2',
              component: () => import('../views/test2.vue'),
              meta: {
                title: 'test2',
              },
            },
            {
              path: '/test3',
              name: 'test3',
              component: () => import('../views/test3.vue'),
              meta: {
                display: true,
                title: 'test3',
              },
            },
            {
              path: '/test4',
              name: 'test4',
              component: () => import('../views/test4.vue'),
              meta: {
                display: true,
                title: 'test4',
              },
            },
            {
              path: '/test5',
              name: 'test5',
              component: () => import('../views/test5.vue'),
              meta: {
                display: true,
                title: 'test5',
              },
            },
            {
              path: '/test6',
              name: 'test6',
              component: () => import('../views/test6.vue'),
              meta: {
                display: true,
                title: 'test6',
              },
            },
          ],
        },
        {
          path: '/other',
          name: 'other',
          meta: {
            display: true,
            title: 'other',
          },
          children: [
            {
              path: '/ObjectToJsonView',
              name: 'ObjectToJsonView',
              component: () => import('../views/ObjectToJsonView.vue'),
              meta: {
                display: true,
                title: 'ObjectToJsonView',
              },
            },
            {
              path: '/BookmarkView',
              name: 'BookmarkView',
              component: () => import('../views/BookmarkView.vue'),
              meta: {
                display: true,
                title: 'BookmarkView',
              },
            },
            {
              path: '/ExportSqlPage',
              name: 'ExportSqlPage',
              component: () => import('../views/ExportSqlPage.vue'),
              meta: {
                display: true,
                title: 'ExportSqlPage',
              },
            },
            {
              path: '/Diff',
              name: 'Diff',
              component: () => import('../views/Diff.vue'),
              meta: {
                display: true,
                title: 'Diff',
              },
            },
            {
              path: '/DiffText',
              name: 'DiffText',
              component: () => import('../views/DiffText.vue'),
              meta: {
                display: true,
                title: 'DiffText',
              },
            },
            {
              path: '/style',
              name: 'style',
              component: () => import('../views/style.vue'),
              meta: {
                display: true,
                title: 'style',
              },
            },
            {
              path: '/SideBySideDiff',
              name: 'SideBySideDiff',
              component: () => import('../views/SideBySideDiff.vue'),
              meta: {
                display: true,
                title: 'SideBySideDiff',
              },
            },
          ],
        },
        {
          path: '/about',
          name: 'about',
          component: () => import('../views/HomeView.vue'),
          meta: {
            display: true,
            title: '关于',
          },
        },
        {
          path: '/log',
          name: 'log',
          component: () => import('../views/LogView.vue'),
          meta: {
            display: true,
            title: 'log',
          },
        },
        {
          path: '/setting',
          name: 'setting',
          component: () => import('../views/SettingView.vue'),
          meta: {
            display: false,
            title: '设置',
          },
        },
      ],
    },
    {
      path: '/spotlight',
      name: 'Spotlight',
      component: () => import('../views/SpotlightView.vue'),
      meta: {
        layout: 'empty',
        title: 'xxx',
      }, // 如果你有布局控制
    },
  ],
});

router.beforeEach(async (to, from, next) => {
  next();
});

export default router;

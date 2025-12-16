import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layout/LayoutEpP.vue'
import AreaEntry from '@/views/AreaEntry2.vue'

const routes = [
  { path: '/china', component: Layout, children: [{ path: '', component: AreaEntry }] },
  { path: '/oversea', component: Layout, children: [{ path: '', component: AreaEntry }] },
  { path: '/:pathMatch(.*)*', redirect: '/china' },
]

export default createRouter({ history: createWebHistory(), routes })

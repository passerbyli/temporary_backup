import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layout/Layout4.vue'
import AreaEntry from '@/views/AreaEntry2.vue'
import JsonToExcel from '@/views/JsontoExcel2.vue'
import JsObjectToJson from '@/views/JsObjectToJson.vue'

const routes = [
  { path: '/china', component: Layout, children: [{ path: '', component: AreaEntry }] },
  { path: '/oversea', component: Layout, children: [{ path: '', component: AreaEntry }] },
  { path: '/jsonToExcel', children: [{ path: '', component: JsonToExcel }] },
  { path: '/JsObjectToJson', children: [{ path: '', component: JsObjectToJson }] },
  { path: '/:pathMatch(.*)*', redirect: '/china' },
]

export default createRouter({ history: createWebHistory(), routes })

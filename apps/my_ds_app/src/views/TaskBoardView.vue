<template>
  <div style="height: 700px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
    <div style="display:flex; gap:12px; align-items:center;">
      <label>
        阶段：
        <select v-model="role">
          <option value="all">全部</option>
          <option value="dev">开发</option>
          <option value="test">测试</option>
        </select>
      </label>

      <label>
        人员：
        <select v-model="person">
          <option value="__all__">全部</option>
          <option v-for="p in personOptions" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>
    </div>

    <div style="flex:1; min-height:0;">
      <Gantt dayWidth="66" rowHeight="66" :tasks="filteredTasks" :taskCycle="taskCycle" :markLines="markLines"
        :role="role" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue"
import dayjs from "dayjs"
import isSameOrBefore from "dayjs/plugin/isSameOrBefore"
dayjs.extend(isSameOrBefore)

import Gantt from "./Gantt.vue"
import data from "./data/data.js"

const taskCycle = ref(data.taskCycle)
const tasks = ref(data.tasks)
const markLines = ref(data.markLines)

const role = ref("all")       // all | dev | test
const person = ref("__all__") // __all__ | someone

const d = (s) => dayjs(s).startOf("day")

const personOptions = computed(() => {
  const set = new Set()
  tasks.value.forEach(t => {
    if (t.developers) set.add(t.developers)
    if (t.testers) set.add(t.testers)
  })
  return [...set].sort()
})

const hasDevPhase = (t) => {
  return d(t.startDate).isSameOrBefore(d(t.devEndDate))
}
const hasTestPhase = (t) => d(t.devEndDate).add(1, "day").isSameOrBefore(d(t.testEndDate))
const statusWeight = (t) => (t.status === "完成" || t.status === "待发布") ? 1 : 0

const endByRole = (t) => {
  if (role.value === "dev") return d(t.devEndDate)
  // test / all：用 testEndDate 排
  return d(t.testEndDate)
}

const filteredTasks = computed(() => {
  return [...tasks.value]
    .filter(t => {
      // 人员过滤：开发/测试都可命中
      if (person.value !== "__all__") {
        if (t.developers !== person.value && t.testers !== person.value) return false
      }
      // 阶段过滤：选择开发/测试时，只保留该阶段存在的任务
      if (role.value === "dev") return hasDevPhase(t)
      if (role.value === "test") return hasTestPhase(t)
      return true
    })
    .sort((a, b) => {
      // status：完成/待发布沉底
      const sw = statusWeight(a) - statusWeight(b)
      if (sw) return sw
      // endDate 升序
      const ed = endByRole(a).diff(endByRole(b))
      if (ed) return ed
      // 兜底：startDate
      return d(a.startDate).diff(d(b.startDate))
    })
})
</script>

<style scoped>
select {
  margin-left: 6px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
}
</style>
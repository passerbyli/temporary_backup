<template>
    <el-sub-menu v-if="hasChildren" :index="fullPath">
      <template #title>
        <span>{{ item.meta?.title }}</span>
      </template>
      <MenuItem v-for="child in item.children" :key="child.path" :item="child" :base-path="fullPath"/>
    </el-sub-menu>
    <el-menu-item v-else :index="fullPath" v-show="item.meta.display">
      {{ item.meta?.title }}
    </el-menu-item>
  </template>
  
  <script setup>
  import { computed } from 'vue'
  import MenuItem from './MenuItem.vue'
  
  const props = defineProps({
    item: {
      type: Object,
      required: true,
    },
    basePath: {
      type: String,
      required: true,
    },
  })
  
  const hasChildren = computed(() =>{
      return  Array.isArray(props.item.children) && props.item.children.length > 0
    }
  )
  
  const fullPath = computed(() => {
    // 处理路径拼接，防止重复 "/"
    const base = props.basePath.endsWith('/') ? props.basePath.slice(0, -1) : props.basePath
    const path = props.item.path.startsWith('/') ? props.item.path : '/' + props.item.path
    return hasChildren.value
      ? `${base}${path}`
      : props.item.path.startsWith('/')
        ? props.item.path
        : `${base}/${props.item.path}`
  })
  </script>
  
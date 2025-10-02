<template>
  <el-config-provider>
    <!-- <TitleBar /> -->
    <router-view></router-view>
  </el-config-provider>
</template>


<script setup>
import { RouterView } from 'vue-router'
import TitleBar from './components/TitleBar.vue'

function minimize() {
  window.electronAPI?.minimize()
}
function maximize() {
  window.electronAPI?.maximize()
}
function handleDoubleClick() {
  window.electronAPI?.toggleMaximize()
}

</script>
<style>
body {
}
html,
body,
#app {
  height: 100%;
  margin: 0;
  border-radius: 16px;
  overflow: hidden;
  background-color: #fff;
}
</style>
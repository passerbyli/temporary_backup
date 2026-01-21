<template>
  <el-config-provider>
    <TitleBar />
    <router-view></router-view>
  </el-config-provider>
</template>

<script setup>
import { RouterView } from 'vue-router';
import TitleBar from './components/TitleBar.vue';


</script>
<style>
body {
  background: transparent;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>

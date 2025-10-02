<template>
  <main>
    <h1>Home</h1>
    <div style="padding: 20px">
      <el-button type="primary" @click="launchPlugin">
        打开 Chrome 并加载插件
      </el-button>
      <el-alert v-if="msg" :title="msg" type="success" show-icon style="margin-top: 16px" />
    </div>
    <div>
      <el-button type="primary" @click="open('export')">
        <el-icon>
          <FolderOpened />
        </el-icon>我的导出
      </el-button>
    </div>
    <div>
      <el-button type="primary" @click="open('log')">
        <el-icon>
          <FolderOpened />
        </el-icon>查看日志
      </el-button>
    </div>
    <div>
      <el-button type="primary" @click="open('config')">
        <el-icon>
          <FolderOpened />
        </el-icon>我的配置文件夹
      </el-button>
    </div>
    <div>
      <el-button type="primary" @click="openChrome('https://www.baidu.com')">
        <el-icon>
          <FolderOpened />
        </el-icon>打开浏览器
      </el-button>
    </div>
  </main>
</template>

<script>
import { FolderOpened } from '@element-plus/icons-vue'
import { defineComponent, onMounted, toRefs, reactive,ref } from 'vue'
import { sysOpenchrome, sysOpenDirectory } from '../services/configService'
export default defineComponent({
  name: 'HomeView',
  components: {
    FolderOpened,
  },
  setup(props, context) {
    onMounted(() => {

    })
    const msg = ref('')
    const dataMap = reactive({
      msg: msg,
      async launchPlugin() {
        await window.electronAPI.invoke('plugin:launch-chrome')
        msg.value = 'Chrome 已启动，请在新页面中点击进入插件页手动启用'

      },
      open(type) {
        sysOpenDirectory({ type: type }).then((res) => {
          console.log(res)
        }).catch((err) => {
          console.error('Error opening directory:', err)
        })
      },
      openChrome(type) {
        sysOpenchrome({ url: type })
      },
    })

    return {
      ...toRefs(dataMap),
    }
  },
})
</script>

<style></style>

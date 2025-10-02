<template>
  <el-card shadow="never">
    <el-tabs v-model="activeTab" tab-position="top">
      <!-- 全局设置 -->
      <el-tab-pane label="全局设置" name="global">
        <el-form :model="form.global" label-width="100px" label-position="left">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="语言选择">
                <el-select v-model="form.global.language" placeholder="选择语言" style="width: 100%">
                  <el-option label="中文 (zh_CN)" value="zh_CN" />
                  <el-option label="English (en_US)" value="en_US" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="菜单位置">
                <el-select v-model="form.global.menuPosition" placeholder="菜单位置" style="width: 100%">
                  <el-option label="左侧" value="left" />
                  <el-option label="顶部" value="top" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="通知开关">
                <el-switch v-model="form.global.notify.disable" active-text="关闭通知" inactive-text="开启通知" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="登录状态">
                <el-tag :type="form.global.isLogin ? 'success' : 'info'">
                  {{ form.global.isLogin ? '已登录' : '未登录' }}
                </el-tag>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="默认文件路径">
                <el-input type="text" v-model="form.global.basePath">
              <template #append>
                <el-button :icon="FolderOpened" @click="selectFolder" />
              </template>
            </el-input>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-tab-pane>

      <!-- 模块 2 -->
      <el-tab-pane label="定时任务设置" name="module2">
        <el-form :model="form.modules.module2" label-width="120px" label-position="left">
          <el-form-item label="Cron Job 1">
            <el-input v-model="form.modules.module2.cronJobs.cronJob1" placeholder="请输入 Cron 表达式" />
          </el-form-item>
          <el-form-item label="Cron Job 2">
            <el-input v-model="form.modules.module2.cronJobs.cronJob2" placeholder="请输入 Cron 表达式" />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="form.modules.module2.type" placeholder="选择类型">
              <el-option label="PI" value="PI" />
              <el-option label="非 PI" value="non-PI" />
            </el-select>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 模块 3 -->
      <el-tab-pane label="账户环境配置" name="module3">
        <el-form :model="form.modules.module3" label-width="120px" label-position="left">
          <el-form-item label="当前环境">
            <el-select v-model="form.modules.module3.currentEnv" placeholder="当前环境">
              <el-option label="beta" value="beta" />
              <el-option label="pord" value="pord" />
            </el-select>
          </el-form-item>

          <el-divider content-position="left">Beta 账户</el-divider>
          <el-form-item label="用户名">
            <el-input v-model="form.modules.module3.accounts.beta.username" placeholder="用户名" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.modules.module3.accounts.beta.password" type="password" placeholder="密码" />
          </el-form-item>

          <el-divider content-position="left">Pord 账户</el-divider>
          <el-form-item label="用户名">
            <el-input v-model="form.modules.module3.accounts.pord.username" placeholder="用户名" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.modules.module3.accounts.pord.password" type="password" placeholder="密码" />
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <!-- 操作按钮 -->
    <div class="action-btns">
      <el-button @click="reset">重置</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </div>
  </el-card>
</template>

<script setup>
import { FolderOpened } from '@element-plus/icons-vue'
import { reactive, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { defaultForm } from '../services/defaultForm.js'
import { loadConfig, saveConfig } from '../services/configService'
const form = reactive(structuredClone(defaultForm))

const activeTab = ref('global')

onMounted(async () => {
  const config = await loadConfig()
  Object.assign(form, defaultForm, config)
})

async function save() {
  await saveConfig(form)
  ElMessage.success('配置已保存')
}

function reset() {
  loadConfig().then(config => {
    Object.assign(form, config)
    ElMessage.warning('已重置为当前配置')
  })
}
async function  selectFolder(){
  if (window.ipc) {
          await window.ipc
            .sendInvoke('toMain', {
              event: 'select-folder',
            })
            .then((result) => {
              if (result) {
                form.global.basePath = result[0]
              }
            })
        }
}
</script>

<style scoped>
.action-btns {
  text-align: right;
  margin-top: 24px;
  border-top: 1px solid #eee;
  padding-top: 16px;
}
</style>
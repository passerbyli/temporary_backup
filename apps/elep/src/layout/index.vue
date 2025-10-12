<template>
  <div class="common-layout">
    <div class="main-container">
      <LayHeader />
    </div>
    <el-container>
      <div class="title-bar" @dblclick="handleDoubleClick">
        <div class="drag-region"></div>
        <div class="control-buttons">
          <el-button type="text" icon="Minus" @click="minimize" />
          <el-button type="text" icon="CopyDocument" @click="maximize" />
          <el-button type="text" icon="Close" @click="minimize" />
          <!-- ❌ 也是最小化 -->
        </div>
      </div>
      <el-header class="cus_header header-flex">
        <el-menu
          mode="horizontal"
          :default-active="activeMenu"
          class="cus-menu-horizontal"
          router
          v-show="menuPosition == 'top'"
        >
          <menu-item v-for="route in routes" :key="route.path" :item="route" :base-path="route.path" />
        </el-menu>
        <div class="operate-setting">
          <el-tooltip class="box-item" content="设置" placement="top">
            <el-icon class="sys-setting" @click="redirectSetting">
              <Setting />
            </el-icon>
          </el-tooltip>
          <div v-if="isLogin" class="sys-user">
            <el-select class="item-box" v-model="form.role" @change="handleChangeRole" placeholder="请选择">
              <el-option label="开发" value="开发" />
              <el-option label="测试" value="测试" />
              <el-option label="SM" value="SM" />
            </el-select>
            <div class="username">{{ userinfo.displayName }}</div>
            <el-button plain @click="openLoginWin()">注销</el-button>
          </div>
          <div v-else>
            <el-button plain @click="openLoginWin()">登录</el-button>
          </div>
        </div>
      </el-header>
      <el-container class="classic-content">
        <el-aside class="left-side" width="200px" v-show="menuPosition == 'left'">
          <el-menu :default-active="activeMenu" class="cus-menu-vertical" router>
            <menu-item v-for="route in routes" :key="route.path" :item="route" :base-path="route.path" />
          </el-menu>
        </el-aside>
        <el-container class="classic-main">
          <el-main>
            <RouterView />
          </el-main>
        </el-container>
      </el-container>

      <el-footer class="cus_footer classic-footer">Footer</el-footer>
    </el-container>
    <el-dialog
      v-model="dialogVisible"
      title="登录"
      draggable
      show-close="false"
      close-on-press-escape="false"
      close-on-click-modal="false"
    >
      <el-form :model="form" label-width="auto">
        <el-form-item label="角色">
          <el-select v-model="form.role" placeholder="">
            <el-option value="开发">开发</el-option>
            <el-option value="测试">测试</el-option>
            <el-option value="SM">SM</el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" />
        </el-form-item>
        <el-alert v-if="loginReqError" :title="loginMsg" type="error" effect="dark" :closable="false" />
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleLogin">登录</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ElMessage } from 'element-plus';
import { Setting } from '@element-plus/icons-vue';
import { loadConfig } from '../services/configService';
import { defineComponent, h, computed, ref, onMounted, reactive } from 'vue';
import { RouterView, useRouter, useRoute } from 'vue-router';

import { defaultForm } from '../services/defaultForm.ts';
import { login, changeRole } from '../services/authService.ts';
import MenuItem from './MenuItem.vue'; // 递归组件

const isLogin = ref(false);
let form = reactive(structuredClone(defaultForm));
const dialogVisible = ref(false);
const loginReqError = ref(false);
const menuPosition = ref('top');
const loginMsg = ref('');
const appInfo = ref('');
const userinfo = ref({
  role: '',
  username: '',
  displayName: '',
});

onMounted(async () => {
  const config = await loadConfig();

  menuPosition.value = config.global.menuPosition || 'top';
  form.value = Object.assign(form, defaultForm, config.global.auth);
  if (config.global.auth?.username && config.global.auth.password && config.global.auth.role) {
    const res = await login(config.global.auth.username, config.global.auth.password, config.global.auth.role);
    handleLogin2(res);
  }
  if (window.ipc) {
    await window.authApi.authLogin();
    window.ipc.receive('fromMain', (data) => {
      if (data && data.event) {
        if (data.event === 'console') {
          console.log('%c助手：', 'color:#fff;font-size:14px', data.data);
        } else if (data.event == 'loginInfo') {
          isLogin.value = data.data?.global?.isLogin;
          if (data.data?.global?.isLogin) {
            userinfo.value = data.data.global.auth;
            form.value = {
              username: data.data.global.auth.username,
              password: data.data.global.auth.password,
              role: data.data.global.auth.role,
            };
          } else {
          }
        } else if (data.event == 'appNewVersion') {
          console.log(data.data);
        }
      }
    });
    await window.ipc.sendInvoke('toMain', { event: 'appInfo' }).then((res) => {
      appInfo.value = {
        version: res.version,
      };
    });
  }
});

const { push } = useRouter();
const redirectSetting = () => {
  push(`/setting`);
};

const router = useRouter();
const route = useRoute();
// 获取当前激活的菜单项
const activeMenu = computed(() => route.path);

function filterDisplayRoutes(routes) {
  return routes
    .map((route) => {
      // 如果有 children，递归过滤
      const children = route.children ? filterDisplayRoutes(route.children) : [];

      // 如果自己 display 为 true 或 有合法子节点，则保留
      if (route.meta?.display || children.length > 0) {
        return {
          ...route,
          // 只保留过滤后的 children
          children: children.length > 0 ? children : undefined,
        };
      }

      // 否则过滤掉
      return null;
    })
    .filter(Boolean); // 去掉 null
}

// 过滤出有 meta.title 的路由作为菜单显示
const routes = computed(() => {
  let list = router.options.routes[0].children.filter((r) => r.meta.title || (r.children && r.children.length));
  list = filterDisplayRoutes(list);
  return list;
});

const openLoginWin = () => {
  dialogVisible.value = true;
};

const handleChangeRole = async (item) => {
  const res = await changeRole(item);
  if (res) {
    window.ipc?.refreshWindow();
  }
};

const handleLogin = async () => {
  const res = await login(form.username, form.password, form.role);
  handleLogin2(res);
};

const handleLogin2 = (res) => {
  if (res.success) {
    isLogin.value = res.global.isLogin;
    ElMessage.success('登录成功');
    if (res.type == 'error') {
      loginReqError.value = true;
      loginMsg.value = res.message;
    } else if (res.message == '用户名或密码错误') {
      loginReqError.value = true;
      loginMsg.value = res.message;
    } else {
      userinfo.value = res.global.auth;
      form.value = {
        username: res.global.auth.username,
        password: res.global.auth.password,
        role: res.global.auth.role,
      };
      dialogVisible.value = false;
    }
  } else {
    ElMessage.error(res.message || '登录失败');
  }
};

const LayHeader = defineComponent({
  name: 'LayHeader',
  render() {
    return h(
      'div',
      {
        class: { 'fixed-header': true },
        style: ['box-shadow: 0 1px 4px #0d0d0d'],
      },
      {
        default: () => [null, null, null, null],
      },
    );
  },
});
</script>
<style lang="scss" scoped>
.common-layout {
  position: relative;
  height: 100vh;
  width: 100%;
  padding: 0;
  margin: 0;
}

.el-container {
  width: 100%;
  height: 100%;

  .classic-content {
    display: flex;
    height: calc(100% - 50px - 40px);
  }

  .classic-main {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }
}

.header-flex {
  display: flex;
  align-items: center;
  height: 40px;

  .header-lf {
    width: 180px;
  }

  .operate-setting {
    margin-left: auto;
    display: flex;
    align-items: center;

    &:focus {
      outline: none;
    }
  }
}

.sys-user {
  display: flex;
  align-items: center;

  .username {
    margin-right: 10px;
    color: #fff;
  }

  .item-box {
    width: 100px;
    margin-right: 10px;
  }
}

.sys-setting {
  margin: 0 10px 0 0;
  padding: 5px;
  height: 28px;
  width: 28px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
}

.cus_header {
  background: var(--color2);
}

.left-side {
  background: var(--color2);
}

.classic-footer {
  height: 30px;
  line-height: 30px;
  color: var(--vt-c-white);
  background: var(--color2);
}
</style>
<style lang="scss">
.el-menu {
  background-color: var(--color2);
  color: var(--vt-c-white);
}

.el-menu-item.is-active {
  color: var(--vt-c-white);
}

.el-menu-item:hover {
  background-color: var(--color2);
}

.el-sub-menu__title:hover {
  background-color: var(--color2);
}

.cus-menu-vertical .el-menu-item.is-active {
}

.cus-menu-horizontal {
  height: 40px;
  min-width: 570px;
}

.cus-menu-horizontal.el-menu--horizontal > .el-menu-item.is-active {
}

.cus-menu-horizontal.el-menu--horizontal > .el-sub-menu.is-active .el-sub-menu__title {
}
</style>

<style scoped>
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 36px;
  padding: 0 10px;
  background-color: #2c3e50;
  color: white;
  -webkit-app-region: drag;
  /* 可拖动区域 */
  user-select: none;
}

.control-buttons {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
  /* 按钮不可拖动 */
}
</style>

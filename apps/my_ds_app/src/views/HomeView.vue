<template>
  <main class="home">
    <section class="hero">
      <h1>Home {{ currentTheme }}</h1>
      <el-select v-model="currentTheme" placeholder="选择主题" style="width: 100%">
        <el-option label="默认" value="light" />
        <el-option label="梦幻" value="dreamy" />
        <el-option label="中国红" value="china-red" />
      </el-select>
    </section>
    <section class="content">
      <div class="actions">
        <div class="action-card">
          <div class="action-title">插件启动</div>
          <div class="action-desc">打开 Chrome 并自动加载插件环境</div>
          <el-button class="action-btn" type="primary" @click="launchPlugin">打开 Chrome 并加载插件</el-button>
          <el-alert v-if="msg" :title="msg" type="success" show-icon class="action-alert" />
        </div>
        <div class="action-card">
          <div class="action-title">常用目录</div>
          <div class="action-desc">快速定位导出、日志与配置</div>
          <div class="action-grid">
            <el-button class="ghost-btn" type="primary" @click="open('export')">
              <el-icon>
                <FolderOpened />
              </el-icon>我的导出
            </el-button>
            <el-button class="ghost-btn" type="primary" @click="open('log')">
              <el-icon>
                <FolderOpened />
              </el-icon>查看日志
            </el-button>
            <el-button class="ghost-btn" type="primary" @click="open('config')">
              <el-icon>
                <FolderOpened />
              </el-icon>我的配置文件夹
            </el-button>
            <el-button class="ghost-btn" type="primary" @click="openChrome('https://www.baidu.com')">
              <el-icon>
                <FolderOpened />
              </el-icon>打开浏览器
            </el-button>
          </div>
        </div>
      </div>
      <el-card class="log-card">
        <div class="log-head">
          <div class="log-title">运行日志</div>
          <div class="log-sub">实时输出，便于排查问题</div>
        </div>
        <el-scrollbar class="log-scroll">
          <pre class="log-content">{{ logsContent }}</pre>
        </el-scrollbar>
      </el-card>
    </section>
  </main>
</template>

<script>
import { FolderOpened, CloseBold, Minus, Plus } from '@element-plus/icons-vue';
import { defineComponent, onMounted, toRefs, reactive, ref, watch } from 'vue';
import { sysOpenchrome, sysOpenDirectory } from '../services/configService';
export default defineComponent({
  name: 'HomeView',
  components: {
    FolderOpened, CloseBold, Minus, Plus
  },
  setup(props, context) {
    const logsContent = ref('');
    const currentTheme = ref('china-red');
    onMounted(() => {

      if (window.ipc) {
        window.ipc.receive("fromMain", (data) => {
          // 消息数据包含 event 和 data 两个属性
          if (data && data.event) {
            if (data.data.event === 'systemLog') {
              console.log(data.data.data.path)
              logsContent.value += data.data.data.path + '\n';
            }
          }
        });
      } else {
        console.warn('[HomeView] ✗ window.ipc is not available');
      }
      applyTheme(currentTheme.value)
    });
    watch(
      () => currentTheme.value,
      (theme) => {
        applyTheme(theme);
      },
    );

    function applyTheme(theme) {
      console.log(theme)
      const nextTheme = theme || 'light';
      document.documentElement.dataset.theme = nextTheme;
    }
    const msg = ref('');
    const dataMap = reactive({
      currentTheme: currentTheme,
      logsContent: logsContent,
      msg: msg,
      async launchPlugin() {
        await window.electronAPI.invoke('plugin:launch-chrome');
        msg.value = 'Chrome 已启动，请在新页面中点击进入插件页手动启用';
      },
      open(type) {
        sysOpenDirectory({ type: type })
          .then((res) => {
            // 记录不同级别的日志
            window.logger.info('操作成功', { action: 'openDir' });
            window.logger.warn('警告信息', { code: 401 });
            window.logger.error('错误信息', { error: 'Network failed' });
            window.logger.debug('调试信息');

            // 或直接使用通用 log 方法
            window.logger.log('info', '消息内容', { extra: 'data' });

            // 打开日志目录
            window.logger.openLogDir();

          })
          .catch((err) => {
            console.error('Error opening directory:', err);
          });
      },
      openChrome(type) {
        sysOpenchrome({ url: type });
      },
      min() {
        console.log('xxxx')
        window.electronAPI.minimize()
      },
      max() {
        console.log('xxxx')
        window.electronAPI.maximize()
      }
    });

    return {
      ...toRefs(dataMap),
    };
  },
});
</script>

<style>
main.home {
  background: radial-gradient(circle at top left, #fff4df 0%, #f3f1ec 40%, #f0ede6 100%);
  min-height: 100%;
  color: var(--ink-900);
}

.hero {
  padding: 28px 24px 0;
}

.hero h1 {
  font-size: 32px;
  margin: 0;
}

.hero p {
  margin: 8px 0 0;
  color: var(--ink-500);
}

.content {
  padding: 20px 24px 32px;
  display: grid;
  gap: 20px;
}

.actions {
  display: grid;
  gap: 18px;
}

.action-card {
  background: var(--surface);
  border-radius: 18px;
  padding: 20px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.action-title {
  font-weight: 600;
  font-size: 18px;
}

.action-desc {
  margin-top: 6px;
  color: var(--ink-500);
}

.action-btn {
  margin-top: 16px;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), #f29f8b);
  border: none;
}

.action-alert {
  margin-top: 14px;
  border-radius: 12px;
}

.action-grid {
  margin-top: 16px;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.ghost-btn {
  border-radius: 12px;
  background: rgba(79, 124, 172, 0.12);
  border: 1px solid rgba(79, 124, 172, 0.25);
  color: var(--ink-900);
}

.log-card {
  border-radius: 18px;
  border: 1px solid var(--border);
  background: #fff;
  box-shadow: var(--shadow);
}

.log-head {
  padding: 16px 20px 0;
}

.log-title {
  font-weight: 600;
  font-size: 18px;
}

.log-sub {
  color: var(--ink-500);
  margin-top: 4px;
}

.log-scroll {
  height: 220px;
  margin: 12px 16px 16px;
  border-radius: 12px;
  border: 1px solid rgba(20, 22, 27, 0.08);
  background: #f9f8f5;
}

.log-content {
  padding: 12px;
  color: var(--ink-700);
  font-size: 12px;
  line-height: 1.6;
}

@media (min-width: 920px) {
  .actions {
    grid-template-columns: 1.1fr 1.5fr;
  }
}
</style>

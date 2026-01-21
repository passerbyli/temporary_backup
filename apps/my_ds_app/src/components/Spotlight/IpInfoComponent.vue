<template>
  <div class="ip-info-container">
    <div class="ip-info-title">IP 信息</div>
    <div class="ip-info-content">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else class="ip-info-details">
        <div v-if="ipInfo.ipv4" class="ip-item" @click="copyToClipboard(ipInfo.ipv4)">
          <span class="label">IPv4:</span>
          <span class="value">{{ ipInfo.ipv4[0]?.address || 'N/A' }}</span>
          <span class="copy-icon">📋</span>
        </div>
        <div v-if="ipInfo.ipv6" class="ip-item" @click="copyToClipboard(ipInfo.ipv6)">
          <span class="label">IPv6:</span>
          <span class="value">{{ ipInfo.ipv6[0]?.address || 'N/A' }}</span>
          <span class="copy-icon">📋</span>
        </div>
        <div v-if="ipInfo.mac" class="ip-item" @click="copyToClipboard(ipInfo.mac)">
          <span class="label">MAC:</span>
          <span class="value">{{ ipInfo.mac[0]?.address || 'N/A' }}</span>
          <span class="copy-icon">📋</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const ipInfo = ref({
  ipv4: '',
  ipv6: '',
  mac: ''
});
const loading = ref(false);

// 获取 IP 信息
async function fetchIpInfo() {
  loading.value = true;
  try {
    const result = await window.spotlightApi.getIpInfo();
    ipInfo.value = {
      ipv4: result.ipv4 || '',
      ipv6: result.ipv6 || '',
      mac: result.mac || ''
    };
  } catch (error) {
    console.error('Failed to fetch IP info:', error);
  } finally {
    loading.value = false;
  }
}

// 复制到剪贴板
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    // 可以添加复制成功的提示
    console.log('Copied to clipboard:', text);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}

onMounted(() => {
  fetchIpInfo();
});
</script>

<style scoped>
.ip-info-container {
  background: rgba(255, 255, 255, .85);
  border-radius: 15px;
  padding: 12px;
  margin: 8px 0;
  border: 1px solid rgba(0, 120, 255, 0.2);
  -webkit-app-region: no-drag;
}

.ip-info-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  padding-bottom: 4px;
  font-weight: 700;
  border-bottom: 1px solid rgba(0, 120, 255, 0.1);
}

.ip-info-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.loading {
  font-size: 13px;
  color: #666;
  text-align: center;
  padding: 20px 0;
}

.ip-info-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: background 0.18s;
  padding: 4px 8px;
  border-radius: 4px;
}


.ip-item .label {
  font-weight: 500;
  color: #666;
  min-width: 70px;
}

.ip-item .value {
  flex: 1;
  color: #333;
  font-size: 12px;
}

.ip-item .copy-icon {
  color: #0078ff;
  font-size: 12px;
}
</style>

<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";

const data = ref(null);
const killing = ref(null);

let offSample = null;
let offErr = null;

onMounted(async () => {
    offSample = window.sysMonitor.onSample((payload) => {
        data.value = payload;
    });

    offErr = window.sysMonitor.onError(console.error);

    await window.sysMonitor.start({
        intervalMs: 1500,
        top: 5,
    });
});

onBeforeUnmount(async () => {
    if (offSample) offSample();
    if (offErr) offErr();
    await window.sysMonitor.stop();
});

async function killProcess(pid, force = false) {
    const tip = force ? `确定要强制结束进程 ${pid} 吗？` : `确定要结束进程 ${pid} 吗？`;
    if (!confirm(tip)) return;

    killing.value = pid;
    const res = await window.sysMonitor.kill(pid, force);
    killing.value = null;

    if (!res.ok) alert("结束失败: " + res.message);
}
</script>

<template>
    <div style="padding: 16px">
        <div v-if="!data">loading...</div>

        <div v-else>
            <h3>System</h3>
            <div>CPU: {{ data.cpu.percent.toFixed(2) }}%</div>
            <div>MEM: {{ data.mem.percent.toFixed(2) }}%</div>

            <!-- CPU Top 表格 -->
            <h3 style="margin-top: 20px">Top 5 CPU</h3>

            <table class="monitor-table">
                <thead>
                    <tr>
                        <th>PID</th>
                        <th>进程名</th>
                        <th>CPU%</th>
                        <th>MEM%</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="p in data.top.cpu" :key="'cpu-' + p.pid">
                        <td>{{ p.pid }}</td>
                        <td>{{ p.name }}</td>
                        <td>{{ p.cpu.toFixed(1) }}</td>
                        <td>{{ p.mem.toFixed(1) }}</td>
                        <td>
                            <button class="kill-btn" :disabled="killing === p.pid" @click="killProcess(p.pid, false)">
                                {{ killing === p.pid ? "..." : "End" }}
                            </button>
                            <button class="kill-btn force" :disabled="killing === p.pid"
                                @click="killProcess(p.pid, true)">
                                Force
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- MEM Top 表格 -->
            <h3 style="margin-top: 20px">Top 5 MEM</h3>

            <table class="monitor-table">
                <thead>
                    <tr>
                        <th>PID</th>
                        <th>进程名</th>
                        <th>MEM%</th>
                        <th>CPU%</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="p in data.top.mem" :key="'mem-' + p.pid">
                        <td>{{ p.pid }}</td>
                        <td>{{ p.name }}</td>
                        <td>{{ p.mem.toFixed(1) }}</td>
                        <td>{{ p.cpu.toFixed(1) }}</td>
                        <td>
                            <button class="kill-btn" :disabled="killing === p.pid" @click="killProcess(p.pid)">
                                {{ killing === p.pid ? "..." : "Kill" }}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.monitor-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 14px;
}

.monitor-table th,
.monitor-table td {
    border: 1px solid #ddd;
    padding: 6px 8px;
    text-align: left;
}

.monitor-table th {
    background: #f3f3f3;
    font-weight: 600;
}

.kill-btn {
    background: #e53935;
    color: white;
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 4px;
}

.kill-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.kill-btn.force {
    margin-left: 8px;
    background: #6d4c41;
}
</style>
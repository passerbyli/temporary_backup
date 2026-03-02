// src/shared/sysinfo/collector.js
const si = require('systeminformation');

function ema(prev, next, alpha = 0.35) {
  if (prev == null) return next;
  return prev + alpha * (next - prev);
}

// macOS 内存口径：更贴近“活动监视器”的“内存”占用
function calcMemPercent(mem) {
  const macLikeUsed = (mem.active || 0) + (mem.wired || 0) + (mem.compressed || 0);
  const used = macLikeUsed > 0 ? macLikeUsed : mem.used;
  return (used / mem.total) * 100;
}

function topN(list, key, n = 5) {
  return [...list]
    .sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))
    .slice(0, n)
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      cpu: Number(p.cpu || 0), // mac 上可能 >100（多核叠加）
      mem: Number(p.mem || 0), // 占总内存百分比
      user: p.user || '',
      command: p.command || '',
    }));
}

/**
 * 单次采样（不平滑）
 */
async function sampleOnce({ top = 5 } = {}) {
  const [load, mem, procs] = await Promise.all([si.currentLoad(), si.mem(), si.processes()]);

  const list = procs.list || [];

  return {
    ts: Date.now(),
    cpu: {
      percent: load.currentLoad, // 0~100 整机平均
      perCore: (load.cpus || []).map((c) => c.load),
    },
    mem: {
      percent: calcMemPercent(mem),
      total: mem.total,
      used: mem.used,
      free: mem.free,
      active: mem.active,
      wired: mem.wired,
      compressed: mem.compressed,
    },
    top: {
      cpu: topN(list, 'cpu', top),
      mem: topN(list, 'mem', top),
    },
  };
}

/**
 * 创建一个带平滑的采样器（把“状态”封装在 sampler 内）
 */
function createSampler({ alpha = 0.35, top = 5 } = {}) {
  let lastCpu = null;
  let lastMem = null;

  return {
    async sample() {
      const data = await sampleOnce({ top });
      data.cpu.percent = ema(lastCpu, data.cpu.percent, alpha);
      data.mem.percent = ema(lastMem, data.mem.percent, alpha);
      lastCpu = data.cpu.percent;
      lastMem = data.mem.percent;
      return data;
    },
  };
}

module.exports = {
  sampleOnce,
  createSampler,
};

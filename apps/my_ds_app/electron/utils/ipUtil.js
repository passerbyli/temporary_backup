const os = require('os');

/**
 * 获取本机 IP 地址和 MAC 地址信息
 * @returns {Object} 包含 IPv4、IPv6 和 MAC 地址的对象
 */
function getIpInfo() {
  const interfaces = os.networkInterfaces();
  const info = {
    ipv4: [],
    ipv6: [],
    mac: []
  };

  for (const name in interfaces) {
    const iface = interfaces[name];
    for (const addr of iface) {
      // 收集 IPv4 地址
      if (addr.family === 'IPv4') {
        info.ipv4.push({
          interface: name,
          address: addr.address,
          netmask: addr.netmask,
          internal: addr.internal
        });
      }
      // 收集 IPv6 地址
      if (addr.family === 'IPv6') {
        info.ipv6.push({
          interface: name,
          address: addr.address,
          scopeid: addr.scopeid,
          internal: addr.internal
        });
      }
      // 收集 MAC 地址
      if (addr.mac) {
        info.mac.push({
          interface: name,
          mac: addr.mac
        });
      }
    }
  }

  return info;
}

/**
 * 获取主要的本地 IPv4 地址（不包括 127.0.0.1）
 * @returns {string} IPv4 地址
 */
function getMainIpv4() {
  const interfaces = os.networkInterfaces();
  
  for (const name in interfaces) {
    const iface = interfaces[name];
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  
  return 'N/A';
}

/**
 * 获取格式化的 IP 信息字符串
 * @returns {string} 格式化的 IP 信息
 */
function getFormattedIpInfo() {
  const info = getIpInfo();
  let result = 'IP 信息\n';
  result += '═══════════════════════════════════\n';
  
  // 显示 IPv4
  if (info.ipv4.length > 0) {
    result += '\n🌐 IPv4 地址:\n';
    info.ipv4.forEach((ip, idx) => {
      result += `  ${idx + 1}. 接口: ${ip.interface}\n`;
      result += `     地址: ${ip.address}\n`;
      if (!ip.internal) {
        result += `     (外部地址)\n`;
      }
    });
  }
  
  // 显示 MAC
  if (info.mac.length > 0) {
    result += '\n🔧 MAC 地址:\n';
    info.mac.forEach((mac, idx) => {
      result += `  ${idx + 1}. ${mac.interface}: ${mac.mac}\n`;
    });
  }
  
  return result;
}

module.exports = {
  getIpInfo,
  getMainIpv4,
  getFormattedIpInfo
};

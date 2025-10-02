#!/bin/sh
set -e

# ====== 基本参数（按需覆盖）======
# 若只需要本容器访问 Consul/.NET，设为 1（绑定 127.0.0.1）
LOCAL_ONLY="${LOCAL_ONLY:-0}"

# VMPORT 如果是 "IP:PORT"（你原脚本的用法）
VMPORT="${VMPORT:-}"

# .NET 应用端口
APP_PORT="${APP_PORT:-8080}"

# Consul 端口（不用的统一设为 -1，可按需打开）
HTTP_PORT="${HTTP_PORT:-8500}"   # Web/API
GRPC_PORT="${GRPC_PORT:--1}"
DNS_PORT="${DNS_PORT:--1}"
HTTPS_PORT="${HTTPS_PORT:--1}"

# Sidecar 端口范围（不用 Connect 就都设为 -1）
SIDECAR_MIN="${SIDECAR_MIN:-20000}"
SIDECAR_MAX="${SIDECAR_MAX:-20100}"

# 固定 Serf LAN 端口（避免“动态”端口）
SERF_LAN_PORT="${SERF_LAN_PORT:-8301}"

# Consul 基础参数
CONSUL_NODE="${CONSUL_NODE:-service_name}"
CONSUL_CONFIG_DIR="${CONSUL_CONFIG_DIR:-/opt/consul/config}"   # 这是“目录”！
CONSUL_POLICY_FILE="${CONSUL_POLICY_FILE:-/opt/consul/config/client_policy.json}" # 你的 JSON 文件
CONSUL_SERVER="${CONSUL_SERVER:-}"   # 用于 retry_join 的 server 地址（必填）
AGENT_TOKEN="${AGENT_TOKEN:-}"       # ACL token（必填）

# ====== 计算绑定地址 ======
if [ "$LOCAL_ONLY" = "1" ]; then
  BIND_IP="127.0.0.1"
else
  # 容器 IPv4（优先 eth0）
  BIND_IP="$(ip -o -4 addr show eth0 2>/dev/null | awk '{print $4}' | cut -d/ -f1)"
  [ -z "$BIND_IP" ] && BIND_IP="$(hostname -i | awk '{print $1}')"
fi

# 从 VMPORT 拆出 advertise IP 和 serf 端口（若 VMPORT 为 IP:PORT）
if [ -n "$VMPORT" ]; then
  ADV_IP="${VMPORT%%:*}"
  SERF_LAN_PORT_FROM_VMPORT="${VMPORT##*:}"
  # 如果 VMPORT 带了端口，就覆盖 SERF_LAN_PORT
  [ "$SERF_LAN_PORT_FROM_VMPORT" != "$ADV_IP" ] && SERF_LAN_PORT="$SERF_LAN_PORT_FROM_VMPORT"
else
  ADV_IP="$BIND_IP"
fi

# ====== 渲染你的 client_policy.json（注意：这是“文件”）======
# 你原本 sed 的两个占位符替换，这里保留
sed -i "s/{token}/$AGENT_TOKEN/g" "$CONSUL_POLICY_FILE"
sed -i "s/{server}/$CONSUL_SERVER/g" "$CONSUL_POLICY_FILE"

# ====== 额外生成一个“网络与端口覆写” JSON（文件）======
CONSUL_NET_JSON="/tmp/consul-net-ports.json"
cat > "$CONSUL_NET_JSON" <<EOF
{
  "client_addr": "${BIND_IP}",
  "bind_addr": "${BIND_IP}",
  "addresses": {
    "http": "${BIND_IP}",
    "https": "${BIND_IP}",
    "grpc": "${BIND_IP}",
    "dns":  "${BIND_IP}"
  },
  "ports": {
    "http": ${HTTP_PORT},
    "https": ${HTTPS_PORT},
    "grpc": ${GRPC_PORT},
    "dns": ${DNS_PORT},
    "sidecar_min_port": ${SIDECAR_MIN},
    "sidecar_max_port": ${SIDECAR_MAX},
    "serf_lan": ${SERF_LAN_PORT}
  }
}
EOF

# ====== 启动 Consul（注意：-config-dir 传目录，-config-file 传文件）======
# -advertise 只能是 IP，不要带端口
consul agent \
  -node="$CONSUL_NODE" \
  -advertise="$ADV_IP" \
  -client="$BIND_IP" \
  -config-dir="$CONSUL_CONFIG_DIR" \
  -config-file="$CONSUL_NET_JSON" \
  -bind="$BIND_IP" \
  -serf-lan-port="$SERF_LAN_PORT" \
  >/tmp/consul.log 2>&1 &

# ====== 启动 .NET 服务，限制监听地址 ======
APP_BIND="$BIND_IP"
export ASPNETCORE_URLS="http://${APP_BIND}:${APP_PORT}"

# 也可以： dotnet xxx.dll --urls "http://${APP_BIND}:${APP_PORT}"
exec dotnet /app/xxx.dll
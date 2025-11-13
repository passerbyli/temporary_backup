#!/usr/bin/env sh
set -e

# 原有逻辑
Container_IP=`ifconfig eth0 | grep 'inet ' | awk '{print $2}'`
SerfLanPort=`echo ${VMPORT} | awk -F ':' '{print $2}'`

sed -i 's/{token}/'"${AGENT_TOKEN}"'/g' "./consul/config/client_policy.json"
sed -i 's/{server}/'"${CONSUL_SERVER}"'/g' "./consul/config/client_policy.json"
sed -i "s|{self_lan}|${SerfLanPort}|g" "./client_policy.json"

consul agent \
 -node=''"{env}"'_xxx_service_'$VMIP'_'$Container_IP \
 -advertise=${VMIP} \
 -config-file=./client_policy.json \
 -self-lan-port=$SerfLanPort &

export ASPNETCORE_URLS="http://${Container_IP}:${APP_PORT}"

########################################
# 新增：创建非 root 用户并切换身份
########################################

APP_USER="netcore"      # 你自定义的应用用户
APP_UID="10001"         # 任意非 0 且不冲突的 UID
APP_HOME="/home/${APP_USER}"
APP_DIR="$(pwd)"        # 你的服务目录，按实际情况改

# 1. 如果用户不存在，则创建
if ! id "${APP_USER}" >/dev/null 2>&1; then
  # 优先尝试 adduser（Alpine 常用），失败再尝试 useradd（Debian/Ubuntu 常用）
  adduser -D -H -u "${APP_UID}" "${APP_USER}" 2>/dev/null || \
  useradd -m -d "${APP_HOME}" -u "${APP_UID}" "${APP_USER}"
fi

# 2. 确保应用目录对该用户有权限（至少读 & 写日志等）
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" 2>/dev/null || true
chown -R "${APP_USER}:${APP_USER}" /app /app/logs

# 3. 用新用户启动 netcore 服务
#   - 保留环境变量（ASPNETCORE_URLS 等）
#   - 用 exec 确保 dotnet 成为容器的 PID 1
if command -v su >/dev/null 2>&1; then
  # exec su -s /bin/sh -c "exec dotnet xxx.Service.dll" "${APP_USER}"

# 组装给 su 执行的脚本片段，多行写清楚
APP_CMD=$(cat <<EOF
export ASPNETCORE_URLS="http://${Container_IP}:${APP_PORT}"
# 如有需要可以 cd 到指定目录
# cd /app
exec dotnet xxx.Service.dll
EOF
)

# 用非 root 用户执行上面的脚本片段
exec su -s /bin/sh "${APP_USER}" -c "${APP_CMD}"


else
  echo "WARN: 容器内没有 su 命令，只能继续用 root 启动 dotnet"
  exec dotnet xxx.Service.dll
fi
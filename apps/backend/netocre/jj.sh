#!/bin/sh
set -e

APP_USER=appuser
APP_UID=${APP_UID:-10001}

# 只有 root 才创建用户
if [ "$(id -u)" -eq 0 ]; then
  # 创建用户（不指定组）
  if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd -u "$APP_UID" -M -s /sbin/nologin "$APP_USER" 2>/dev/null \
      || adduser -D -H -u "$APP_UID" -s /sbin/nologin "$APP_USER" 2>/dev/null
  fi

  # 把当前目录所有权给用户
  chown -R "$APP_USER" .
fi

# 原来你的逻辑
Container_IP=`ifconfig eth0 | grep 'inet ' | awk '{print $2}'`
SerfLanPort=`echo ${VMPORT}|awk -F ':' '{print $2}'`

sed -i 's/{token}/'"${AGENT_TOKEN}"'/g' "./consul/config/client_policy.json"
sed -i 's/{server}/'"${CONSUL_SERVER}"'/g' "./consul/config/client_policy.json"

chmod +x xxx.dll

# 非 root 启动
if [ "$(id -u)" -eq 0 ]; then
  exec su -s /bin/sh "$APP_USER" -c \
"consul agent -node=service_name -advertise $VMIP -client $Container_IP -config-dir=./consul/config/client_policy.json -serf-lan-port $SerfLanPort & exec dotnet xxx.dll"
else
  consul agent ... & exec dotnet xxx.dll
fi
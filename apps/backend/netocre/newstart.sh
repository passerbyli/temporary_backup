#!/bin/sh
set -e

########################################
# 1. 定义要使用的非 root 用户信息（新增）
########################################
APP_USER=appuser       # 你想用的运行账号名
APP_GROUP=appgroup     # 对应的组名
APP_UID=${APP_UID:-10001}  # 可通过环境变量覆盖
APP_GID=${APP_GID:-10001}

########################################
# 2. 如果现在是 root，就创建用户并修改权限（新增）
########################################
if [ "$(id -u)" -eq 0 ]; then
  # 创建组（兼容 debian/ubuntu 的 groupadd 和 alpine 的 addgroup）
  if ! getent group "$APP_GROUP" >/dev/null 2>&1; then
    groupadd -g "$APP_GID" "$APP_GROUP" 2>/dev/null \
      || addgroup -g "$APP_GID" "$APP_GROUP" 2>/dev/null \
      || true
  fi

  # 创建用户（兼容 useradd / adduser）
  if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd -u "$APP_UID" -g "$APP_GROUP" -M -s /sbin/nologin "$APP_USER" 2>/dev/null \
      || adduser -D -H -u "$APP_UID" -G "$APP_GROUP" "$APP_USER" 2>/dev/null \
      || true
  fi

  # 把当前目录下的文件权限交给这个用户（按需收紧）
  chown -R "$APP_USER:$APP_GROUP" . 2>/dev/null || true
fi

########################################
# 3. 你原来的逻辑（保持不变）
########################################
Container_IP=`ifconfig eth0 | grep 'inet ' | awk '{print $2}'`
SerfLanPort=`echo ${VMPORT}|awk -F ':' '{print $2}'`

sed -i 's/{token}/'"${AGENT_TOKEN}"'/g' "./consul/config/client_policy.json"
sed -i 's/{server}/'"${CONSUL_SERVER}"'/g' "./consul/config/client_policy.json"

chmod +x xxx.dll

########################################
# 4. 用非 root 用户启动服务（核心改动）
########################################
if [ "$(id -u)" -eq 0 ]; then
  # 当前是 root，用 su 切到 appuser 再启动 consul + dotnet
  exec su -s /bin/sh "$APP_USER" -c \
"consul agent -node=service_name -advertise $VMIP -client $Container_IP -config-dir=./consul/config/client_policy.json -serf-lan-port $SerfLanPort & exec dotnet xxx.dll"
else
  # 当前本身就不是 root，按老方式启动
  consul agent -node=service_name -advertise $VMIP -client $Container_IP -config-dir=./consul/config/client_policy.json -serf-lan-port $SerfLanPort & exec dotnet xxx.dll
fi
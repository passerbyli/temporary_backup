# ========= 从这里开始是替换原来 exec dotnet 的部分 =========

APP_USER="netcore"
APP_UID="10001"

# 1. 创建非 root 用户（如果已经存在就不会报错）
if ! id "${APP_USER}" >/dev/null 2>&1; then
  adduser -D -H -u "${APP_UID}" "${APP_USER}" 2>/dev/null || \
  useradd -m -u "${APP_UID}" "${APP_USER}"
fi

# 2. 给应用目录和 consul 目录授权（按实际情况改路径）
APP_DIR="$(pwd)"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" ./consul 2>/dev/null || true
mkdir -p /tmp && chmod 1777 /tmp || true

# 3. 找到 dotnet 的真实路径，并确保所有用户都可执行
DOTNET_PATH="$(command -v dotnet 2>/dev/null || echo "")"
if [ -z "$DOTNET_PATH" ]; then
  echo "ERROR: dotnet not found in PATH" >&2
  exit 1
fi
chmod a+rx "$DOTNET_PATH" || true

# 4. 组装要以非 root 用户执行的命令（多行好读）
APP_CMD=$(cat <<EOF
export ASPNETCORE_URLS="http://${Container_IP}:${APP_PORT}"
exec "${DOTNET_PATH}" xxx.Service.dll
EOF
)

# 5. 用 su 切到 APP_USER，用 /bin/sh 当 shell 来执行上面的脚本片段
if command -v su >/dev/null 2>&1; then
  exec su -s /bin/sh "${APP_USER}" -c "${APP_CMD}"
else
  echo "WARN: su not found, fallback to root"
  export ASPNETCORE_URLS="http://${Container_IP}:${APP_PORT}"
  exec "${DOTNET_PATH}" xxx.Service.dll
fi
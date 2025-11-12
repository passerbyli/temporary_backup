#!/usr/bin/env sh
# prove-root-only.sh
# 目的：在容器内检测是否具备“非 root 运行”条件；必要时给出可复现的失败证据。
# 兼容 /bin/sh；无需外网。

set -eu

# ===== 可配置项 =====
# 以非 root 试跑时使用的 UID/GID（不需要在 /etc/passwd 存在）
RUN_UID="${RUN_UID:-10001}"
RUN_GID="${RUN_GID:-10001}"

# 业务启动命令（只在 RUN_TEST=1 时使用）
# 示例：APP_CMD='dotnet /app/xxx.dll'
APP_CMD="${APP_CMD:-}"

# 为了避免真的把服务跑起来，默认只做“能力测试”；
# 设置 RUN_TEST=1 才会尝试以非 root 启动 APP_CMD 并捕获失败。
RUN_TEST="${RUN_TEST:-0}"

log() { printf '%s\n' "$*" ; }
hr() { printf '%s\n' "----------------------------------------"; }

# ===== 基本信息 =====
hr
log "[1/8] 基本身份与主进程信息"
log "当前进程 id: $(id || true)"
if [ -r /proc/1/status ]; then
  awk '/^Name|^Pid|^Uid|^Gid|^Cap(Prm|Eff)/{print}' /proc/1/status || true
else
  log "无法读取 /proc/1/status"
fi

# ===== 用户与降权工具检查 =====
hr
log "[2/8] 镜像内可用用户（去除 nologin）："
if [ -r /etc/passwd ]; then
  grep -v 'nologin' /etc/passwd || true
else
  log "/etc/passwd 不可读"
fi

hr
log "[3/8] 降权工具可用性："
TOOLS=""
for t in setpriv su-exec gosu; do
  if command -v "$t" >/dev/null 2>&1; then
    log "  - 找到：$t -> $(command -v "$t")"
    TOOLS="$TOOLS $t"
  else
    log "  - 缺失：$t"
  fi
done
[ -z "$TOOLS" ] && log "结论：镜像内无常见降权工具。"

# ===== setpriv 能力测试 =====
SET_PRIV_OK=0
if command -v setpriv >/dev/null 2>&1; then
  hr
  log "[4/8] setpriv 基础降权能力测试（不启动业务进程）"
  if setpriv --reuid "$RUN_UID" --regid "$RUN_GID" --clear-groups id >/tmp/_id.out 2>/tmp/_id.err; then
    SET_PRIV_OK=1
    log "setpriv 成功："
    cat /tmp/_id.out
  else
    log "setpriv 失败："
    cat /tmp/_id.err || true
  fi
fi

# ===== su-exec / gosu 能力测试 =====
SUEXEC_OK=0
if command -v su-exec >/dev/null 2>&1; then
  hr
  log "[5/8] su-exec 基础降权能力测试"
  if su-exec "${RUN_UID}:${RUN_GID}" id >/tmp/_se.out 2>/tmp/_se.err; then
    SUEXEC_OK=1
    log "su-exec 成功："
    cat /tmp/_se.out
  else
    log "su-exec 失败："
    cat /tmp/_se.err || true
  fi
elif command -v gosu >/dev/null 2>&1; then
  hr
  log "[5/8] gosu 基础降权能力测试"
  if gosu "${RUN_UID}:${RUN_GID}" id >/tmp/_gs.out 2>/tmp/_gs.err; then
    SUEXEC_OK=1
    log "gosu 成功："
    cat /tmp/_gs.out
  else
    log "gosu 失败："
    cat /tmp/_gs.err || true
  fi
fi

# ===== 文件系统与写权限粗检 =====
hr
log "[6/8] 写权限粗检（/tmp 与常见目录）"
for d in /tmp /app /app/logs /var/tmp; do
  [ -d "$d" ] || continue
  if sh -c "echo test > $d/__wtest.$$" 2>/dev/null; then
    log "可写：$d"
    rm -f "$d/__wtest.$$" || true
  else
    log "不可写：$d"
  fi
done

# ===== 端口绑定检查（低端口需要特权 NET_BIND_SERVICE）=====
hr
log "[7/8] 低端口绑定可行性（被动推断）"
NEED_LOW_PORT=0
# 如果看到 ASPNETCORE_URLS 指向 :80 或 :443，就判定需要低端口
if env | grep -E '^ASPNETCORE_URLS=' | grep -E ':(80|443)(/|$)' >/dev/null 2>&1; then
  NEED_LOW_PORT=1
fi
if [ "$NEED_LOW_PORT" -eq 1 ]; then
  log "检测到可能需要监听 80/443（ASPNETCORE_URLS=$ASPNETCORE_URLS）。"
  log "非 root 需要 NET_BIND_SERVICE 能力或改用高位端口（如 8080）。"
else
  log "未检测到对 80/443 的显式需求（或未设置 ASPNETCORE_URLS）。"
fi

# =====（可选）实际以非 root 试跑业务命令 =====
TEST_RESULT="SKIPPED"
if [ "$RUN_TEST" -eq 1 ]; then
  hr
  log "[8/8] 实际以非 root 试跑业务命令（RUN_TEST=1 已开启）"
  if [ -z "$APP_CMD" ]; then
    log "未设置 APP_CMD，示例：APP_CMD='dotnet /app/xxx.dll'"
  else
    log "试跑命令：$APP_CMD"
    if command -v setpriv >/dev/null 2>&1; then
      if timeout 5 sh -c "exec setpriv --reuid $RUN_UID --regid $RUN_GID --clear-groups $APP_CMD" ; then
        TEST_RESULT="SUCCESS"
        log "非 root 试跑：成功（可能仅运行到超时前）。"
      else
        TEST_RESULT="FAIL"
        log "非 root 试跑：失败（退出码=$?）。已足以证明此方式下无法以非 root 启动。"
      fi
    elif command -v su-exec >/dev/null 2>&1; then
      if timeout 5 sh -c "exec su-exec ${RUN_UID}:${RUN_GID} $APP_CMD" ; then
        TEST_RESULT="SUCCESS"
        log "非 root 试跑：成功。"
      else
        TEST_RESULT="FAIL"
        log "非 root 试跑：失败。"
      fi
    elif command -v gosu >/dev/null 2>&1; then
      if timeout 5 sh -c "exec gosu ${RUN_UID}:${RUN_GID} $APP_CMD" ; then
        TEST_RESULT="SUCCESS"
        log "非 root 试跑：成功。"
      else
        TEST_RESULT="FAIL"
        log "非 root 试跑：失败。"
      fi
    else
      TEST_RESULT="NO_TOOL"
      log "无降权工具，无法进行实际试跑。"
    fi
  fi
fi

# ===== 结论归纳 =====
hr
log "[结论]"

IS_ROOT=1
[ "$(id -u)" -ne 0 ] && IS_ROOT=0

if [ "$IS_ROOT" -eq 1 ] && [ -z "$TOOLS" ]; then
  log "A. 当前以 root 运行且镜像内无降权工具 -> 只能以 root 启动。"
fi

if [ "$IS_ROOT" -eq 1 ] && [ -n "$TOOLS" ] && [ "$SET_PRIV_OK" -eq 0 ] && [ "$SUEXEC_OK" -eq 0 ]; then
  log "B. 虽有降权工具名，但基础降权测试失败 -> 实际无法以非 root 运行。"
fi

if [ "$NEED_LOW_PORT" -eq 1 ]; then
  log "C. 应用需要监听 80/443，非 root 需 NET_BIND_SERVICE 或改端口；未满足时将导致非 root 启动失败。"
fi

case "$TEST_RESULT" in
  SUCCESS) log "D. 实际试跑显示可非 root 启动（说明并非“只能 root”）。";;
  FAIL)    log "D. 实际试跑失败，已直接证明在当前环境无法非 root 启动。";;
  NO_TOOL) log "D. 无法试跑（无降权工具），结合 A/B 可推断当前只能 root。";;
  SKIPPED) log "D. 已跳过实际试跑；如需强证据，请设置 RUN_TEST=1 并提供 APP_CMD 复测。";;
esac

hr
log "提示：如果外部编排层支持 runAsUser/--user，则可在“外部”降权；本脚本仅针对镜像/容器内部能力。"
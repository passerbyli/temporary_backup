# 当前身份是否为 root
```
id && whoami
```

# 容器主进程pid是否为root
```
# ps -o pid= -p 1
awk '/^(Name|Pid|Uid|Gid|Cap(Prm|Eff))/{print}' /proc/1/status
```
关键点：
	•	看到 Uid: 0 0 0 0 / Gid: 0 0 0 0 → PID 1 是 root
	•	CapEff/CapPrm 权限位很高（常见全 f）→ 权限完整

判定： 如果 PID 1 是 root，且你的服务是由 PID 1（或其子进程）直接拉起，默认继承 root。




# 查看有哪些用户
```
cat /etc/passwd ｜ grep -v 'nologin'
```
判定：
	•	如果只有 root、nobody（且是 nologin），基本没有可切换的业务用户可用。
	•	即使有普通用户，但没有可用 shell（/sbin/nologin），也没法直接 su 到它。


# 查看是否有降权工具
```
which setpriv su-exec gosu 2>/dev/null || true
```
典型输出：（空行，表示都不存在）
判定： 镜像内没有常见降权工具，就无法在 start.sh 里把 dotnet 切到非 root 运行。



# 查看主进程的UID
```
# ps -o uid= -p 1
cat /proc/1/status | grep Uid
```



# 尝试手动降权（演示失败情况）
```
setpriv --reuid 10001 --regid 10001 --clear-groups id
```
如果提示：
setpriv: failed to set groups: Operation not permitted
setpriv: command not found
说明镜像和运行环境都不支持降权。
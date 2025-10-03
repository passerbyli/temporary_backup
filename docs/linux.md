基于 RHEL / CentOS / Rocky / AlmaLinux 这种系的，所以 apt 系命令（Debian/Ubuntu 系）不可用，而要改用 yum / dnf。

对应关系

常见的软件包安装命令对照：

| 功能       | Debian/Ubuntu (apt)  | CentOS/RHEL (yum / dnf)                      |
| ---------- | -------------------- | -------------------------------------------- |
| 更新包索引 | apt update           | yum makecache 或 dnf makecache               |
| 安装软件包 | apt install -y <pkg> | yum install -y <pkg> 或 dnf install -y <pkg> |
| 删除软件包 | apt remove -y <pkg>  | yum remove -y <pkg>                          |
| 升级所有包 | apt upgrade -y       | yum update -y                                |
| 搜索软件包 | apt search <pkg>     | yum search <pkg>                             |

🔍 判断你的容器基于哪一类

在容器里执行：

```
cat /etc/os-release
```

如果看到 ID=centos / rhel / rocky / almalinux，说明就是 RedHat 系列 → 用 yum/dnf。
如果是 ID=debian / ubuntu，那才是 apt。

对于RHEL/CentOS:

1. 使用操作系统的包管理器

```
yum update ca-certificates
```

2. 手动更新证书

```
sudo update-ca-trust
```

下面给你一份 pnpm 排查依赖/monorepo 问题的常用命令清单，专门针对你现在这种 Windows + pnpm workspace + 多项目 + Vue 的场景。我按**“查什么 → 用什么命令 → 怎么看结果”**来讲，照着用基本不会迷路。

⸻

# 一、依赖结构 & 版本冲突（最常用）

1️⃣ pnpm list —— 看“装了什么”

常用姿势
```
pnpm list
pnpm list vue
pnpm list @vue/runtime-core
```
workspace 场景（重点）
```
pnpm -r list vue
pnpm -r list @vue/runtime-core
```
怎么看
	•	同一个包出现 多个版本 → 高风险
	•	同版本但在不同子项目下各装一份 → 可能需要隔离或 alias
	•	某个子项目完全没列出，但运行时却用到了 → 多半是被别的包带进来的

⸻

2️⃣ pnpm why —— 查“为什么会装这个包”（必会）

这是排查问题最有价值的命令。

pnpm why vue
pnpm why @vue/runtime-core
pnpm why vue-router

workspace

pnpm -r why vue

怎么看
	•	输出里会明确告诉你：
	•	是哪个 package 直接依赖
	•	是哪个 package 间接依赖
	•	如果看到：

vue
├─ sdk
└─ vue3-web1

就说明 SDK 和应用都在拉 vue（双来源高风险）

⸻

# 二、workspace / monorepo 专用

3️⃣ pnpm -r / --recursive —— 在所有子项目跑

pnpm -r list
pnpm -r exec node -p "require.resolve('vue')"

很适合快速对比每个项目解析到的物理路径。

示例（你这个场景很有用）

pnpm -r exec node -p "process.cwd() + ' -> ' + require.resolve('vue')"

一眼就能看出 哪个项目解析到了哪一份 vue。

⸻

4️⃣ pnpm --filter —— 只看/只跑某一个项目

pnpm --filter vue3-web1 list
pnpm --filter vue3-web1 why vue
pnpm --filter vue3-web1 exec node -p "require.resolve('vue')"

用途
	•	排查问题时，避免被其它 workspace 项目干扰
	•	确认某个项目“自己视角下”的依赖

⸻

三、安装 & 锁定问题

5️⃣ pnpm install --strict-peer-dependencies

pnpm install --strict-peer-dependencies

用途
	•	强制检查 peerDependencies
	•	很多 Vue SDK / 组件库 peer 依赖不满足，平时不报错，这个能直接炸出来

⸻

6️⃣ pnpm outdated —— 查潜在不兼容版本

pnpm outdated
pnpm -r outdated

用途
	•	看 SDK、Vue 生态包是不是落后或错位
	•	特别注意 @vue/* 系列版本不一致

⸻

四、缓存 & 环境排查（Windows 很重要）

7️⃣ pnpm store path

pnpm store path

用途
	•	确认 pnpm 全局 store 在哪
	•	排查多人环境、CI、管理员/非管理员安装不一致问题

⸻

8️⃣ pnpm store prune

pnpm store prune

用途
	•	清理无用包
	•	排查“本地 store 污染”导致的奇怪行为

⸻

9️⃣ pnpm config list

pnpm config list

重点关注
	•	node-linker
	•	public-hoist-pattern
	•	virtual-store-dir

这些会直接影响 node_modules 结构 & webpack 解析行为。

⸻

五、诊断 & 调试

🔟 pnpm doctor

pnpm doctor

用途
	•	检查 pnpm / Node / store / 环境异常
	•	Windows 下偶尔能发现权限或路径问题

⸻

11️⃣ pnpm install --reporter=ndjson

pnpm install --reporter=ndjson

用途（进阶）
	•	调试 install 过程
	•	看某个包是从哪被解析/提升的
	•	一般只在非常诡异的问题时用

⸻

# 六、你这个场景的“黄金组合命令”（直接照抄）

① 快速看 vue 是否被多来源引入
```
pnpm -r list vue
pnpm why vue
```
② 看每个项目最终解析到哪一份 vue
```
pnpm -r exec node -p "process.cwd() + ' -> ' + require.resolve('vue')"
```
③ 只看 web1（避免被 web2 干扰）
```
pnpm --filter vue3-web1 why vue
pnpm --filter vue3-web1 exec node -p "require.resolve('vue')"
```
④ 检查 SDK 是否带了 vue
```
pnpm why vue | findstr sdk
```


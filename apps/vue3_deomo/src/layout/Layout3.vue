<template>
    <div class="page-bg">
    <el-container class="shell">
        <!-- 顶部公共导航（固定48） -->
        <el-header class="header">
            <div class="header-left">
                <el-button circle size="small" :icon="isCollapse ? Expand : Fold" @click="toggleCollapse" />
                <span class="brand">Demo</span>
                <el-tag size="small" effect="plain">{{ areaType }}</el-tag>
            </div>

            <div class="header-right">
                <el-button size="small" text @click="goArea('china')">中国</el-button>
                <el-button size="small" text @click="goArea('oversea')">海外</el-button>
            </div>
        </el-header>

        <!-- 中间主体：占满剩余高度 -->
        <el-container class="body">
            <!-- 左侧：占满 + 自己滚动 -->
            <el-aside :width="asideWidth" class="aside">
                <div class="aside-scroll">
                    <el-skeleton v-if="loading" animated :rows="8" />

                    <el-menu v-else class="left-menu" :collapse="isCollapse" :collapse-transition="false"
                        :default-active="activeLeftKey" :unique-opened="true" @select="onLeftSelect">
                        <!-- 左侧最多2层 -->
                        <template v-for="l1 in menus" :key="l1.menuId">
                            <el-sub-menu v-if="hasChildren(l1)" :index="l1.menuId">
                                <template #title>
                                    <span>{{ l1.menuName }}</span>
                                </template>

                                <el-menu-item v-for="l2 in (l1.children || [])" :key="l2.menuId" :index="l2.menuId">
                                    {{ l2.menuName }}
                                </el-menu-item>
                            </el-sub-menu>

                            <el-menu-item v-else :index="l1.menuId">
                                {{ l1.menuName }}
                            </el-menu-item>
                        </template>
                    </el-menu>
                </div>
            </el-aside>

            <!-- 右侧：Tabs(普通div) + 内容区，占满；只有内容区滚动 -->
            <el-main class="main">
                <!-- 保留 router-view（你的结构要求） -->
                <router-view />

                <div class="right-panel">
                    <!-- Tabs 固定在上方，不滚动 -->
                    <div class="tabs-bar" v-if="l3Tabs.length || l4Tabs.length">
                        <!-- L3 Tabs -->
                        <div v-if="l3Tabs.length" class="tab-row">
                            <div v-for="t in l3Tabs" :key="t.menuId" class="tab-item"
                                :class="{ active: String(activeL3Id) === String(t.menuId) }" @click="onClickL3Tab(t)"
                                :title="t.menuName">
                                {{ t.menuName }}
                            </div>
                        </div>

                        <!-- L4 Tabs -->
                        <div v-if="l4Tabs.length" class="tab-row">
                            <div v-for="t in l4Tabs" :key="t.menuId" class="tab-item"
                                :class="{ active: String(activeLeafId) === String(t.menuId) }" @click="onClickL4Tab(t)"
                                :title="t.menuName">
                                {{ t.menuName }}
                            </div>
                        </div>
                    </div>

                    <!-- ✅ 内容区唯一滚动 -->
                    <div class="content-scroll">
                        <el-card shadow="never" class="content-card">
                            <ContentRenderer :node="activeLeafNode" :payload="payload" />
                        </el-card>
                    </div>
                </div>
            </el-main>
        </el-container>

        <!-- 底部：固定48，根据叶子 footer 控制 -->
        <el-footer v-if="footerVisible" class="footer">
            <div class="footer-inner">{{ footerText }}</div>
        </el-footer>
    </el-container>
    </div>
</template>

<script>
import { Fold, Expand } from "@element-plus/icons-vue";
import { fetchMenu } from "@/services/menu";
import { findPathById, isLeaf, pickFirstLeaf, pickFirstLeafFromTree } from "@/utils/tree";
import { normalizePayload } from "@/utils/routePayload";
import ContentRenderer from "@/views/ContentRenderer.vue";

export default {
    name: "Layout",
    components: { ContentRenderer },

    data() {
        return {
            Fold,
            Expand,

            isCollapse: false,

            menus: [],
            loading: false,

            // 当前叶子（唯一渲染源）
            activeLeafNode: null,

            // 左侧高亮：depth>2 高亮 L2
            activeL2Id: "",

            // div tabs
            l3Tabs: [],
            l4Tabs: [],
            activeL3Id: "",
            activeLeafId: "",
        };
    },

    computed: {
        areaType() {
            return this.$route.path.startsWith("/oversea") ? "oversea" : "china";
        },
        menuId() {
            return this.$route.query.menuId || "";
        },

        // 业务参数：除 menuId 外全部
        payload() {
            return normalizePayload(this.$route.query);
        },

        asideWidth() {
            return this.isCollapse ? "64px" : "260px";
        },

        activeLeftKey() {
            return this.activeL2Id || this.menuId || "";
        },

        footerInfo() {
            const f = this.activeLeafNode && this.activeLeafNode.footer;
            if (f === false || f === 0) return { show: false, text: "" };
            if (f === true || f === 1) return { show: true, text: "© 2025 Your Company. All rights reserved." };
            if (typeof f === "string") return { show: true, text: f };
            if (f && typeof f === "object") return { show: !!f.show, text: f.text || "" };
            return { show: true, text: "© 2025 Your Company. All rights reserved." };
        },
        footerVisible() {
            return this.footerInfo.show;
        },
        footerText() {
            return this.footerInfo.text;
        },
    },

    watch: {
        areaType: { immediate: true, handler() { this.loadMenus(); } },
        menuId: { immediate: true, handler() { this.applyMenuId(); } },
    },

    methods: {
        toggleCollapse() {
            this.isCollapse = !this.isCollapse;
        },
        goArea(type) {
            // 保留业务参数，切区只改 path
            this.$router.push({ path: `/${type}`, query: { ...this.$route.query } });
        },
        hasChildren(n) {
            return !!(n && n.children && n.children.length);
        },

        async loadMenus() {
            this.loading = true;
            this.menus = await fetchMenu(this.areaType);
            this.loading = false;

            // 没 menuId：落到第一个叶子
            if (!this.menuId) {
                const firstLeaf = pickFirstLeafFromTree(this.menus);
                if (firstLeaf) {
                    this.$router.replace({
                        path: `/${this.areaType}`,
                        query: { ...this.$route.query, menuId: firstLeaf.menuId },
                    });
                }
                return;
            }

            this.applyMenuId();
        },

        applyMenuId() {
            if (!this.menus.length) return;

            const path = findPathById(this.menus, this.menuId);

            // menuId 不存在：回退第一个叶子
            if (!path) {
                const firstLeaf = pickFirstLeafFromTree(this.menus);
                if (firstLeaf) {
                    this.$router.replace({
                        path: `/${this.areaType}`,
                        query: { ...this.$route.query, menuId: firstLeaf.menuId },
                    });
                }
                return;
            }

            const last = path[path.length - 1];

            // 指向非叶子：replace 到其下第一个叶子
            if (!isLeaf(last)) {
                const leaf = pickFirstLeaf(last);
                if (leaf) {
                    this.$router.replace({
                        path: `/${this.areaType}`,
                        query: { ...this.$route.query, menuId: leaf.menuId },
                    });
                }
                return;
            }

            // ✅ 叶子：唯一渲染源
            this.activeLeafNode = last;
            this.activeLeafId = last.menuId;

            // depth>2 左侧高亮 L2（祖先）
            this.activeL2Id = path.length > 2 && path[1] ? path[1].menuId : "";

            // externalLink：自动打开（可选）
            if (last.type === "externalLink" && last.link) {
                window.open(last.link, "_blank", "noopener,noreferrer");
            }

            // ===== 计算 div tabs =====
            const depth = path.length;

            if (depth <= 2) {
                this.l3Tabs = [];
                this.l4Tabs = [];
                this.activeL3Id = "";
                return;
            }

            // L3 tabs 来自 L2.children
            const l2Node = path[1];
            this.l3Tabs = l2Node && l2Node.children ? l2Node.children : [];

            // activeL3：depth=3 => leaf自己；depth=4 => path[2]
            const l3Node = depth === 3 ? last : path[2];
            this.activeL3Id = l3Node ? l3Node.menuId : "";

            // L4 tabs：当 L3 有 children
            this.l4Tabs = l3Node && l3Node.children && l3Node.children.length ? l3Node.children : [];
        },

        // 左侧 menu select：永远落到其下第一个叶子
        onLeftSelect(id) {
            const path = findPathById(this.menus, id);
            if (!path) return;

            const node = path[path.length - 1];
            const leaf = pickFirstLeaf(node) || node;

            this.$router.push({
                path: `/${this.areaType}`,
                query: { ...this.$route.query, menuId: leaf.menuId }, // ✅ 保留业务参数
            });
        },

        onClickL3Tab(l3) {
            const leaf = pickFirstLeaf(l3) || l3;
            this.$router.push({
                path: `/${this.areaType}`,
                query: { ...this.$route.query, menuId: leaf.menuId }, // ✅ 保留业务参数
            });
        },

        onClickL4Tab(l4) {
            this.$router.push({
                path: `/${this.areaType}`,
                query: { ...this.$route.query, menuId: l4.menuId }, // ✅ 保留业务参数
            });
        },
    },
};
</script>

<style scoped>
/* ===== 整体壳 ===== */
.shell {
    height: 100vh;
    overflow: hidden;
    background: #f2f3f5;
    /* 整体灰色背景 */
}

/* ===== Header / Footer 保持不变 ===== */
.header {
    height: 48px;
    line-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color-overlay);
    padding: 0 16px;
}

.footer {
    height: 48px;
    border-top: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color-overlay);
    padding: 0 16px;
}

.footer-inner {
    height: 48px;
    display: flex;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

/* ===== 中间主体：灰色背景 + 12px 内边距 ===== */
.body {
    height: calc(100vh - 48px - 48px);
    background: #f2f3f5;
    padding: 12px;
    /* ⭐ 上下左右 12px 间隔 */
    box-sizing: border-box;
    overflow: hidden;
}

/* ===== 左侧导航（白色卡片） ===== */
.aside {
    height: 100%;
    background: transparent;
    /* 让灰色背景露出来 */
    overflow: hidden;
}

.aside-scroll {
    height: 100%;
    overflow: auto;
    padding: 8px;
    background: #ffffff;
    /* 白色卡片 */
    border-radius: 12px;
    /* 圆角 */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    /* 阴影 */
}

/* el-menu 自身不要再画边框 */
.left-menu {
    border-right: none;
    background: transparent;
}

/* ===== 右侧主区域（白色卡片） ===== */
.main {
    height: 100%;
    overflow: hidden;
    padding-left: 12px;
    /* 左右卡片之间的间距 */
    box-sizing: border-box;
}

.right-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    background: #ffffff;
    /* 白色卡片 */
    border-radius: 12px;
    /* 圆角 */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    padding: 12px;
    box-sizing: border-box;
}

/* ===== Tabs 区 ===== */
.tabs-bar {
    flex: 0 0 auto;
    margin-bottom: 8px;
}

/* Tab 行横向滚动 */
.tab-row {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 6px;
}

.tab-row::-webkit-scrollbar {
    height: 6px;
}

.tab-row::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 999px;
}

/* Tab 项 */
.tab-item {
    flex: 0 0 auto;
    padding: 6px 12px;
    border-radius: 999px;
    background: #f5f7fa;
    color: #606266;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    border: 1px solid transparent;
}

.tab-item:hover {
    background: #ecf5ff;
    color: var(--el-color-primary);
}

.tab-item.active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    border-color: var(--el-color-primary-light-5);
}

/* ===== 内容区：唯一滚动区域 ===== */
.content-scroll {
    flex: 1 1 auto;
    overflow: auto;
}

/* 内容卡片（可以要，也可以不要） */
.content-card {
    min-height: 100%;
    border-radius: 8px;
}

/* ===== Header 内部 ===== */
.header-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

.brand {
    font-weight: 700;
}
</style>
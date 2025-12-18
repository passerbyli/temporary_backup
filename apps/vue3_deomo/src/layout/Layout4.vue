<template>
    <div class="shell">
        <!-- 顶部：保持不变（48px） -->
        <div class="header">
            <div class="header-left">
                <span class="brand">Demo</span>
                <el-tag size="small" effect="plain">{{ areaType }}</el-tag>
            </div>

            <div class="header-right">
                <el-button size="small" text @click="goArea('china')">中国</el-button>
                <el-button size="small" text @click="goArea('oversea')">海外</el-button>
            </div>
        </div>

        <!-- 中间：灰底 + 12px 边距，左右等高（高度根据 footer 动态） -->
        <div class="body" :style="{ height: bodyHeight }">
            <div class="panel">
                <!-- 左侧卡片：菜单（最多2层） -->
                <div class="left-card" :class="{ collapsed: isCollapse }" :style="{ width: asideWidth }">
                    <!-- ✅ 展开态：显示菜单 -->
                    <div class="left-scroll" v-show="!isCollapse">
                        <el-skeleton v-if="loading" animated :rows="8" />

                        <el-menu v-else class="left-menu" :default-active="activeLeftKey" :unique-opened="true"
                            @select="onLeftSelect">
                            <template v-for="l1 in menus" :key="l1.menuId">
                                <el-sub-menu v-if="hasChildren(l1)" :index="l1.menuId">
                                    <template #title><span>{{ l1.menuName }}</span></template>
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

                    <!-- ✅ 折叠/展开按钮：始终显示（折叠态居中/靠右都可） -->
                    <button class="collapse-handle" @click="toggleCollapse" :title="isCollapse ? '展开导航' : '收起导航'">
                        <el-icon>
                            <Expand v-if="isCollapse" />
                            <Fold v-else />
                        </el-icon>
                    </button>
                </div>

                <!-- 右侧卡片：Tabs + 内容区（高度与左侧一致） -->
                <div class="right-card">
                    <router-view />

                    <!-- Tabs 固定在上方，不滚动 -->
                    <div class="tabs-bar" v-if="l3Tabs.length || l4Tabs.length">
                        <div v-if="l3Tabs.length" class="tab-row">
                            <div v-for="t in l3Tabs" :key="t.menuId" class="tab-item"
                                :class="{ active: String(activeL3Id) === String(t.menuId) }" @click="onClickL3Tab(t)"
                                :title="t.menuName">
                                {{ t.menuName }}
                            </div>
                        </div>

                        <div v-if="l4Tabs.length" class="tab-row">
                            <div v-for="t in l4Tabs" :key="t.menuId" class="tab-item"
                                :class="{ active: String(activeLeafId) === String(t.menuId) }" @click="onClickL4Tab(t)"
                                :title="t.menuName">
                                {{ t.menuName }}
                            </div>
                        </div>
                    </div>

                    <!-- ✅ 右侧内容区：唯一滚动区域 -->
                    <div class="content-scroll">
                        <el-card shadow="never" class="content-card">
                            <ContentRenderer :node="activeLeafNode" :payload="payload" />
                        </el-card>
                    </div>
                </div>
            </div>
        </div>

        <!-- 底部：保持不变（48px），可隐藏 -->
        <div v-if="footerVisible" class="footer">
            <div class="footer-inner">{{ footerText }}</div>
        </div>
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
    components: { ContentRenderer, Fold, Expand },

    data() {
        return {
            isCollapse: false,
            menus: [],
            loading: false,

            activeLeafNode: null,
            activeL2Id: "",

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
        payload() {
            return normalizePayload(this.$route.query);
        },

        // ✅ 更彻底的折叠宽度
        asideWidth() {
            return this.isCollapse ? "44px" : "260px";
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

        // ✅ 中间高度根据 footer 是否显示动态计算
        bodyHeight() {
            const footerH = this.footerVisible ? 48 : 0;
            return `calc(100vh - 48px - ${footerH}px)`;
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
            this.$router.push({ path: `/${type}`, query: { ...this.$route.query } });
        },
        hasChildren(n) {
            return !!(n && n.children && n.children.length);
        },

        async loadMenus() {
            this.loading = true;
            this.menus = await fetchMenu(this.areaType);
            this.loading = false;

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

            this.activeLeafNode = last;
            this.activeLeafId = last.menuId;

            // depth>2 左侧高亮 L2
            this.activeL2Id = path.length > 2 && path[1] ? path[1].menuId : "";

            if (last.type === "externalLink" && last.link) {
                window.open(last.link, "_blank", "noopener,noreferrer");
            }

            const depth = path.length;
            if (depth <= 2) {
                this.l3Tabs = [];
                this.l4Tabs = [];
                this.activeL3Id = "";
                return;
            }

            const l2Node = path[1];
            this.l3Tabs = l2Node && l2Node.children ? l2Node.children : [];

            const l3Node = depth === 3 ? last : path[2];
            this.activeL3Id = l3Node ? l3Node.menuId : "";

            this.l4Tabs = l3Node && l3Node.children && l3Node.children.length ? l3Node.children : [];
        },

        onLeftSelect(id) {
            const path = findPathById(this.menus, id);
            if (!path) return;
            const node = path[path.length - 1];
            const leaf = pickFirstLeaf(node) || node;

            this.$router.push({
                path: `/${this.areaType}`,
                query: { ...this.$route.query, menuId: leaf.menuId },
            });
        },

        onClickL3Tab(l3) {
            const leaf = pickFirstLeaf(l3) || l3;
            this.$router.push({
                path: `/${this.areaType}`,
                query: { ...this.$route.query, menuId: leaf.menuId },
            });
        },

        onClickL4Tab(l4) {
            this.$router.push({
                path: `/${this.areaType}`,
                query: { ...this.$route.query, menuId: l4.menuId },
            });
        },
    },
};
</script>

<style scoped>
.shell {
    height: 100vh;
    overflow: hidden;
    background: #f2f3f5;
}

/* 顶部/底部不动 */
.header {
    height: 48px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--el-bg-color-overlay);
    border-bottom: 1px solid var(--el-border-color-light);
}

.footer {
    height: 48px;
    padding: 0 16px;
    background: var(--el-bg-color-overlay);
    border-top: 1px solid var(--el-border-color-light);
}

.footer-inner {
    height: 48px;
    display: flex;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

/* 中间灰底 + 12px */
.body {
    padding: 12px;
    box-sizing: border-box;
    overflow: hidden;
    background: #f2f3f5;
}

/* 左右等高 */
.panel {
    height: 100%;
    display: flex;
    gap: 12px;
    align-items: stretch;
    overflow: hidden;
}

/* 左侧卡片 */
.left-card {
    height: 100%;
    flex: 0 0 auto;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .06);
    overflow: hidden;
    position: relative;
}

/* 展开态：菜单滚动区 */
.left-scroll {
    height: 100%;
    overflow: auto;
    padding: 8px 8px 56px;
    /* 给把手按钮留空间 */
    box-sizing: border-box;
}

.left-menu {
    border-right: none;
    background: transparent;
}

/* ✅ 折叠态：导航完全隐藏，只保留把手栏 */
.left-card.collapsed {
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    /* 把手居中 */
    padding: 0;
}

/* ✅ 把手按钮：折叠时居中；展开时仍在右下角 */
.collapse-handle {
    position: absolute;
    right: 10px;
    bottom: 10px;

    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color-overlay);
    box-shadow: 0 2px 8px rgba(0, 0, 0, .08);
    cursor: pointer;

    display: flex;
    align-items: center;
    justify-content: center;
}

.left-card.collapsed .collapse-handle {
    position: static;
    /* ✅ 折叠态改为普通流定位 */
    right: auto;
    bottom: auto;
}

.collapse-handle:hover {
    border-color: var(--el-color-primary-light-5);
    color: var(--el-color-primary);
}

/* 右侧卡片 */
.right-card {
    height: 100%;
    flex: 1 1 auto;
    min-width: 0;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .06);
    padding: 12px;
    box-sizing: border-box;

    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* div tabs */
.tabs-bar {
    flex: 0 0 auto;
    margin-bottom: 8px;
}

.tab-row {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 6px;
}

.tab-row::-webkit-scrollbar {
    height: 6px;
}

.tab-row::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 999px;
}

.tab-item {
    flex: 0 0 auto;
    padding: 6px 12px;
    border-radius: 999px;
    background: #f5f7fa;
    color: #606266;
    cursor: pointer;
    white-space: nowrap;
    transition: all .15s ease;
    border: 1px solid transparent;
    user-select: none;
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

/* ✅ 内容区唯一滚动 */
.content-scroll {
    flex: 1 1 auto;
    overflow: auto;
    min-height: 0;
}

.content-card {
    min-height: 100%;
    border-radius: 10px;
}

/* header 内部 */
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
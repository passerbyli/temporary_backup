<template>
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

            <!-- 右侧：Tabs + 内容区，占满；只有内容区滚动 -->
            <el-main class="main">
                <!-- 保留 router-view（你的结构要求） -->
                <router-view />

                <div class="right-panel">
                    <!-- Tabs 区：不滚动，固定在上面 -->
                    <div class="tabs-bar" v-if="l3Tabs.length || l4Tabs.length">
                        <el-tabs v-if="l3Tabs.length" type="card" v-model="activeL3Id" @tab-change="onL3TabChange"
                            class="tabs">
                            <el-tab-pane v-for="t in l3Tabs" :key="t.menuId" :name="t.menuId" :label="t.menuName" />
                        </el-tabs>

                        <el-tabs v-if="l4Tabs.length" type="card" v-model="activeLeafId" @tab-change="onL4TabChange"
                            class="tabs">
                            <el-tab-pane v-for="t in l4Tabs" :key="t.menuId" :name="t.menuId" :label="t.menuName" />
                        </el-tabs>
                    </div>

                    <!-- 内容区：✅ 唯一滚动区域 -->
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
</template>

<script>
import { Fold, Expand } from "@element-plus/icons-vue";
import { fetchMenu } from "@/services/menu";
import { findPathById, isLeaf, pickFirstLeaf, pickFirstLeafFromTree } from "@/utils/tree";
import ContentRenderer from "@/views/ContentRendererEpP.vue";
import { normalizePayload } from "@/utils/routePayload";

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

            activeLeafNode: null,
            activeL2Id: "",

            l3Tabs: [],
            l4Tabs: [],
            activeL3Id: "",
            activeLeafId: "",
        };
    },
    computed: {
        payload() {
            return normalizePayload(this.$route.query);
        },
        areaType() {
            return this.$route.path.startsWith("/oversea") ? "oversea" : "china";
        },
        menuId() {
            return this.$route.query.menuId || "";
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
            this.$router.push({ path: `/${type}` });
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
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: firstLeaf.menuId } });
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
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: firstLeaf.menuId } });
                }
                return;
            }

            const last = path[path.length - 1];

            if (!isLeaf(last)) {
                const leaf = pickFirstLeaf(last);
                if (leaf) {
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: leaf.menuId } });
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
            this.$router.push({ path: `/${this.areaType}`, query: { ...this.$route.query,menuId: leaf.menuId } });
        },

        onL3TabChange(name) {
            const l3 = (this.l3Tabs || []).find((x) => String(x.menuId) === String(name));
            if (!l3) return;
            const leaf = pickFirstLeaf(l3) || l3;
            this.$router.push({ path: `/${this.areaType}`, query: { menuId: leaf.menuId } });
        },

        onL4TabChange(name) {
            this.$router.push({ path: `/${this.areaType}`, query: { menuId: name } });
        },
    },
};
</script>

<style scoped>
/* 外层：整页不滚动，靠内部滚动 */
.shell {
    height: 100vh;
    overflow: hidden;
    background: var(--el-bg-color);
}

/* Header/Footer 固定高度 */
.header {
    height: 48px;
    line-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color-overlay);
}

.footer {
    height: 48px;
    border-top: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color-overlay);
    padding: 0 12px;
}

.footer-inner {
    height: 48px;
    display: flex;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

/* 中间主体：必须 overflow hidden，避免整页滚动条 */
.body {
    height: calc(100vh - 48px - 48px);
    overflow: hidden;
}

/* 左侧：占满高度，内部滚动 */
.aside {
    height: 100%;
    border-right: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color-overlay);
    overflow: hidden;
}

.aside-scroll {
    height: 100%;
    overflow: auto;
    padding: 8px;
}

.left-menu {
    border-right: none;
}

/* 右侧：占满高度，内部拆分 tabs + content */
.main {
    height: 100%;
    overflow: hidden;
    padding: 12px;
}

/* 右侧面板：flex列，占满 */
.right-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* tabs 固定在上方，不滚动 */
.tabs-bar {
    flex: 0 0 auto;
}

.tabs {
    margin-bottom: 10px;
}

/* ✅ 内容区唯一滚动 */
.content-scroll {
    flex: 1 1 auto;
    overflow: auto;
}

/* 内容卡片 */
.content-card {
    min-height: 100%;
}

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
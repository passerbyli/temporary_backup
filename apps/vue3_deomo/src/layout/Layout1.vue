<template>
    <div style="display:flex;height:100vh;">
        <!-- 左侧：最多2层 -->
        <aside style="width:260px;border-right:1px solid #eee;padding:12px;">
            <div style="font-weight:700;margin-bottom:10px;">Area: {{ areaType }}</div>

            <div v-if="loading">loading menu...</div>

            <div v-else>
                <div v-for="l1 in menus" :key="l1.menuId" style="margin-bottom:10px;">
                    <div @click="onClickLeftNode(l1)" :style="leftStyle(l1, 1)">
                        {{ l1.menuName }}
                    </div>

                    <div v-if="l1.children && l1.children.length" style="margin-top:6px;margin-left:12px;">
                        <div v-for="l2 in l1.children" :key="l2.menuId" @click="onClickLeftNode(l2)"
                            :style="leftStyle(l2, 2)">
                            {{ l2.menuName }}
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        <!-- 右侧：Tabs + 内容 -->
        <main style="flex:1;padding:12px;">
            <!-- 保留 router-view（你的要求），但内容由 Layout 接管 -->
            <router-view />

            <!-- L3 Tabs -->
            <div v-if="l3Tabs.length" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                <button v-for="(t, idx) in l3Tabs" :key="t.menuId + '_' + idx" @click="onClickL3Tab(t)"
                    :style="tabStyle(String(activeL3Id) === String(t.menuId))">
                    {{ t.menuName }}
                </button>
            </div>

            <!-- L4 Tabs -->
            <div v-if="l4Tabs.length" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                <button v-for="(t, idx) in l4Tabs" :key="t.menuId + '_' + idx" @click="onClickL4Tab(t)"
                    :style="tabStyle(String(activeLeafId) === String(t.menuId))">
                    {{ t.menuName }}
                </button>
            </div>

            <ContentRenderer :node="activeLeafNode" />
        </main>
    </div>
</template>

<script>
import { fetchMenu } from "@/services/menu";
import { findPathById, isLeaf, pickFirstLeaf, pickFirstLeafFromTree } from "@/utils/tree";
import ContentRenderer from "@/views/ContentRenderer1.vue";

export default {
    name: "Layout",
    components: { ContentRenderer },

    data() {
        return {
            menus: [],
            loading: false,

            // 左侧高亮
            activeL2Id: null,

            // Tabs
            l3Tabs: [],
            l4Tabs: [],
            activeL3Id: null,
            activeLeafId: null,

            // 最终渲染目标（唯一渲染源）
            activeLeafNode: null,
        };
    },

    computed: {
        areaType() {
            return this.$route.path.startsWith("/oversea") ? "oversea" : "china";
        },
        menuId() {
            return this.$route.query.menuId || "";
        },
    },

    watch: {
        areaType: { immediate: true, handler() { this.loadMenus(); } },
        menuId: { immediate: true, handler() { this.applyMenuId(); } },
    },

    methods: {
        async loadMenus() {
            this.loading = true;
            this.menus = await fetchMenu(this.areaType);
            this.loading = false;

            // 没 menuId：落到第一个叶子
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

            // menuId 不存在：落到第一个叶子
            if (!path) {
                const firstLeaf = pickFirstLeafFromTree(this.menus);
                if (firstLeaf) {
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: firstLeaf.menuId } });
                }
                return;
            }

            let target = path[path.length - 1];

            // 指向非叶子：replace 到其下第一个叶子
            if (!isLeaf(target)) {
                const leaf = pickFirstLeaf(target);
                if (leaf) {
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: leaf.menuId } });
                }
                return;
            }

            // ✅ target 是叶子：唯一渲染源
            this.activeLeafNode = target;
            this.activeLeafId = target.menuId;

            // externalLink：自动打开（不想自动开就删掉）
            if (target.type === "externalLink" && target.link) {
                window.open(target.link, "_blank", "noopener,noreferrer");
            }

            // ===== 左侧：L2 祖先高亮（当深度>2）=====
            // path: [L1, L2, L3, L4]
            this.activeL2Id = path.length >= 2 ? path[1].menuId : null;

            // ===== Tabs：只根据 path 计算（你提供的数据下稳定）=====
            const depth = path.length;

            if (depth <= 2) {
                this.l3Tabs = [];
                this.l4Tabs = [];
                this.activeL3Id = null;
                return;
            }

            // L3 tabs 来自 L2.children
            const l2Node = path[1];
            this.l3Tabs = l2Node && l2Node.children ? l2Node.children : [];

            // active L3：depth=3 => target；depth=4 => path[2]
            const l3Node = depth === 3 ? target : path[2];
            this.activeL3Id = l3Node ? l3Node.menuId : null;

            // L4 tabs：当 L3 有 children
            this.l4Tabs = l3Node && l3Node.children && l3Node.children.length ? l3Node.children : [];
        },

        // 左侧点击：永远落到该节点下第一个叶子
        onClickLeftNode(node) {
            const leaf = pickFirstLeaf(node) || node;
            this.$router.push({ path: `/${this.areaType}`, query: { menuId: leaf.menuId } });
        },

        // Tabs 点击
        onClickL3Tab(l3) {
            const leaf = pickFirstLeaf(l3) || l3;
            this.$router.push({ path: `/${this.areaType}`, query: { menuId: leaf.menuId } });
        },
        onClickL4Tab(l4) {
            this.$router.push({ path: `/${this.areaType}`, query: { menuId: l4.menuId } });
        },

        leftStyle(node, level) {
            const isActiveSelf = String(this.menuId) === String(node.menuId);
            const isActiveL2 = level === 2 && String(this.activeL2Id) === String(node.menuId);
            const active = isActiveSelf || isActiveL2;

            return {
                padding: level === 1 ? "8px 10px" : "6px 10px",
                borderRadius: "8px",
                cursor: "pointer",
                marginBottom: "6px",
                background: active ? "#eef" : "transparent",
            };
        },

        tabStyle(active) {
            return {
                padding: "6px 10px",
                borderRadius: "10px",
                border: "1px solid #ddd",
                cursor: "pointer",
                background: active ? "#eef" : "#fff",
            };
        },
    },
};
</script>
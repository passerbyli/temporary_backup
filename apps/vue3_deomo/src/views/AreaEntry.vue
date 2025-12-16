<template>
    <div>
        <!-- Tabs：L3 -->
        <div v-if="l3Tabs.length" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            <button v-for="t in l3Tabs" :key="t.menuId" @click="onClickL3(t)"
                :style="tabStyle(String(activeL3Id) === String(t.menuId))">
                {{ t.menuName }}
            </button>
        </div>

        <!-- Tabs：L4（仅当需要） -->
        <div v-if="l4Tabs.length" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
            <button v-for="t in l4Tabs" :key="t.menuId" @click="onClickL4(t)"
                :style="tabStyle(String(activeLeafId) === String(t.menuId))">
                {{ t.menuName }}
            </button>
        </div>

        <component v-if="CurrentComp" :is="CurrentComp" />
        <div v-else>loading...</div>
    </div>
</template>

<script>
import { fetchMenu } from "@/services/menu";
import { findPathById, pickFirstLeaf, pickFirstLeafFromTree, isLeaf } from "@/utils/tree";
import { loadBizComponent } from "@/utils/componentLoader";

export default {
    name: "AreaEntry",
    data() {
        return {
            menus: [],
            CurrentComp: null,

            // tabs
            l3Tabs: [],
            l4Tabs: [],
            activeL3Id: null,
            activeLeafId: null,
        };
    },
    computed: {
        areaType() {
            return this.$route.path.startsWith("/oversea") ? "oversea" : "china";
        },
    },
    watch: {
        areaType: { immediate: true, handler() { this.bootstrap(); } },
        "$route.query.menuId": { immediate: true, handler() { this.applyMenuId(); } },
    },
    methods: {
        async bootstrap() {
            this.menus = await fetchMenu(this.areaType);

            // 如果首次进来没 menuId，默认选全树第一个叶子，并补齐 URL
            if (!this.$route.query.menuId) {
                const firstLeaf = pickFirstLeafFromTree(this.menus);
                if (firstLeaf) {
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: firstLeaf.menuId } });
                }
            } else {
                this.applyMenuId(true);
            }
        },

        applyMenuId(fromBootstrap) {
            if (!this.menus.length) return;

            const menuId = this.$route.query.menuId;
            const path = findPathById(this.menus, menuId);

            // menuId 不存在：兜底到第一个叶子
            if (!path) {
                const firstLeaf = pickFirstLeafFromTree(this.menus);
                if (firstLeaf) {
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: firstLeaf.menuId } });
                }
                return;
            }

            // 如果指向非叶子：修正到它下面第一个叶子
            const target = path[path.length - 1];
            if (!isLeaf(target)) {
                const leaf = pickFirstLeaf(target);
                if (leaf) {
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: leaf.menuId } });
                }
                return;
            }

            // 现在 target 一定是叶子
            this.activeLeafId = target.menuId;

            // 计算 L3 tabs / L4 tabs
            // 叶子深度：path.length（L1=1）
            const depth = path.length;

            // depth<=2：无 tab，直接渲染
            if (depth <= 2) {
                this.l3Tabs = [];
                this.l4Tabs = [];
                this.activeL3Id = null;
                this.CurrentComp = loadBizComponent(target.componentName);
                return;
            }

            // depth>=3：需要 L3 tabs
            const l2Node = path[1]; // L2
            const l3Siblings = (l2Node.children || []).map(x => x);
            this.l3Tabs = l3Siblings;

            // activeL3：如果当前是 L3 leaf，activeL3=target；如果当前在 L4，activeL3=path[2]
            const l3Node = depth === 3 ? target : path[2];
            this.activeL3Id = l3Node.menuId;

            // L4 tabs：当 activeL3 有 children（说明存在 L4）
            if (l3Node.children && l3Node.children.length) {
                this.l4Tabs = l3Node.children;

                // 当前叶子一定在 L4，渲染它
                this.CurrentComp = loadBizComponent(target.componentName);
            } else {
                // L3 本身就是叶子：无 L4 tabs，渲染 L3
                this.l4Tabs = [];
                this.CurrentComp = loadBizComponent(l3Node.componentName);
                this.activeLeafId = l3Node.menuId;
            }
        },

        onClickL3(l3) {
            // 点击 L3：若它是叶子 -> 直接跳；若非叶子 -> 选它下面第一个叶子（通常是 L4）
            const leaf = pickFirstLeaf(l3) || l3;
            this.$router.push({ path: `/${this.areaType}`, query: { menuId: leaf.menuId } });
        },

        onClickL4(l4) {
            // 点击 L4：一定是叶子
            this.$router.push({ path: `/${this.areaType}`, query: { menuId: l4.menuId } });
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
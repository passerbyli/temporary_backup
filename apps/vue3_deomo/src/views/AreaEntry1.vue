<template>
    <div>
        <!-- L3 Tabs：当叶子深度>=3 时展示（来自 L2.children） -->
        <div v-if="l3Tabs.length" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            <button v-for="(t, idx) in l3Tabs" :key="t.menuId + '_' + idx" @click="onClickL3(t)"
                :style="tabStyle(String(activeL3Id) === String(t.menuId))">
                {{ t.menuName }}
            </button>
        </div>

        <!-- L4 Tabs：当 activeL3 有 children（即存在 L4）时展示 -->
        <div v-if="l4Tabs.length" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
            <button v-for="(t, idx) in l4Tabs" :key="t.menuId + '_' + idx" @click="onClickL4(t)"
                :style="tabStyle(String(activeLeafId) === String(t.menuId))">
                {{ t.menuName }}
            </button>
        </div>

        <ContentRenderer :node="activeLeafNode" />
    </div>
</template>

<script>
import { fetchMenu } from "@/services/menu";
import { findPathById, isLeaf, pickFirstLeaf, pickFirstLeafFromTree } from "@/utils/tree";
import ContentRenderer from "@/views/ContentRenderer.vue";

export default {
    name: "AreaEntry",
    components: { ContentRenderer },

    data() {
        return {
            menus: [],

            // tabs
            l3Tabs: [],
            l4Tabs: [],
            activeL3Id: null,
            activeLeafId: null,

            // 当前最终叶子（唯一渲染源）
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
        areaType: { immediate: true, handler() { this.bootstrap(); } },
        menuId: { immediate: true, handler() { this.applyMenuId(); } },
    },

    methods: {
        async bootstrap() {
            this.menus = await fetchMenu(this.areaType);

            // 没有 menuId：落到全树第一个叶子
            if (!this.menuId) {
                const firstLeaf = pickFirstLeafFromTree(this.menus);
                if (firstLeaf) {
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: firstLeaf.menuId } });
                }
                return;
            }

            // 有 menuId：直接处理
            this.applyMenuId();
        },

        applyMenuId() {
            if (!this.menus.length) return;

            const path = findPathById(this.menus, this.menuId);

            // menuId 不存在：落到全树第一个叶子
            if (!path) {
                const firstLeaf = pickFirstLeafFromTree(this.menus);
                if (firstLeaf) {
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: firstLeaf.menuId } });
                }
                return;
            }

            let target = path[path.length - 1];

            // 指向非叶子：落到其下第一个叶子并 replace
            if (!isLeaf(target)) {
                const leaf = pickFirstLeaf(target);
                if (leaf) {
                    this.$router.replace({ path: `/${this.areaType}`, query: { menuId: leaf.menuId } });
                }
                return;
            }

            // ✅ 现在 target 一定是叶子：唯一渲染源
            this.activeLeafNode = target;
            this.activeLeafId = target.menuId;

            // externalLink：自动打开（如果你不想自动打开，把这段删掉）
            if (target.type === "externalLink" && target.link) {
                window.open(target.link, "_blank", "noopener,noreferrer");
            }

            // ===== 计算 Tabs（只依赖 path，不写死层级名称）=====
            const depth = path.length;

            // depth<=2：不显示 tabs
            if (depth <= 2) {
                this.l3Tabs = [];
                this.l4Tabs = [];
                this.activeL3Id = null;
                return;
            }

            // 若叶子在 L3：path[depth-2] 是 L2
            // 若叶子在 L4：path[depth-3] 是 L2
            const l2Node = depth === 3 ? path[depth - 2] : path[depth - 3];
            this.l3Tabs = (l2Node && l2Node.children) ? l2Node.children : [];

            // active L3：depth=3 => target；depth=4 => path[depth-2]
            const l3Node = depth === 3 ? target : path[depth - 2];
            this.activeL3Id = l3Node ? l3Node.menuId : null;

            // L4 tabs：当 L3 有 children（存在 L4）
            this.l4Tabs = (l3Node && l3Node.children && l3Node.children.length) ? l3Node.children : [];
        },

        onClickL3(l3) {
            // L3 若是叶子：直接跳它；若非叶子：跳它下第一个叶子（通常是 L4）
            const leaf = pickFirstLeaf(l3) || l3;
            this.$router.push({ path: `/${this.areaType}`, query: { menuId: leaf.menuId } });
        },

        onClickL4(l4) {
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
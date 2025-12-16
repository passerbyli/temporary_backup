<template>
    <div style="display:flex;height:100vh;">
        <aside style="width:260px;border-right:1px solid #eee;padding:12px;">
            <div style="font-weight:700;margin-bottom:10px;">Area: {{ areaType }}</div>

            <div v-if="loading">loading menu...</div>

            <div v-else>
                <!-- L1 -->
                <div v-for="l1 in menus" :key="l1.menuId" style="margin-bottom:10px;">
                    <div @click="goToNode(l1)" :style="nodeStyle(l1, 1)">
                        {{ l1.menuName }}
                    </div>

                    <!-- L2 -->
                    <div v-if="l1.children && l1.children.length" style="margin-top:6px;margin-left:12px;">
                        <div v-for="l2 in l1.children" :key="l2.menuId" @click="goToNode(l2)" :style="nodeStyle(l2, 2)">
                            {{ l2.menuName }}
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        <main style="flex:1;padding:12px;">
            <router-view :key="$route.fullPath" />
        </main>
    </div>
</template>

<script>
import { fetchMenu } from "@/services/menu";
import { pickFirstLeaf, findPathById } from "@/utils/tree";

export default {
    name: "Layout",
    data() {
        return { menus: [], loading: false, activeL2Id: null };
    },
    computed: {
        areaType() {
            return this.$route.path.startsWith("/oversea") ? "oversea" : "china";
        },
        activeMenuId() {
            return this.$route.query.menuId || null;
        },
    },
    watch: {
        areaType: { immediate: true, handler() { this.loadMenus(); } },
        activeMenuId: { immediate: true, handler() { this.calcActiveL2(); } },
    },
    methods: {
        async loadMenus() {
            this.loading = true;
            this.menus = await fetchMenu(this.areaType);
            this.loading = false;
            this.calcActiveL2();
        },

        calcActiveL2() {
            if (!this.menus.length || !this.activeMenuId) {
                this.activeL2Id = null;
                return;
            }
            const path = findPathById(this.menus, this.activeMenuId);
            // path: [L1, L2, L3, L4]
            this.activeL2Id = path && path.length >= 2 ? path[1].menuId : null;
        },

        goToNode(node) {
            const leaf = pickFirstLeaf(node) || node;
            this.$router.push({ path: `/${this.areaType}`, query: { menuId: leaf.menuId } });
        },

        nodeStyle(node, level) {
            const isActiveSelf = String(this.activeMenuId) === String(node.menuId);

            // ✅ 重点：如果当前在更深层级，也要把祖先 L2 高亮
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
    },
};
</script>
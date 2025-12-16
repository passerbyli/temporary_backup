<template>
    <div ref="host"></div>
</template>

<script>
import Vue2 from "vue2";

export default {
    name: "TopNavBridge",

    // 这些 props 请按你 topNav.js 的 props 来
    props: {
        title: { type: String, default: "统一平台" },
        menus: { type: Array, default: () => [] },
        activeKey: { type: String, default: "" },
        user: { type: Object, default: () => ({ name: "游客" }) }
    },

    data() {
        return {
            vm2: null,      // Vue2 根实例
            root2: null     // Vue2 包装根组件实例（用于更新 props）
        };
    },

    mounted() {
        this.loadAndMount();
    },

    beforeUnmount() {
        this.unmountVue2();
    },

    watch: {
        // props 更新时，同步给 Vue2
        title: "syncPropsToVue2",
        menus: { handler: "syncPropsToVue2", deep: true },
        activeKey: "syncPropsToVue2",
        user: { handler: "syncPropsToVue2", deep: true }
    },

    methods: {
        async loadAndMount() {
            const mod = await import("http://localhost:5173/topNav.js");
            const TopNav = mod.default || mod;

            // 用 Vue2 根组件包一层，方便更新 props & 转发事件
            const Root = Vue2.extend({
                name: "TopNavVue2Root",
                data: () => ({
                    p: {
                        title: this.title,
                        menus: this.menus,
                        activeKey: this.activeKey,
                        user: this.user
                    }
                }),
                render(h) {
                    return h(TopNav, {
                        props: this.p,
                        on: {
                            "menu-click": (payload) => this.$emit("menu-click", payload),
                            "logout": () => this.$emit("logout")
                        }
                    });
                }
            });

            // 建立 Vue2 实例并挂载到容器
            this.vm2 = new Vue2({
                render: (h) =>
                    h(Root, {
                        on: {
                            "menu-click": (payload) => this.$emit("menu-click", payload),
                            "logout": () => this.$emit("logout")
                        }
                    })
            });

            this.vm2.$mount();
            this.$refs.host.appendChild(this.vm2.$el);

            // Root 实例在 vm2.$children[0]
            this.root2 = this.vm2.$children && this.vm2.$children[0];
        },

        syncPropsToVue2() {
            if (!this.root2) return;
            this.root2.p = {
                title: this.title,
                menus: this.menus,
                activeKey: this.activeKey,
                user: this.user
            };
        },

        unmountVue2() {
            if (this.vm2) {
                this.vm2.$destroy();
                if (this.vm2.$el && this.vm2.$el.parentNode) {
                    this.vm2.$el.parentNode.removeChild(this.vm2.$el);
                }
                this.vm2 = null;
                this.root2 = null;
            }
        }
    }
};
</script>
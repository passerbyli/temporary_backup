<template>
    <div ref="host"></div>
</template>

<script>
import Vue2 from "vue2";

export default {
    name: "TopNavBridge",

    // topNav.js 只接收 op，就按它的约定来
    props: {
        op: { type: Object, default: () => ({}) }
    },

    data() {
        return { vm2: null };
    },

    mounted() {
        this.mountRemote();
    },

    beforeUnmount() {
        this.unmountVue2();
    },

    watch: {
        op: {
            deep: true,
            handler() {
                // 如果 topNav.js 只读 this.op 并响应式使用，则需要刷新 Vue2 子树
                // 最稳妥：重挂载（代价是重新请求数据）
                // 如果你确定它不会把 op 缓存在 created 里，可只做轻量更新（见注释）
                this.remount();
            }
        }
    },

    methods: {
        async mountRemote() {
            // 1) 从 Vue3 宿主拿能力（按你们项目实际调整）
            const hostT = this.$t ? this.$t.bind(this) : (k) => k;
            const hostService = this.$service || this.op?.service || window.$service;

            // 2) 注入给 Vue2 子树使用（关键点）
            // 注意：Vue2.prototype 是全局的；如果页面可能挂多个不同“宿主能力”的 topNav，
            // 需要做隔离（见下方“注意事项”）
            Vue2.prototype.$t = (...args) => hostT(...args);
            Vue2.prototype.$service = hostService;

            // （可选）你们 topNav 若依赖这些也一并补齐
            // Vue2.prototype.$i18n = this.$i18n; // 如果存在
            // Vue2.prototype.$config = this.$config;

            const mod = await import("http://localhost:5173/topNav.js");
            const TopNav = mod.default || mod;

            // 3) 创建 Vue2 根并挂载到容器
            this.vm2 = new Vue2({
                render: (h) => h(TopNav, { props: { op: this.op } })
            });

            this.vm2.$mount();
            this.$refs.host.appendChild(this.vm2.$el);
        },

        remount() {
            this.unmountVue2();
            this.mountRemote();
        },

        unmountVue2() {
            if (!this.vm2) return;
            this.vm2.$destroy();
            this.vm2.$el?.remove();
            this.vm2 = null;
        }
    }
};
</script>
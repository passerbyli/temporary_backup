<template>
    <div class="renderer-root">
        <!-- component / jss：把 payload 作为 props 传入 -->
        <component v-if="dynComp" :is="dynComp" v-bind="componentProps" />

        <!-- internalLink：iframe src 拼上参数 -->
        <iframe v-else-if="node && node.type === 'internalLink'" :src="iframeSrc" class="iframe" />

        <!-- externalLink：打开外部链接时也可以拼参数（可选） -->
        <el-result v-else-if="node && node.type === 'externalLink'" icon="success" title="外部链接"
            :sub-title="externalHref">
            <template #extra>
                <el-button type="primary" @click="openExternal(externalHref)">打开</el-button>
            </template>
        </el-result>

        <el-empty v-else description="暂无内容" />
    </div>
</template>

<script>
import { loadBizComponent } from "@/utils/componentLoader";
import { loadRemoteVueComponent } from "@/utils/remoteLoader";
import { buildUrlWithPayload } from "@/utils/routePayload";

export default {
    name: "ContentRenderer",
    props: {
        node: { type: Object, default: null },
        payload: { type: Object, default: () => ({ params: {}, data: {}, queryRaw: {} }) },
    },
    data() {
        return { dynComp: null };
    },
    computed: {
        // 业务组件拿这些 props 就够了（选项式API里直接 this.params / this.data / this.queryRaw）
        componentProps() {
            return {
                params: this.payload.params || {},
                data: this.payload.data || {},
                queryRaw: this.payload.queryRaw || {},
                menu: this.node || null, // 需要的话把当前菜单也传进去
            };
        },
        iframeSrc() {
            if (!this.node || !this.node.link) return "";
            return buildUrlWithPayload(this.node.link, this.payload);
        },
        externalHref() {
            if (!this.node || !this.node.link) return "";
            return buildUrlWithPayload(this.node.link, this.payload);
        },
    },
    watch: {
        node: {
            immediate: true,
            async handler(n) {
                this.dynComp = null;
                if (!n) return;

                if (n.type === "component") {
                    this.dynComp = loadBizComponent(n.componentName);
                    return;
                }
                if (n.type === "jss") {
                    this.dynComp = await loadRemoteVueComponent(n.link);
                    return;
                }
            },
        },
    },
    methods: {
        openExternal(url) {
            if (!url) return;
            window.open(url, "_blank", "noopener,noreferrer");
        },
    },
};
</script>

<style scoped>
.renderer-root {
    height: 100%;
}

.iframe {
    width: 100%;
    height: 100%;
    border: 1px solid var(--el-border-color-light);
    border-radius: 10px;
}
</style>
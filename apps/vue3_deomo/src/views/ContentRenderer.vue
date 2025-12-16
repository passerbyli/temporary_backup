<template>
    <div>
        <!-- component / jss -->
        <component v-if="dynComp" :is="dynComp" />

        <!-- internalLink -->
        <iframe v-else-if="node && node.type === 'internalLink'" :src="node.link"
            style="width:100%;height:calc(100vh - 140px);border:1px solid #eee;border-radius:12px;" />

        <!-- externalLink -->
        <div v-else-if="node && node.type === 'externalLink'" style="padding:12px;">
            已为你打开外部链接：
            <a :href="node.link" target="_blank" rel="noopener noreferrer">{{ node.link }}</a>
        </div>

        <div v-else style="padding:12px;color:#999;">loading...</div>
    </div>



</template>

<script>
import { loadBizComponent } from "@/utils/componentLoader";
import { loadRemoteVueComponent } from "@/utils/remoteLoader";

export default {
    name: "ContentRenderer",
    props: {
        node: { type: Object, default: null }, // 叶子节点
    },
    data() {
        return { dynComp: null };
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
                    // 第三方 Vue 组件（ESM）
                    this.dynComp = await loadRemoteVueComponent(n.link);
                    return;
                }
            },
        },
    },
};
</script>
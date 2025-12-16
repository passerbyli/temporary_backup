<template>
    <div>
        <component v-if="dynComp" :is="dynComp" />

        <iframe v-else-if="node && node.type === 'internalLink'" :src="node.link"
            style="width:100%;height:calc(100vh - 140px);border:1px solid #eee;border-radius:12px;" />

        <div v-else-if="node && node.type === 'externalLink'" style="padding:12px;">
            外部链接已打开：<a :href="node.link" target="_blank" rel="noopener noreferrer">{{ node.link }}</a>
        </div>

        <div v-else style="padding:12px;color:#999;">loading...</div>
    </div>
</template>

<script>
import { loadBizComponent } from "@/utils/componentLoader";
import { loadRemoteVueComponent } from "@/utils/remoteLoader";

export default {
    name: "ContentRenderer",
    props: { node: { type: Object, default: null } },
    data() {
        return { dynComp: null };
    },
    watch: {
        node: {
            immediate: true,
            async handler(n) {
                this.dynComp = null;
                if (!n) return;

                if (n.type === "component") this.dynComp = loadBizComponent(n.componentName);
                if (n.type === "jss") this.dynComp = await loadRemoteVueComponent(n.link);
            },
        },
    },
};
</script>
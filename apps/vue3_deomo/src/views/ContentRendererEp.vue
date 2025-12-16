<template>
    <div>
        <!-- component / jss -->
        <component v-if="dynComp" :is="dynComp" />

        <!-- internalLink -->
        <div v-else-if="node && node.type === 'internalLink'">
            <iframe :src="node.link"
                style="width:100%;height:100%;border:1px solid var(--el-border-color-light);border-radius:10px;" />
        </div>

        <!-- externalLink -->
        <el-result v-else-if="node && node.type === 'externalLink'" icon="success" title="已打开外部链接"
            :sub-title="node.link">
            <template #extra>
                <el-button type="primary" @click="openExternal(node.link)">再次打开</el-button>
            </template>
        </el-result>

        <el-empty v-else description="暂无内容" />
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
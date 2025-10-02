<template>
    <template v-if="noLabel">
        <span v-if="prod === test">{{ prod ?? test ?? '—' }}</span>
        <span v-else>
            <span v-if="prod && test">
                <span class="prod">生产: {{ prod }}</span>
                <span class="test">测试: {{ test }}</span>
            </span>
            <el-tag type="success" v-else-if="prod">生产</el-tag>
            <el-tag type="danger" v-else-if="test">测试</el-tag>
        </span>
    </template>
    <template v-else>
        <span v-if="prod === test">{{ prod ?? test ?? '—' }}</span>
        <span v-else>
            <div><el-tag type="success">生产</el-tag> {{ prod ?? '—' }}</div>
            <div><el-tag type="danger">测试</el-tag> {{ test ?? '—' }}</div>
        </span>
    </template>
</template>
<script setup>
defineProps({ prod: [String, Number, Boolean], test: [String, Number, Boolean], noLabel: Boolean })
</script>
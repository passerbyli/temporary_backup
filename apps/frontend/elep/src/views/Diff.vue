<template>
    <div>
        <div v-if="prod === test">{{ prod }}</div>
        <div v-else>
            <el-tag type="danger">测试: {{ test || '—' }}</el-tag>
            <el-tag type="success">生产: {{ prod || '—' }}</el-tag>
        </div>
    </div>
</template>

<script setup>
defineProps({ prod: String, test: String })
</script>
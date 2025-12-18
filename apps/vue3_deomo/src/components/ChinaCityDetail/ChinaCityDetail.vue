<template>
    <div style="padding:12px;border:1px solid #eee;border-radius:12px;">
        <h2>ChinaCityDetail</h2>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <p>中国区域：city Detail</p>
        <div>params：{{ params }}</div>
    </div>
</template>

<script>
export default {
    name: "ChinaCityDetail",
    props: {
        params: { type: Object, default: () => ({}) },
        data: { type: Object, default: () => ({}) },
        queryRaw: { type: Object, default: () => ({}) },
        menu: { type: Object, default: null },
    },
    mounted() {
        console.log("params", this.params);
        console.log("data", this.data);
        console.log("queryRaw", this.queryRaw);
        console.log("menu", this.menu);
    },
};
</script>
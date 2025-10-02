<template>
    <div class="wrapper">
        <div class="content" ref="content">
            <div class="row">
                <div class="title-r">icon</div>
                <div class="boxs-l">
                    <div class="box">1</div>
                </div>
            </div>
            <div class="row">
                <div class="title-r">icon</div>
                <div class="boxs-l">
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                </div>
            </div>
            <div class="row">
                <div class="title-r">icon</div>
                <div class="boxs-l">
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                </div>
            </div>
            <div class="row">
                <div class="title-r">icon</div>
                <div class="boxs-l">
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                </div>
            </div>
            <div class="row">
                <div class="title-r">icon</div>
                <div class="boxs-l">
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                    <div class="box">1</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'StaticLayout',
    mounted() {
        this.$nextTick(() => {
            const rows = this.$el.querySelectorAll('.row') // ✅ 获取所有 .row DOM
            const heights = Array.from(rows).map(row => row.scrollHeight)
            const total = heights.reduce((a, b) => a + b, 0)
            rows.forEach((row, i) => {
                row.style.flexGrow = (heights[i] / total).toFixed(4)
            })
        })
    }
}
</script>

<style lang="scss" scoped>

.wrapper {
    height: 600px;
    border: 1px solid green;
    div{
        padding:0;
        margin:0;
    }
}

.content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 10px;
    box-sizing: border-box;
    gap: 10px;
}

.row {
    display: flex;
    flex-wrap: wrap;
    flex-shrink: 0;
    border: 1px solid red;
}

.title-r {
    width: 100px;
}

.boxs-l {
    width: calc(100% - 100px);
    display: flex;
    flex-wrap: wrap;
    flex-shrink: 0;
}

.box {
    flex: 0 0 33.33%;
    box-sizing: border-box;
    border: 1px solid #ccc;
    background-color: #eee;
}
</style>
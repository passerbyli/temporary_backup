<template>
    <div></div>
</template>
<script>
export default {
    name: "test",
    methods: {
        test() {
            console.log("test");
        },
        buttonRender() {
            return <div>test</div>
        },
        linkRender() {
            return <div>test</div>
        },
        emailRender() {
            return <div>test</div>
        }   
    }
}
</script>

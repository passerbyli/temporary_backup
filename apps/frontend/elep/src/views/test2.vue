<template>
    <div style="height: 100vh; display: flex; flex-direction: column">
        <div style="padding: 10px; background: #f0f0f0; display: flex; align-items: center; gap: 20px">
            <select v-model="selectedProc" @change="loadGraphData" style="padding: 6px">
                <option v-for="p in procList" :value="p.name" :key="p.name">{{ p.name }}</option>
            </select>
            <input v-model="searchText" @keydown.enter="handleSearch" placeholder="搜索节点"
                style="width: 240px; padding: 6px" />
        </div>
        <div ref="containerRef" style="flex: 1; position: relative"></div>

        <div v-if="drawer.visible"
            style="position: fixed; top: 0; right: 0; width: 360px; height: 100%; background: #fff; border-left: 1px solid #ccc; box-shadow: -2px 0 6px rgba(0,0,0,0.1); padding: 16px; z-index: 1000; overflow: auto">
            <div style="font-weight: bold; font-size: 16px; margin-bottom: 12px">详情：{{ drawer.title }}</div>
            <div v-if="drawer.content">
                <pre style="font-size: 13px; background: #f8f8f8; padding: 10px">{{ drawer.content }}</pre>
            </div>
            <div style="margin-top: 20px; text-align: right">
                <button @click="drawer.visible = false"
                    style="padding: 6px 12px; background: #409EFF; color: white; border: none; border-radius: 4px; cursor: pointer">关闭</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref, reactive, nextTick } from 'vue'
import axios from 'axios'
import G6 from '@antv/g6'

const containerRef = ref()
const searchText = ref('')
const selectedProc = ref('')
const procList = ref([])
const drawer = reactive({ visible: false, title: '', content: '' })
let graph = null

const layerColors = {
    ODS: '#E3F2FD', DWD: '#FFF3E0', DWS: '#E8F5E9', ADS: '#FCE4EC', DIM: '#FFFDE7', PROC: '#E1F5FE'
}

async function loadProcessList() {
    const res = await axios.get('/api/lineage/procs')
    procList.value = res.data || []
    if (res.data.length) {
        selectedProc.value = res.data[0].name
        await loadGraphData()
    }
}

async function loadGraphData() {
    const res = await axios.get(`/api/lineage/graph?proc=${selectedProc.value}`)
    if (graph) {
        graph.changeData(res.data)
        graph.render()
        graph.fitView(20)
    }
}

const handleSearch = () => {
    const keyword = searchText.value.trim().toLowerCase()
    if (!keyword || !graph) return
    const node = graph.getNodes().find(n => n.getModel().label.toLowerCase().includes(keyword))
    if (node) {
        graph.focusItem(node, true)
        graph.setItemState(node, 'selected', true)
        setTimeout(() => graph.setItemState(node, 'selected', false), 1500)
    }
}

function initGraph() {
    G6.registerNode('table-node', {
        draw(cfg, group) {
            const width = 180, rowHeight = 22, headerHeight = 30
            const fields = cfg.fields || []
            const height = headerHeight + fields.length * rowHeight || 40

            group.addShape('rect', {
                attrs: { x: -width / 2, y: -height / 2, width, height, fill: layerColors[cfg.layer] || '#fff', stroke: '#5B8FF9', radius: 6, cursor: 'pointer' },
                name: 'box'
            })
            group.addShape('text', {
                attrs: { text: cfg.label, x: 0, y: -height / 2 + headerHeight / 2, textAlign: 'center', fontWeight: 'bold', fontSize: 14, fill: '#000' },
                name: 'title'
            })
            fields.forEach((field, i) => {
                group.addShape('text', {
                    attrs: { text: `${field.name}: ${field.type}`, x: 0, y: -height / 2 + headerHeight + i * rowHeight + rowHeight / 2, fontSize: 12, fill: '#333', textAlign: 'center', textBaseline: 'middle' },
                    name: `field-${i}`
                })
            })
            return group.get('children')[0]
        }
    }, 'single-node')

    graph = new G6.Graph({
        container: containerRef.value,
        width: containerRef.value.clientWidth,
        height: containerRef.value.clientHeight,
        layout: { type: 'dagre', rankdir: 'LR', nodesep: 40, ranksep: 120 },
        modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node'] },
        defaultNode: { type: 'table-node' },
        defaultEdge: {
            type: 'cubic-horizontal',
            labelCfg: { autoRotate: true, style: { fontSize: 11, fill: '#333' } },
            style: { stroke: '#A3B1BF', endArrow: true }
        },
        nodeStateStyles: { selected: { stroke: '#1890ff', fill: '#e6f7ff' } },
        edgeStateStyles: { selected: { stroke: '#ff5722', lineWidth: 2 } },
        fitView: true, fitCenter: true, animate: true
    })

    graph.on('node:click', async (evt) => {
        const model = evt.item.getModel()
        const res = await axios.get(`/api/lineage/node/${model.id}`)
        drawer.title = model.label
        drawer.content = res.data?.detail || JSON.stringify(res.data, null, 2)
        drawer.visible = true
    })

    graph.on('edge:click', async (evt) => {
        const model = evt.item.getModel()
        const res = await axios.get(`/api/lineage/edge/${model.id}`)
        drawer.title = `边：${model.label}`
        drawer.content = res.data?.detail || JSON.stringify(res.data, null, 2)
        drawer.visible = true
    })

    graph.on('canvas:click', () => {
        drawer.visible = false
    })
}

onMounted(async () => {
    await nextTick()
    initGraph()
    await loadProcessList()
})
</script>

<style>
html,
body {
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: sans-serif;
}
</style>

<template>
    <div style="height: 900px;width: 1000px; display: flex; flex-direction: column">
        <div style="padding: 10px; background: #f0f0f0; display: flex; align-items: center; gap: 20px; flex-wrap: wrap">
            <select v-model="selectedProc" @change="loadGraphData" style="padding: 6px">
                <option v-for="p in procList" :value="p.name" :key="p.name">{{ p.name }}</option>
            </select>
            <input v-model="searchText" @keydown.enter="handleSearch" placeholder="搜索节点或表名"
                style="width: 240px; padding: 6px" />
            <div style="display: flex; align-items: center; gap: 8px">
                <select v-model="hopCount" style="padding: 4px">
                    <option v-for="n in [1, 2, 3, 4, 5]" :value="n">{{ n }} 跳</option>
                </select>
                <button @click="tracePath('up')">向上寻径</button>
                <button @click="tracePath('down')">向下寻径</button>
                <button @click="tracePath('both')">双向寻径</button>
                <button @click="relayout">重新排版</button>
            </div>
            <div style="font-size: 12px">
                <span v-for="(color, layer) in layerColors" :key="layer" :style="{
                    backgroundColor: color,
                    padding: '2px 6px',
                    marginRight: '8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: activeLayer === layer ? '2px solid #333' : '1px solid #ccc'
                }" @click="() => { activeLayer = layer; highlightLayer(layer) }">
                    {{ layer }}
                </span>
                <span style="margin-left: 12px; color: #666">点击图例可高亮分层</span>
            </div>
        </div>
        <div ref="containerRef" style="flex: 1; position: relative">11
            <div v-if="!graphData.nodes?.length"
                style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #aaa; font-size: 16px">
                暂无数据，请选择存储过程或修改路径查询条件</div>
            22
        </div>

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
import { onMounted, ref, reactive, nextTick, onBeforeUnmount } from 'vue'
import axios from 'axios'
import G6 from '@antv/g6'

const containerRef = ref()
const searchText = ref('')
const selectedProc = ref('')
const procList = ref([])
const hopCount = ref(2)
const activeLayer = ref('')
const drawer = reactive({ visible: false, title: '', content: '' })
const graphData = reactive({ nodes: [], edges: [] })
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
    graphData.nodes = res.data?.nodes || []
    graphData.edges = res.data?.edges || []
    if (graph && graphData.nodes.length) {
        graph.changeData(res.data)
        graph.fitView(0, { position: 'top' })
        graph.render()
        // 在图渲染完成后
        // 确保在布局完成后执行偏移
        graph.on('afterlayout', () => {
            const group = graph.getGroup()
            const bbox = group.getCanvasBBox()

            // 获取画布宽高
            const graphWidth = graph.get('width')
            const graphHeight = graph.get('height')
            console.log(graphWidth, graphHeight)
            // 计算偏移
            const dx = (graphWidth - bbox.width) / 2 - bbox.minX
            const dy = 20 - bbox.minY  // 顶部留 20px 间距

            // 应用偏移
            graph.translate(dx, dy)
        })

    } else {
        console.log('-------------')
        graph?.changeData({ nodes: [], edges: [] })
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

async function tracePath(direction) {
    const res = await axios.get(`/api/lineage/path?proc=${selectedProc.value}&direction=${direction}&hops=${hopCount.value}`)
    graphData.nodes = res.data?.nodes || []
    graphData.edges = res.data?.edges || []
    if (graph && graphData.nodes.length) {
        graph.changeData(res.data)
        graph.render()
        graph.fitView(20)
    } else {
        graph?.changeData({ nodes: [], edges: [] })
    }
}

function highlightLayer(layer) {
    graph.getNodes().forEach(node => {
        const model = node.getModel()
        graph.setItemState(node, 'highlight', model.layer === layer)
    })
}

function relayout() {
    if (graph) {
        graph.layout()
        graph.fitView(20)
    }
}

function resizeHandler() {
    if (graph && containerRef.value) {
        graph.changeSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
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
        width: 1000,
        height: 800,
        layout: { type: 'dagre', rankdir: 'LR', nodesep: 40, ranksep: 120 },
        modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node'] },
        defaultNode: { type: 'table-node' },
        defaultEdge: {
            type: 'cubic-horizontal',
            labelCfg: { autoRotate: true, style: { fontSize: 11, fill: '#333' } },
            style: { stroke: '#A3B1BF', endArrow: true }
        },
        nodeStateStyles: { selected: { stroke: '#1890ff', fill: '#e6f7ff' }, highlight: { stroke: '#ff9800', lineWidth: 2 } },
        edgeStateStyles: { selected: { stroke: '#ff5722', lineWidth: 2 } },
        fitView: true, fitCenter: true, animate: true
    })

    window.addEventListener('resize', resizeHandler)

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

onBeforeUnmount(() => {
    window.removeEventListener('resize', resizeHandler)
})
</script>
<style>
html,
body {
    height: 100%;
    margin: 0;
}

</style>
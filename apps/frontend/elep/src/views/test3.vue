<template>
    <div style="height: 100vh; display: flex; flex-direction: column">
        <div style="padding: 10px; background: #f0f0f0; display: flex; align-items: center; gap: 20px">
            <input v-model="searchText" @keydown.enter="handleSearch" placeholder="搜索表名或过程，如 orders 或 sp_xxx"
                style="width: 300px; padding: 6px" />
            <div style="font-size: 12px">
                <span v-for="(color, layer) in layerColors" :key="layer" :style="{
                    backgroundColor: color,
                    padding: '2px 6px',
                    marginRight: '8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: activeLayer === layer ? '2px solid #333' : '1px solid #ccc'
                }" @click="highlightLayer(layer)">
                    {{ layer }}
                </span>
                <span style="margin-left: 12px; color: #666">点击图例可高亮分层</span>
            </div>
        </div>
        <div ref="containerRef" style="flex: 1; position: relative"></div>

        <div v-if="drawer.visible"
            style="position: fixed; top: 0; right: 0; width: 360px; height: 100%; background: #fff; border-left: 1px solid #ccc; box-shadow: -2px 0 6px rgba(0,0,0,0.1); padding: 16px; z-index: 1000; overflow: auto">
            <div style="font-weight: bold; font-size: 16px; margin-bottom: 12px">过程详情：{{ drawer.title }}</div>
            <div v-if="drawer.fields.length">
                <div style="font-weight: bold; font-size: 14px; margin: 8px 0">参数列表：</div>
                <ul style="padding-left: 12px">
                    <li v-for="(f, i) in drawer.fields" :key="i">{{ f.name }}: {{ f.type }}</li>
                </ul>
            </div>
            <div v-else>暂无参数信息</div>
            <div style="margin-top: 20px; text-align: right">
                <button @click="drawer.visible = false"
                    style="padding: 6px 12px; background: #409EFF; color: white; border: none; border-radius: 4px; cursor: pointer">关闭</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref, reactive, nextTick } from 'vue'
import G6 from '@antv/g6'

const containerRef = ref()
const searchText = ref('')
const activeLayer = ref('')
const drawer = reactive({ visible: false, title: '', fields: [] })
let graph = null

const layerColors = {
    ODS: '#E3F2FD',
    DWD: '#FFF3E0',
    DWS: '#E8F5E9',
    ADS: '#FCE4EC',
    DIM: '#FFFDE7',
    PROC: '#E1F5FE'
}

const data = {
    nodes: [
        { id: 'ods.orders', label: 'ods.orders', layer: 'ODS', fields: [{ name: 'order_id', type: 'string' }, { name: 'user_id', type: 'string' }] },
        { id: 'dwd.orders_detail', label: 'dwd.orders_detail', layer: 'DWD', fields: [{ name: 'order_id', type: 'string' }, { name: 'user_id', type: 'string' }] },
        { id: 'dws.user_profile', label: 'dws.user_profile', layer: 'DWS', fields: [{ name: 'uid', type: 'string' }, { name: 'total_payment', type: 'number' }] },
        { id: 'ads.user_dashboard', label: 'ads.user_dashboard', layer: 'ADS', fields: [{ name: 'user_id', type: 'string' }, { name: 'payment_amount', type: 'number' }] },
        { id: 'dim.product_info', label: 'dim.product_info', layer: 'DIM', fields: [{ name: 'product_id', type: 'string' }, { name: 'product_name', type: 'string' }] },
        {
            id: 'sp_get_dashboard_data', label: 'sp_get_dashboard_data()', layer: 'PROC', fields: [
                { name: 'in_user_id', type: 'string' },
                { name: 'out_user_name', type: 'string' },
                { name: 'out_amount', type: 'decimal' }
            ]
        }
    ],
    edges: [
        { source: 'ods.orders', target: 'dwd.orders_detail', label: 'ODS → DWD', mapping: ['user_id → user_id'] },
        { source: 'dwd.orders_detail', target: 'dws.user_profile', label: 'DWD → DWS', mapping: ['user_id → uid'] },
        { source: 'dws.user_profile', target: 'ads.user_dashboard', label: 'DWS → ADS', mapping: ['uid → user_id'] },
        { source: 'ads.user_dashboard', target: 'sp_get_dashboard_data', label: 'CALL input', mapping: ['user_id → in_user_id', 'payment_amount → out_amount'] },
        { source: 'dim.product_info', target: 'sp_get_dashboard_data', label: 'CALL join', mapping: ['product_id → out_user_name'] }
    ]
}

const handleSearch = () => {
    const keyword = searchText.value.trim().toLowerCase()
    if (!keyword || !graph) return
    const found = data.nodes.find(n => n.label.toLowerCase().includes(keyword))
    if (found) {
        graph.focusItem(found.id, true)
        graph.setItemState(found.id, 'selected', true)
        setTimeout(() => graph.setItemState(found.id, 'selected', false), 1500)
    }
}

const highlightLayer = (layer) => {
    activeLayer.value = layer
    graph.getNodes().forEach(node => {
        const model = node.getModel()
        graph.setItemState(node, 'highlight', model.layer === layer)
    })
}

onMounted(async () => {
    await nextTick()
    const container = containerRef.value
    if (!container) return

    G6.registerNode('table-node', {
        draw(cfg, group) {
            const width = 180, rowHeight = 22, headerHeight = 30
            const fields = cfg.fields || []
            const height = headerHeight + fields.length * rowHeight || 40

            group.addShape('rect', {
                attrs: {
                    x: -width / 2, y: -height / 2, width, height,
                    fill: layerColors[cfg.layer] || '#fff', stroke: '#5B8FF9', radius: 6, cursor: 'pointer'
                }, name: 'box'
            })
            group.addShape('text', {
                attrs: {
                    text: cfg.label, x: 0, y: -height / 2 + headerHeight / 2,
                    textAlign: 'center', fontWeight: 'bold', fontSize: 14, fill: '#000'
                }, name: 'title'
            })
            fields.forEach((field, i) => {
                group.addShape('text', {
                    attrs: {
                        text: `${field.name}: ${field.type}`, x: 0,
                        y: -height / 2 + headerHeight + i * rowHeight + rowHeight / 2,
                        fontSize: 12, fill: '#333', textAlign: 'center', textBaseline: 'middle'
                    }, name: `field-${i}`
                })
            })
            return group.get('children')[0]
        }
    }, 'single-node')

    graph = new G6.Graph({
        container,
        width: container.clientWidth,
        height: container.clientHeight,
        layout: { type: 'dagre', rankdir: 'LR', nodesep: 40, ranksep: 120 },
        modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node'] },
        defaultNode: { type: 'table-node' },
        defaultEdge: {
            type: 'cubic-horizontal',
            labelCfg: { autoRotate: true, style: { fontSize: 11, fill: '#333' } },
            style: { stroke: '#A3B1BF', endArrow: true }
        },
        nodeStateStyles: {
            selected: { stroke: '#1890ff', fill: '#e6f7ff' },
            highlight: { stroke: '#ff9800', lineWidth: 2 }
        },
        edgeStateStyles: {
            selected: { stroke: '#ff5722', lineWidth: 2 }
        },
        fitView: true,
        fitCenter: true,
        animate: true
    })

    graph.data(data)
    graph.render()
    graph.fitView(20)

    graph.on('node:mouseenter', (evt) => graph.setItemState(evt.item, 'selected', true))
    graph.on('node:mouseleave', (evt) => graph.setItemState(evt.item, 'selected', false))

    graph.on('node:click', (evt) => {
        const model = evt.item.getModel()
        if (model.layer === 'PROC') {
            drawer.title = model.label
            drawer.fields = model.fields || []
            drawer.visible = true
        }
    })

    graph.on('edge:click', (evt) => {
        const model = evt.item.getModel()
        const mapping = model.mapping || []
        const tooltip = document.createElement('div')
        tooltip.id = 'tooltip'
        tooltip.innerHTML = `<div style='padding:8px; background:#fff; border:1px solid #ccc; border-radius:4px; font-size:12px;'>依赖类型：${model.label}<hr style='margin:4px 0'/>字段映射：<br/>${mapping.join('<br/>')}</div>`
        Object.assign(tooltip.style, {
            position: 'absolute', top: evt.canvasY + 10 + 'px', left: evt.canvasX + 10 + 'px', zIndex: 999, pointerEvents: 'none'
        })
        document.getElementById('tooltip')?.remove()
        document.body.appendChild(tooltip)
    })

    graph.on('canvas:click', () => {
        document.getElementById('tooltip')?.remove()
        drawer.visible = false
    })
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
  

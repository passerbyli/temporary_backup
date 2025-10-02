<template>
    <div style="height: 100%;width: 100%; display: flex; flex-direction: column">
        <div style="padding: 10px; background: #f0f0f0; display: flex; align-items: center; gap: 20px; flex-wrap: wrap">
            <div style="display: flex; align-items: center; gap: 8px">
                <el-radio-group v-model="level" size="small" @change="changeLevel">
                    <el-radio-button label="1" value="1" />
                    <el-radio-button label="2" value="2" />
                    <el-radio-button label="3" value="3" />
                    <el-radio-button label="4" value="4" />
                    <el-radio-button label="5" value="5" />
                    <el-radio-button label="6" value="6" />
                </el-radio-group>
                <el-switch v-model="closed" @change="changeClosed" />
                <el-radio-group v-model="direction" size="small" @change="changeDirection">
                    <el-radio-button label="both" value="both" />
                    <el-radio-button label="up" value="up" />
                    <el-radio-button label="down" value="down" />
                </el-radio-group>
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
            </div>
        </div>
        <div ref="containerRef" style="flex: 1; position: relative">
            <div v-if="!graphData.nodes?.length"
                style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #aaa; font-size: 16px">
                暂无数据，请选择存储过程或修改路径查询条件</div>
            <el-popover :width="450" trigger="click">
                <template #reference>
                    cypher
                </template>
                <template #default>
                    <div style="width:400px">
                        <copyable-textarea :content="cypher"></copyable-textarea>
                    </div>
                </template>
            </el-popover>
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

import InlineCopy from '../components/InlineCopy.vue'
import CopyableTextarea from '../components/CopyableTextarea.vue'

const level = ref('1')
const direction = ref('both')
const containerRef = ref()
const activeLayer = ref('')
const drawer = reactive({ visible: false, title: '', content: '' })
const graphData = reactive({ nodes: [], edges: [] })
const closed = ref(true)
const cypher = ref('')
let graph = null

const layerColors = {
    ods: '#E3F2FD', dwd: '#FFF3E0', dws: '#E8F5E9', ads: '#FCE4EC', dim: '#FFFDE7', proc: '#E1F5FE', api: "#ffccff"
}

const props = defineProps({
    name: {
        type: String,
        required: true
    }, id: {
        type: String,
        required: true
    }
})


// 替换函数
function replaceParams(sql, params) {
    return sql?.replace(/\$([a-zA-Z0-9_]+)/g, (match, p1) => {
        // 如果参数存在，就替换为带引号的值
        if (params.hasOwnProperty(p1)) {
            return `'${params[p1]}'`;
        } else {
            // 如果参数不存在，保持原样或抛出错误
            console.warn(`参数 ${p1} 不存在`);
            return match;
        }
    });
}

async function loadGraphData() {
    console.log(props)
    let params = {
        tableId: props.id,
        name: props.name,
        level: level.value,
        direction: direction.value,
        closed: closed.value
    }
    if (window.ipc) {
        window.ipc.sendInvoke('toMain', {
            event: 'kg', params: params
        }).then(response => {
            console.log(response)

            cypher.value = replaceParams(response.cypher, response.params)



            let res = {
                nodes: [],
                edges: response.edges
            }
            response.nodes.forEach(item => {
                let node = {
                    id: item.id,
                    label: item.label,
                    layer: item.layer,
                }
                if (item.fields) {
                    node.fields = JSON.parse(item.fields)
                }
                res.nodes.push(node)
            })
            graphData.nodes = res?.nodes || []
            graphData.edges = res?.edges || []
            if (graph && graphData.nodes.length) {
                graph.changeData(res)
                graph.render()
                graph.getNodes().forEach(node => {
                    const model = node.getModel()
                    graph.setItemState(node, 'active', model.label === props.name)
                })
                relayout()

            } else {
                graph?.changeData({ nodes: [], edges: [] })
            }
        })
    }


}


const changeClosed = () => {
    loadGraphData()
}


function changeDirection() {
    loadGraphData()
}

const changeLevel = (val) => {
    loadGraphData()
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
        graph.fitView(20, { onlyOutOfViewPort: true, position: 'top' })
    }
}

function resizeHandler() {
    if (graph && containerRef.value) {
        graph.changeSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
    }
}

function initGraph() {

    const container = containerRef.value

    const width = container.clientWidth
    const height = container.clientHeight
    G6.registerNode('custom-node', {
        draw(cfg, group) {
            const width = 180
            const rowHeight = 22
            const headerHeight = 30
            const fields = cfg.fields || []
            const height = headerHeight + fields.length * rowHeight || 40

            group.addShape('rect', {
                attrs: {
                    x: -width / 2,
                    y: -height / 2,
                    width,
                    height,
                    fill: layerColors[cfg.layer] || '#fff',
                    stroke: '#5B8FF9',
                    radius: 6,
                    cursor: 'pointer'
                },
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

    G6.registerEdge(
        'cubic-horizontal',
        {
            afterDraw(cfg, group) {
                const shape = group.get('children')[0];
                const startPoint = shape.getPoint(0);

                const circle = group.addShape('circle', {
                    attrs: {
                        x: startPoint.x,
                        y: startPoint.y,
                        fill: '#1890ff',
                        r: 3,
                    },
                    name: 'circle-shape',
                });

                circle.animate(
                    (ratio) => {
                        const tmpPoint = shape.getPoint(ratio);
                        return {
                            x: tmpPoint.x,
                            y: tmpPoint.y,
                        };
                    },
                    {
                        repeat: true,
                        duration: 3000,
                    },
                );
            },
        },
        'cubic',
    );

    if (graph) graph.destroy()

    graph = new G6.Graph({
        container: containerRef.value,
        width: width,
        height: '500',
        layout: {
            type: 'dagre',
            rankdir: 'LR',
            nodesep: 40,
            ranksep: 120,
            controlPoints: true,
            sortByCombo: true // 同一层节点是否根据每个节点数据中的 comboId 进行排序，以防止 combo 重叠
        },
        modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'collapse-expand'] },
        defaultNode: { type: 'custom-node' },
        defaultEdge: {
            type: 'cubic-horizontal',
            style: { stroke: '#888', endArrow: true },
            labelCfg: { autoRotate: true, style: { fontSize: 10, fill: '#555' } }
        },
        nodeStateStyles: {
            selected: { stroke: '#1890ff', fill: '#e6f7ff' },
            highlight: { stroke: '#ff9800', lineWidth: 2 },
            active: {
                shadowColor: 'red',
                shadowBlur: 10,
                shadowOffsetX: 1,
                shadowOffsetY: 1,
                opacity: 1
            }
        },
        edgeStateStyles: { selected: { stroke: '#ff5722', lineWidth: 2 } },
        fitView: true,
        fitCenter: true
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
    await loadGraphData()
})

onBeforeUnmount(() => {
    window.removeEventListener('resize', resizeHandler)
})
</script>
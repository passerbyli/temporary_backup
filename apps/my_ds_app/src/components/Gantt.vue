<template>
    <div class="gantt">
        <div class="scroll">
            <div class="inner" :style="{ width: timelineWidth + 'px' }">
                <!-- sticky 日历头 -->
                <div class="header">
                    <div class="day" v-for="dItem in days" :key="dItem.key" :class="{ today: dItem.isToday }"
                        :style="{ width: props.dayWidth + 'px' }">
                        <div class="mmdd">{{ dItem.mmdd }}</div>
                        <div class="dow">{{ dItem.dow }}</div>
                    </div>

                    <!-- markLines -->
                    <div v-for="m in markLineViews" :key="m.key" class="mark-line" :style="{ left: m.left + 'px' }">
                        <span>{{ m.name }}</span>
                    </div>
                </div>

                <!-- body -->
                <div class="body">
                    <!-- grid -->
                    <div class="grid">
                        <div v-for="dItem in days" :key="dItem.key" class="grid-day" :class="{ today: dItem.isToday }"
                            :style="{ width: props.dayWidth + 'px' }" />
                    </div>

                    <div class="rows">
                        <div class="row" v-for="t in tasks" :key="t.developers + '|' + t.testers + '|' + t.title"
                            :style="{ height: props.rowHeight + 'px' }">
                            <div class="bar" :style="barStyle(t)" :title="tooltip(t)">
                                <template v-if="role === 'all'">
                                    <div class="seg dev" :style="devSeg(t)"></div>
                                    <div class="seg test" :style="testSeg(t)"></div>
                                </template>
                                <template v-else-if="role === 'dev'">
                                    <div class="seg dev full"></div>
                                </template>
                                <template v-else>
                                    <div class="seg test full"></div>
                                </template>

                                <div class="text">
                                    <div class="textMain">{{ t.developers }} / {{ t.title }}</div>
                                    <div class="textSub">测试：{{ t.testers }}</div>
                                </div>
                            </div>
                        </div>

                        <div v-if="tasks.length === 0" class="empty">
                            无任务
                        </div>
                    </div>
                </div>

                <div class="footerSpace"></div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from "vue"
import dayjs from "dayjs"

const props = defineProps({
    tasks: { type: Array, required: true },          // ✅ 只传筛选/排序后的任务
    taskCycle: { type: Array, required: true },
    markLines: { type: Array, default: () => [] },
    role: { type: String, default: "all" },          // all | dev | test（用于决定条宽/显示）
    dayWidth: { type: String, default: 36 },
    rowHeight: { type: String, default: 74 }
})


/** dayjs helpers（只取日期） */
const d = (s) => dayjs(s).startOf("day")

const cycleStart = computed(() => d(props.taskCycle[0]))
const cycleEnd = computed(() => d(props.taskCycle[1]))
const totalDays = computed(() => cycleEnd.value.diff(cycleStart.value, "day") + 1)
const timelineWidth = computed(() => totalDays.value * props.dayWidth)

const todayKey = dayjs().format("YYYY-MM-DD")

const days = computed(() => {
    const labels = ["日", "一", "二", "三", "四", "五", "六"]
    return Array.from({ length: totalDays.value }, (_, i) => {
        const cur = cycleStart.value.add(i, "day")
        const key = cur.format("YYYY-MM-DD")
        return {
            key,
            mmdd: cur.format("MM/DD"),
            dow: labels[cur.day()],
            isToday: key === todayKey
        }
    })
})

/** range helper */
const range = (start, end) => {
    const l = Math.max(0, start.diff(cycleStart.value, "day"))
    const r = Math.min(totalDays.value - 1, end.diff(cycleStart.value, "day"))
    return { l, r }
}

/** barStyle：根据 role 决定条范围（all/dev/test） */
const barStyle = (t) => {
    let start, end
    if (props.role === "dev") {
        start = d(t.startDate)
        end = d(t.devEndDate)
    } else if (props.role === "test") {
        start = d(t.devEndDate).add(1, "day")
        end = d(t.testEndDate)
    } else {
        start = d(t.startDate)
        end = d(t.testEndDate)
    }

    const { l, r } = range(start, end)
    return {
        left: (l * props.dayWidth) + "px",
        width: ((r - l + 1) * props.dayWidth) + "px",
        height: (props.rowHeight - 16) + "px",
        top: "8px"
    }
}

/** segments（仅 role=all 用到） */
const devSeg = (t) => {
    const { l, r } = range(d(t.startDate), d(t.devEndDate))
    return { left: "0px", width: ((r - l + 1) * props.dayWidth) + "px" }
}

const testSeg = (t) => {
    const testStart = d(t.devEndDate).add(1, "day")
    const testEnd = d(t.testEndDate)
    if (testStart.isAfter(testEnd)) return { display: "none" }

    const wrap = range(d(t.startDate), testEnd)
    const cur = range(testStart, testEnd)
    return {
        left: ((cur.l - wrap.l) * props.dayWidth) + "px",
        width: ((cur.r - cur.l + 1) * props.dayWidth) + "px"
    }
}

const tooltip = (t) => {
    const s = d(t.startDate).format("YYYY-MM-DD")
    const de = d(t.devEndDate).format("YYYY-MM-DD")
    const ts = d(t.devEndDate).add(1, "day").format("YYYY-MM-DD")
    const te = d(t.testEndDate).format("YYYY-MM-DD")
    return `${t.developers} / ${t.title}\n开发：${s} → ${de}\n测试：${ts} → ${te}`
}

const markLineViews = computed(() => {
    return props.markLines
        .map(m => {
            const leftDays = d(m.date).diff(cycleStart.value, "day")
            return {
                key: `${m.name}-${m.date}`,
                name: m.name,
                left: leftDays * props.dayWidth,
                inRange: leftDays >= 0 && leftDays <= totalDays.value - 1
            }
        })
        .filter(x => x.inRange)
})
</script>

<style scoped>
.gantt {
    height: 100%;
    width: 100%;
    border: 1px solid #e6e6e6;
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
    display: flex;
}

/* fills parent; if too many tasks, vertical scrollbar appears automatically */
.scroll {
    flex: 1;
    overflow: auto;
    /* 横向+纵向 */
}

.inner {
    position: relative;
    min-height: 100%;
}

/* header sticky */
.header {
    position: sticky;
    top: 0;
    z-index: 5;
    height: 50px;
    background: #fafafa;
    border-bottom: 1px solid #eee;
    display: flex;
}

.day {
    box-sizing: border-box;
    border-right: 1px solid #eee;
    text-align: center;
    font-size: 12px;
    padding-top: 6px;
}

.mmdd {
    font-weight: 700;
    line-height: 16px;
}

.dow {
    color: #666;
    line-height: 16px;
}

.day.today {
    background: rgba(255, 230, 150, 0.55);
}

.body {
    position: relative;
}

/* grid */
.grid {
    position: absolute;
    inset: 0;
    display: flex;
    pointer-events: none;
    z-index: 0;
}

.grid-day {
    border-right: 1px solid #f0f0f0;
}

.grid-day.today {
    background: rgba(255, 230, 150, 0.35);
}

/* rows */
.rows {
    position: relative;
    z-index: 1;
}

.row {
    position: relative;
    /* ✅ 必须有，否则 bar 会叠在一起 */
    border-bottom: 1px solid #eee;
}

/* bar */
.bar {
    position: absolute;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, .10);
    box-shadow: 0 1px 0 rgba(0, 0, 0, .05);
    display: flex;
    align-items: center;
    justify-content: center;
}

.seg {
    position: absolute;
    top: 0;
    bottom: 0;
}

.seg.dev {
    background: rgba(59, 130, 246, .80);
}

.seg.test {
    background: rgba(16, 185, 129, .80);
}

.seg.full {
    left: 0;
    width: 100%;
}

/* text: max 3 lines, centered */
.text {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: 0 10px;
    color: #fff;
    text-align: center;
    line-height: 1.25;

    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
}

.textMain {
    font-weight: 600;
}

.textSub {
    opacity: .9;
    font-size: 12px;
}

.mark-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-left: 2px dashed rgba(239, 68, 68, 0.7);
    pointer-events: none;
}

.mark-line span {
    position: absolute;
    top: 6px;
    left: 6px;
    background: rgba(255, 255, 255, .92);
    border: 1px solid rgba(239, 68, 68, .25);
    color: rgba(239, 68, 68, .95);
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 999px;
    white-space: nowrap;
}

.empty {
    padding: 24px 12px;
    color: #999;
}

.footerSpace {
    height: 10px;
}
</style>
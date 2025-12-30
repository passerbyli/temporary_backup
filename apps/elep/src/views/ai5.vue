<template>
    <div class="llm-demo">
        <!-- 输入区域 -->
        <el-card shadow="never" class="input-card">
            <div slot="header" class="card-header">
                <span class="card-title">大模型分析 Demo</span>
            </div>

            <el-form :inline="true" :model="form" class="query-form">
                <el-form-item label="伙伴编码" required>
                    <el-input v-model="form.partnerCode" placeholder="请输入伙伴编码" clearable style="width: 220px" />
                </el-form-item>

                <el-form-item label="客户编码">
                    <el-input v-model="form.customerCode" placeholder="客户编码（可选）" clearable style="width: 220px" />
                </el-form-item>

                <el-form-item>
                    <el-button type="primary" :loading="isLoading || isStreaming" :disabled="!canAnalyze"
                        @click="handleAnalyze">
                        {{ isLoading || isStreaming ? '分析中…' : '分析' }}
                    </el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <!-- 输出 + 耗时 + 反馈 -->
        <el-card shadow="never" class="output-card">
            <div slot="header" class="output-header">
                <div class="output-header-left">
                    <span class="card-title">分析结果</span>
                    <span class="ai-chip">AI Response</span>
                </div>

                <div class="metrics">
                    <div class="metric-item">
                        <span class="metric-label">首个响应</span>
                        <span class="metric-value">{{ latencyDisplay }}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">响应耗时</span>
                        <span class="metric-value">{{ responseDisplay }}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">总耗时</span>
                        <span class="metric-value">{{ totalDisplay }}</span>
                    </div>

                    <el-button size="mini" type="text" icon="el-icon-document-copy" :disabled="!outputMarkdown"
                        @click="copyResult">
                        复制
                    </el-button>

                    <el-button v-if="isStreaming" size="mini" type="text" icon="el-icon-close" @click="stopStream">
                        中断回答
                    </el-button>
                </div>
            </div>

            <!-- 加载动画 -->
            <div v-if="isLoading" class="loading-wrapper">
                <div class="spinner"></div>
                <span>正在思考最佳答案…</span>
            </div>

            <!-- 固定高度输出区域 -->
            <div class="output-shell" v-if="outputMarkdown || isStreaming">
                <div class="output-scroll" ref="outputScroll">
                    <div class="markdown-body" v-html="renderedMarkdown"></div>
                </div>
            </div>

            <!-- 空状态 -->
            <div v-if="!isLoading && !isStreaming && !outputMarkdown" class="empty-state">
                暂无内容，请填写伙伴编码后点击「分析」。
            </div>

            <!-- 点赞 / 点踩 -->
            <div v-if="!isLoading && !isStreaming && outputMarkdown" class="feedback-actions">
                <el-button size="mini" :type="liked === true ? 'primary' : 'default'" :plain="liked !== true"
                    :disabled="feedbackSubmitted" @click="handleLike">
                    👍 满意
                </el-button>
                <el-button size="mini" :type="liked === false ? 'danger' : 'default'" :plain="liked !== false"
                    :disabled="feedbackSubmitted" @click="handleDislike">
                    👎 不满意
                </el-button>

                <span v-if="liked === true" class="feedback-hint">感谢你的反馈 🙌</span>
                <span v-if="feedbackSubmitted" class="feedback-hint">已提交反馈，无法再次评价。</span>
            </div>

            <!-- 反馈输入 -->
            <div v-if="showFeedbackBox" class="feedback-box">
                <el-input type="textarea" :rows="3" v-model="feedbackText" placeholder="请描述哪里不准确、不有用或有问题…" />
                <div class="feedback-btn-row">
                    <el-button type="primary" size="mini" :disabled="!feedbackTextTrim || isSubmittingFeedback"
                        @click="submitFeedback">
                        {{ isSubmittingFeedback ? '提交中…' : '提交反馈' }}
                    </el-button>
                    <el-button size="mini" :disabled="isSubmittingFeedback" @click="cancelFeedback">取消</el-button>
                </div>
            </div>
        </el-card>
    </div>
</template>

<script>
import { marked } from 'marked'

const LLM_STREAM_URL = '/llm/stream?mode=normal'
const COMPLIANCE_URL = '/compliance/risk'

export default {
    name: 'LLMStreamDemo',
    data() {
        return {
            form: {
                partnerCode: '',
                customerCode: ''
            },

            isLoading: false,
            isStreaming: false,
            outputMarkdown: '',
            liked: null,
            showFeedbackBox: false,
            feedbackText: '',
            isSubmittingFeedback: false,
            feedbackSubmitted: false,

            // 耗时
            tStart: null,
            tFirstAt: null,
            tEnd: null,

            // 请求控制
            abortController: null, // 主流式接口
            complianceAbort: null, // 合规风险接口

            // 流解析缓冲
            streamBuffer: '',

            // 用于“合规标记位置消费”的缓冲
            sectionBuffer: '',

            // 合规插入标记（来自流）
            complianceInsertToken: '【合规风险】',

            // 内部占位符（用于合规先后顺序不确定）
            complianceMarker: '<!--COMPLIANCE_SECTION-->',
            complianceSectionInserted: false,

            // 合规接口结果
            complianceDone: false,
            complianceMd: '' // 合规最终 markdown；空字符串表示“不插入”
        }
    },
    computed: {
        canAnalyze() {
            return this.form.partnerCode.trim() && !this.isLoading && !this.isStreaming
        },
        feedbackTextTrim() {
            return this.feedbackText.trim()
        },
        renderedMarkdown() {
            return marked(this.outputMarkdown || '')
        },
        latencyDisplay() {
            if (!this.tStart || !this.tFirstAt) return '—'
            const ms = this.tFirstAt - this.tStart
            return (ms / 1000).toFixed(2) + ' s'
        },
        responseDisplay() {
            if (!this.tFirstAt || !this.tEnd) return '—'
            const ms = this.tEnd - this.tFirstAt
            return (ms / 1000).toFixed(2) + ' s'
        },
        totalDisplay() {
            if (!this.tStart || !this.tEnd) return '—'
            const ms = this.tEnd - this.tStart
            return (ms / 1000).toFixed(2) + ' s'
        }
    },
    methods: {
        async handleAnalyze() {
            if (!this.canAnalyze) return

            this.resetState()
            this.isLoading = true
            this.tStart = Date.now()

            try {
                await new Promise(resolve => setTimeout(resolve, 300))
                this.isLoading = false
                await this.startStreamFromApi()
            } catch (e) {
                this.isLoading = false
                this.isStreaming = false
                this.$message.error('调用大模型接口失败')
                console.error(e)
            }
        },

        resetState() {
            if (this.abortController) {
                this.abortController.abort()
                this.abortController = null
            }
            if (this.complianceAbort) {
                this.complianceAbort.abort()
                this.complianceAbort = null
            }

            this.isLoading = false
            this.isStreaming = false
            this.outputMarkdown = ''
            this.liked = null
            this.showFeedbackBox = false
            this.feedbackText = ''
            this.isSubmittingFeedback = false
            this.feedbackSubmitted = false

            this.tStart = null
            this.tFirstAt = null
            this.tEnd = null

            this.streamBuffer = ''
            this.sectionBuffer = ''

            this.complianceSectionInserted = false
            this.complianceDone = false
            this.complianceMd = ''
        },

        // ====== 主入口：并行请求 compliance + 开始读流 ======
        async startStreamFromApi() {
            this.isStreaming = true
            this.abortController = new AbortController()
            this.streamBuffer = ''
            this.sectionBuffer = ''

            // ✅ 并行请求合规风险（不 await）
            this.fetchComplianceSection()

            const body = {
                partnerCode: this.form.partnerCode,
                customerCode: this.form.customerCode || undefined
            }

            let res
            try {
                res = await fetch(LLM_STREAM_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: this.abortController.signal
                })
            } catch (e) {
                if (e.name === 'AbortError') return
                this.isStreaming = false
                this.abortController = null
                this.$message.error('网络或接口异常')
                console.error(e)
                return
            }

            if (!res.ok) {
                this.isStreaming = false
                this.$message.error('接口返回错误状态：' + res.status)
                return
            }

            const reader = res.body && res.body.getReader ? res.body.getReader() : null

            // 兜底：一次性返回
            if (!reader) {
                const text = await res.text()
                this.handleFullText(text)
                this.isStreaming = false
                this.tEnd = Date.now()
                return
            }

            const decoder = new TextDecoder()

            try {
                while (true) {
                    const { value, done } = await reader.read()
                    if (done) break
                    if (!value) continue

                    const chunkText = decoder.decode(value, { stream: true })
                    this.streamBuffer += chunkText
                    this.processStreamBufferToContent(false)
                }
            } finally {
                // ✅ 流结束：强制解析尾巴（修复最后一条解析不到）
                this.processStreamBufferToContent(true)

                // ✅ 把 sectionBuffer 剩余吐出，同时尝试处理“合规标记”
                this.flushSectionBufferTail()

                this.isStreaming = false
                this.tEnd = Date.now()
            }
        },

        // ====== 将 streamBuffer 中尽可能多的 data:JSON 解析出 content ======
        processStreamBufferToContent(isFinal = false) {
            let buf = this.streamBuffer

            while (true) {
                const start = buf.indexOf('data:')
                if (start === -1) {
                    buf = ''
                    break
                }

                const next = buf.indexOf('data:', start + 5)

                // ✅ 没有 next：如果不是 final，保留尾巴等待；如果是 final，尝试解析尾巴
                if (next === -1) {
                    if (!isFinal) {
                        buf = buf.slice(start)
                        break
                    }
                    const jsonStr = buf.slice(start + 5).trim()
                    buf = ''
                    if (jsonStr) this.tryConsumeDataJson(jsonStr)
                    break
                }

                const jsonStr = buf.slice(start + 5, next).trim()
                buf = buf.slice(next)

                if (!jsonStr) continue
                this.tryConsumeDataJson(jsonStr)
            }

            this.streamBuffer = buf
        },

        tryConsumeDataJson(jsonStr) {
            try {
                const json = JSON.parse(jsonStr)
                if (json.errorCode === 0 && json.result && typeof json.result.content === 'string') {
                    if (!this.tFirstAt && this.tStart) this.tFirstAt = Date.now()
                    this.appendStreamText(json.result.content)
                } else if (json.errorCode !== 0) {
                    console.warn('LLM errorCode != 0', json)
                }
            } catch (e) {
                // JSON 被拆开：把它放回头部，等待下一次补齐
                this.streamBuffer = 'data:' + jsonStr + this.streamBuffer
            }
        },

        // 兜底：一次性文本模式
        handleFullText(text) {
            this.streamBuffer = text || ''
            this.processStreamBufferToContent(true)
            this.flushSectionBufferTail()
            if (!this.tFirstAt && this.tStart && this.outputMarkdown) this.tFirstAt = this.tStart
            this.tEnd = Date.now()
        },

        // ====== “合规标记位置”消费逻辑 ======
        appendStreamText(text) {
            this.sectionBuffer += text
            this.consumeComplianceInsertToken()
        },

        consumeComplianceInsertToken() {
            const token = this.complianceInsertToken

            while (true) {
                const idx = this.sectionBuffer.indexOf(token)
                if (idx === -1) {
                    // 安全吐出一部分，避免 buffer 无限增长；保留尾巴防止 token 被截断
                    const safeKeep = Math.max(64, token.length + 16)
                    if (this.sectionBuffer.length > safeKeep) {
                        const out = this.sectionBuffer.slice(0, this.sectionBuffer.length - safeKeep)
                        this.outputMarkdown += out
                        this.sectionBuffer = this.sectionBuffer.slice(this.sectionBuffer.length - safeKeep)
                        this.scrollToBottom()
                    }
                    break
                }

                // 1) 先输出标记前内容
                const before = this.sectionBuffer.slice(0, idx)
                this.outputMarkdown += before

                // 2) 消费掉 token 本身
                this.sectionBuffer = this.sectionBuffer.slice(idx + token.length)

                // 3) 在此位置插入合规段：如果合规已返回且非空 -> 直接插入；否则放占位符（或空）
                if (this.complianceDone) {
                    // 合规接口已完成：有内容则插入，无内容则不插入（即什么都不写）
                    if (this.complianceMd) this.outputMarkdown += this.complianceMd
                } else {
                    // 合规未完成：先占位，后续替换（如果最终为空会替换成空）
                    this.outputMarkdown += this.complianceMarker + '\n\n'
                    this.complianceSectionInserted = true
                }

                this.scrollToBottom()

                // 4) 如果此时合规已经返回（极端竞态），立即尝试替换 marker
                this.tryRenderComplianceIntoDoc()
            }
        },

        flushSectionBufferTail() {
            if (this.sectionBuffer) {
                // 流结束：把剩余全部吐出，同时最后再消费一次 token
                const tail = this.sectionBuffer
                this.sectionBuffer = ''
                this.sectionBuffer = tail
                this.consumeComplianceInsertToken()

                // token 若不在尾巴里，就直接吐出所有
                if (this.sectionBuffer) {
                    this.outputMarkdown += this.sectionBuffer
                    this.sectionBuffer = ''
                    this.scrollToBottom()
                }

                // 流结束后，如果插入过 marker，合规已返回的话做最终替换
                this.tryRenderComplianceIntoDoc()
            } else {
                this.tryRenderComplianceIntoDoc()
            }
        },

        // ====== 合规接口：并行请求，返回数据集 -> Markdown ======
        async fetchComplianceSection() {
            this.complianceAbort = new AbortController()

            const body = {
                partnerCode: this.form.partnerCode,
                customerCode: this.form.customerCode || undefined
            }

            try {
                const res = await fetch(COMPLIANCE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: this.complianceAbort.signal
                })

                if (!res.ok) throw new Error('compliance api status ' + res.status)

                const data = await res.json()

                // ✅ 数据集转 markdown；空则返回 ''
                this.complianceMd = this.complianceDatasetToMarkdown(data)
                this.complianceDone = true

                // 合规可能先于/晚于 token 出现，这里都尝试处理
                this.tryRenderComplianceIntoDoc()
            } catch (e) {
                if (e.name === 'AbortError') return
                // 失败按“空不插入”处理
                this.complianceMd = ''
                this.complianceDone = true
                this.tryRenderComplianceIntoDoc()
            }
        },

        // 你的 /compliance/risk 返回：
        // { errorCode:0, content:[ {item:"风险点:..."}, ... ] }
        // 空 => 返回 ''（不插入）
        complianceDatasetToMarkdown(apiData) {
            const list = apiData && apiData.content
            if (!Array.isArray(list) || list.length === 0) return ''

            const items = list
                .map(x => (x && typeof x.item === 'string' ? x.item.trim() : ''))
                .filter(Boolean)

            if (items.length === 0) return ''

            const title = '**合规风险**\n'
            const lines = items.map(s => {
                const idx = s.indexOf(':') >= 0 ? s.indexOf(':') : s.indexOf('：')
                if (idx > 0) {
                    const k = s.slice(0, idx).trim()
                    const v = s.slice(idx + 1).trim()
                    return `- **${k}**：${v}`
                }
                return `- ${s}`
            })

            return title + lines.join('\n') + '\n\n'
        },

        tryRenderComplianceIntoDoc() {
            if (!this.complianceDone) return
            if (!this.complianceSectionInserted) return

            // complianceMd 为空 => 不插入，直接删除 marker
            this.replaceComplianceMarker(this.complianceMd || '')
            this.complianceSectionInserted = false
        },

        replaceComplianceMarker(mdText) {
            const marker = this.complianceMarker
            const i = this.outputMarkdown.indexOf(marker)
            if (i === -1) return

            this.outputMarkdown =
                this.outputMarkdown.slice(0, i) +
                (mdText || '') +
                this.outputMarkdown.slice(i + marker.length)

            this.$nextTick(this.scrollToBottom)
        },

        scrollToBottom() {
            this.$nextTick(() => {
                const el = this.$refs.outputScroll
                if (el) el.scrollTop = el.scrollHeight
            })
        },

        // ====== 中断 ======
        stopStream() {
            if (this.abortController) {
                this.abortController.abort()
                this.abortController = null
            }
            if (this.complianceAbort) {
                this.complianceAbort.abort()
                this.complianceAbort = null
            }
            if (this.isStreaming) {
                this.isStreaming = false
                this.tEnd = Date.now()
            }
        },

        // ====== 反馈 ======
        handleLike() {
            if (this.feedbackSubmitted) return
            this.liked = true
            this.showFeedbackBox = false
        },
        handleDislike() {
            if (this.feedbackSubmitted) return
            this.liked = false
            this.showFeedbackBox = true
        },
        submitFeedback() {
            if (!this.feedbackTextTrim) return
            this.isSubmittingFeedback = true

            setTimeout(() => {
                this.isSubmittingFeedback = false
                this.showFeedbackBox = false
                this.feedbackSubmitted = true
                this.$message.success('感谢你的反馈！')
            }, 600)
        },
        cancelFeedback() {
            this.showFeedbackBox = false
            this.feedbackText = ''
        },

        // ====== 复制 ======
        copyResult() {
            if (!this.outputMarkdown) return
            const text = this.outputMarkdown
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(
                    () => this.$message.success('复制成功'),
                    () => this.fallbackCopy(text)
                )
            } else {
                this.fallbackCopy(text)
            }
        },
        fallbackCopy(text) {
            const ta = document.createElement('textarea')
            ta.value = text
            ta.style.position = 'fixed'
            ta.style.opacity = '0'
            document.body.appendChild(ta)
            ta.select()
            try {
                document.execCommand('copy')
                this.$message.success('复制成功')
            } catch (e) {
                this.$message.error('复制失败')
            }
            document.body.removeChild(ta)
        }
    },
    beforeUnmount() {
        if (this.abortController) {
            this.abortController.abort()
            this.abortController = null
        }
        if (this.complianceAbort) {
            this.complianceAbort.abort()
            this.complianceAbort = null
        }
    }
}
</script>

<style scoped>
.llm-demo {
    max-width: 900px;
    margin: 24px auto 40px;
    padding: 0 16px;
    box-sizing: border-box;
}

.input-card,
.output-card {
    margin-bottom: 20px;
}

.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.card-title {
    font-weight: 600;
    font-size: 16px;
}

.query-form {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
}

/* 输出头部 & 耗时 */
.output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.output-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.ai-chip {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid #e0e6f1;
    background: #f5f7fb;
    color: #5682ff;
}

.metrics {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
}

.metric-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.metric-label {
    color: #888;
}

.metric-value {
    font-weight: 500;
    color: #333;
}

/* 加载 */
.loading-wrapper {
    display: flex;
    gap: 10px;
    align-items: center;
    color: #666;
    margin-bottom: 8px;
}

.spinner {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 2px solid #e0e0e0;
    border-top-color: #409eff;
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* 输出区域外壳 */
.output-shell {
    border-radius: 10px;
    border: 1px solid #dfe3ec;
    background: #fafbff;
    box-shadow: 0 2px 8px rgba(0, 0, 50, 0.05);
    padding: 8px;
}

/* 固定高度 + 滚动 */
.output-scroll {
    height: 260px;
    overflow-y: auto;
    background: #ffffff;
    border-radius: 8px;
    padding: 12px;
    position: relative;
}

/* 滚动条美化 */
.output-scroll::-webkit-scrollbar {
    width: 6px;
}

.output-scroll::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.18);
    border-radius: 999px;
}

.output-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
}

/* 空状态 */
.empty-state {
    font-size: 13px;
    color: #999;
}

/* 反馈区域 */
.feedback-actions {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.feedback-hint {
    font-size: 12px;
    color: #67c23a;
}

.feedback-box {
    margin-top: 10px;
}

.feedback-btn-row {
    margin-top: 6px;
    display: flex;
    gap: 8px;
}

/* markdown 简单样式 */
.markdown-body {
    font-size: 14px;
    line-height: 1.6;
    color: #1f2933;
}

.markdown-body h2 {
    font-size: 18px;
    margin: 4px 0 6px;
    color: #1d4ed8;
}

.markdown-body h3 {
    font-size: 16px;
    margin: 4px 0 4px;
    color: #2563eb;
}

.markdown-body p {
    margin: 4px 0;
}

.markdown-body code {
    font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
    background: #f3f4f6;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 13px;
}

.markdown-body pre {
    background: #0f172a;
    color: #e5e7eb;
    padding: 10px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 6px 0;
}

.markdown-body pre code {
    background: transparent;
    padding: 0;
}
</style>
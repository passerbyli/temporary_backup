<template>
    <div class="llm-demo">
        <!-- 查询表单 -->
        <el-card shadow="never" class="input-card">
            <div slot="header">
                <span>大模型分析 Demo</span>
            </div>

            <el-form :inline="true" :model="form" class="query-form">
                <el-form-item label="伙伴编码" required>
                    <el-input v-model="form.partnerCode" placeholder="必填" clearable style="width: 200px" />
                </el-form-item>
                <el-form-item label="客户编码">
                    <el-input v-model="form.customerCode" placeholder="选填" clearable style="width: 200px" />
                </el-form-item>
            </el-form>

            <el-form label-position="top" class="query-form">
                <el-form-item label="分析内容">
                    <el-input type="textarea" :rows="3" v-model="form.query" placeholder="请输入要分析的内容，如：分析一下这个错误日志…" />
                </el-form-item>
            </el-form>

            <div class="input-actions">
                <el-button type="primary" :loading="isLoading || isStreaming" :disabled="!canAnalyze"
                    @click="handleAnalyze">
                    {{ isLoading || isStreaming ? '分析中…' : '分析' }}
                </el-button>
                <span class="tip">伙伴编码必填，客户编码可选。点击“分析”后会模拟大模型的流式输出。</span>
            </div>
        </el-card>

        <!-- 结果 + 耗时 + 反馈 -->
        <el-card shadow="never" class="output-card">
            <div slot="header" class="output-header">
                <span>分析结果</span>
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
                </div>
            </div>

            <!-- 加载动画 -->
            <div v-if="isLoading" class="loading-wrapper">
                <div class="spinner"></div>
                <span>思考中，请稍候…</span>
            </div>

            <!-- 固定高度的输出区域，自动滚动到底部 -->
            <div class="output-scroll" v-if="outputMarkdown || isStreaming" ref="outputScroll">
                <div class="markdown-body" v-html="renderedMarkdown"></div>
            </div>

            <!-- 空状态 -->
            <div v-if="!isLoading && !isStreaming && !outputMarkdown" class="empty-state">
                暂无内容，请先输入信息并点击「分析」。
            </div>

            <!-- 点赞 / 点踩 -->
            <div v-if="!isLoading && !isStreaming && outputMarkdown" class="feedback-actions">
                <el-button size="mini" class="icon-btn" :type="liked === true ? 'primary' : 'default'"
                    :plain="liked !== true" :disabled="feedbackSubmitted" @click="handleLike">
                    👍 满意
                </el-button>
                <el-button size="mini" class="icon-btn" :type="liked === false ? 'danger' : 'default'"
                    :plain="liked !== false" :disabled="feedbackSubmitted" @click="handleDislike">
                    👎 不满意
                </el-button>
                <span v-if="liked === true" class="feedback-hint">
                    感谢你的反馈 🙌
                </span>
                <span v-if="feedbackSubmitted" class="feedback-hint">
                    已提交反馈，无法再次评价。
                </span>
            </div>

            <!-- 反馈文本框（点踩时出现） -->
            <div v-if="showFeedbackBox" class="feedback-box">
                <el-input type="textarea" :rows="3" v-model="feedbackText" placeholder="可以简单描述哪里不准确、不有用或有问题…" />
                <div class="feedback-btn-row">
                    <el-button type="primary" size="mini" :disabled="!feedbackTextTrim || isSubmittingFeedback"
                        @click="submitFeedback">
                        {{ isSubmittingFeedback ? '提交中…' : '提交反馈' }}
                    </el-button>
                    <el-button size="mini" :disabled="isSubmittingFeedback" @click="cancelFeedback">
                        取消
                    </el-button>
                </div>
            </div>
        </el-card>
    </div>
</template>

<script>
// 注意：marked 1.x 用法是 marked(str)，不是 marked.parse
import {marked} from 'marked'

export default {
    name: 'LLMStreamDemo',
    data() {
        return {
            form: {
                partnerCode: '',
                customerCode: '',
                query: ''
            },
            isLoading: false,
            isStreaming: false,
            outputMarkdown: '',
            liked: null, // true / false / null
            showFeedbackBox: false,
            feedbackText: '',
            isSubmittingFeedback: false,
            feedbackSubmitted: false, // 提交反馈后禁止再点赞/点踩
            streamTimer: null,

            // 耗时相关
            tStart: null,
            tFirstChunk: null,
            tEnd: null,
            latencyMs: null,
            responseMs: null,
            totalMs: null
        }
    },
    computed: {
        canAnalyze() {
            return (
                this.form.partnerCode.trim() &&
                this.form.query.trim() &&
                !this.isLoading &&
                !this.isStreaming
            )
        },
        feedbackTextTrim() {
            return this.feedbackText.trim()
        },
        renderedMarkdown() {
            return marked(this.outputMarkdown || '')
        },
        latencyDisplay() {
            if (this.latencyMs == null) {
                return this.isLoading || this.isStreaming ? '计算中…' : '—'
            }
            return (this.latencyMs / 1000).toFixed(2) + ' s'
        },
        responseDisplay() {
            if (this.responseMs == null) {
                // 首个响应有了，但还在流式中，显示计算中
                if (this.latencyMs != null && (this.isStreaming || this.isLoading)) {
                    return '计算中…'
                }
                return '—'
            }
            return (this.responseMs / 1000).toFixed(2) + ' s'
        },
        totalDisplay() {
            if (this.totalMs == null) {
                return this.isStreaming || this.isLoading ? '计算中…' : '—'
            }
            return (this.totalMs / 1000).toFixed(2) + ' s'
        }
    },
    methods: {
        handleAnalyze() {
            if (!this.canAnalyze) return

            this.resetStateForNewQuery()
            this.isLoading = true
            this.tStart = Date.now()

            // 模拟“先思考一下”，再开始流式输出
            setTimeout(() => {
                this.isLoading = false
                this.startFakeStream()
            }, 500)
        },
        resetStateForNewQuery() {
            this.clearStreamTimer()
            this.isLoading = false
            this.isStreaming = false
            this.outputMarkdown = ''
            this.liked = null
            this.showFeedbackBox = false
            this.feedbackText = ''
            this.isSubmittingFeedback = false
            this.feedbackSubmitted = false

            this.tStart = null
            this.tFirstChunk = null
            this.tEnd = null
            this.latencyMs = null
            this.responseMs = null
            this.totalMs = null
        },
        // 模拟流式输出（接入真实流式接口时替换这里即可）
        startFakeStream() {
            this.isStreaming = true
            this.outputMarkdown = ''

            const chunks = [
                `## 分析结果概览\n\n你输入的伙伴编码是：\`${this.form.partnerCode}\`，客户编码是：\`${this.form.customerCode || '（未填写）'}\`\n\n你的问题是：\n\n> ${this.form.query}\n\n下面是根据问题给出的分析：\n\n`,
                `### 1. 可能的原因\n\n- 这是一个示例段落，用于演示 **Markdown** 渲染和流式输出效果。\n- 在真实场景下，这里应该是大模型返回的内容。\n\n`,
                `### 2. 建议的排查步骤\n\n1. 检查输入是否完整、上下文是否充分。\n2. 如果涉及错误日志，建议提供 **关键堆栈信息**。\n3. 可以多次迭代提问，让模型逐步细化结论。\n\n`,
                `### 3. 示例代码\n\n\`\`\`js\nfunction demo() {\n  console.log('这里可以放一些示例代码');\n}\n\`\`\`\n\n`,
                `---\n\n如果你觉得这个回答不够有用，可以点击 👎 并填写反馈，帮助我们不断改进体验。`
            ]

            let index = 0
            this.streamTimer = setInterval(() => {
                if (index < chunks.length) {
                    // 首个 chunk 到达时记录首包时间
                    if (index === 0 && !this.tFirstChunk && this.tStart) {
                        this.tFirstChunk = Date.now()
                        this.latencyMs = this.tFirstChunk - this.tStart
                    }

                    this.outputMarkdown += chunks[index]
                    index++

                    // 每追加一次，滚动到底部
                    this.$nextTick(() => {
                        const el = this.$refs.outputScroll
                        if (el) {
                            el.scrollTop = el.scrollHeight
                        }
                    })
                } else {
                    this.clearStreamTimer()
                    this.isStreaming = false
                    this.tEnd = Date.now()

                    if (this.tFirstChunk && this.tEnd) {
                        this.responseMs = this.tEnd - this.tFirstChunk
                    }
                    if (this.tStart && this.tEnd) {
                        this.totalMs = this.tEnd - this.tStart
                    }
                }
            }, 500) // 每 500ms 输出一段
        },
        clearStreamTimer() {
            if (this.streamTimer) {
                clearInterval(this.streamTimer)
                this.streamTimer = null
            }
        },
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

            // 这里替换为你的真实反馈接口
            setTimeout(() => {
                console.log('反馈内容：', {
                    partnerCode: this.form.partnerCode,
                    customerCode: this.form.customerCode,
                    query: this.form.query,
                    liked: this.liked,
                    feedback: this.feedbackTextTrim
                })
                this.isSubmittingFeedback = false
                this.showFeedbackBox = false
                this.feedbackSubmitted = true
                this.$message.success('感谢你的反馈，我们会尽快改进！')
            }, 600)
        },
        cancelFeedback() {
            this.showFeedbackBox = false
            this.feedbackText = ''
            // 看需求是否保留点踩状态，这里先保留
        },
        copyResult() {
            const text = this.outputMarkdown || ''
            if (!text) return

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(
                    () => {
                        this.$message.success('已复制到剪贴板')
                    },
                    () => {
                        this.fallbackCopy(text)
                    }
                )
            } else {
                this.fallbackCopy(text)
            }
        },
        fallbackCopy(text) {
            const textarea = document.createElement('textarea')
            textarea.value = text
            textarea.style.position = 'fixed'
            textarea.style.opacity = '0'
            document.body.appendChild(textarea)
            textarea.select()
            try {
                document.execCommand('copy')
                this.$message.success('已复制到剪贴板')
            } catch (e) {
                this.$message.error('复制失败')
            }
            document.body.removeChild(textarea)
        }
    },
    beforeDestroy() {
        this.clearStreamTimer()
    }
}
</script>

<style scoped>
.llm-demo {
    max-width: 900px;
    margin: 24px auto 40px;
    padding: 0 16px;
}

.input-card,
.output-card {
    margin-bottom: 20px;
}

.query-form {
    margin-bottom: 8px;
}

.input-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.tip {
    font-size: 12px;
    color: #888;
}

.output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.metrics {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
}

.metric-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.metric-label {
    color: #999;
}

.metric-value {
    font-weight: 500;
}

.loading-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #555;
    margin-bottom: 8px;
}

.spinner {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #e0e0e0;
    border-top-color: #409eff;
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* 固定高度的输出区域，自动滚动到底部 */
.output-scroll {
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 10px 12px;
    height: 260px;
    overflow-y: auto;
    background: #fafbfc;
}

.empty-state {
    color: #999;
    font-size: 13px;
}

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

/* 简单 markdown 样式 */
.markdown-body {
    font-size: 14px;
    line-height: 1.6;
    color: #222;
}

.markdown-body h2 {
    font-size: 18px;
    margin: 8px 0 4px;
}

.markdown-body h3 {
    font-size: 16px;
    margin: 8px 0 4px;
}

.markdown-body p {
    margin: 4px 0;
}

.markdown-body code {
    font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
    background: #f6f8fa;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 13px;
}

.markdown-body pre {
    background: #0d1117;
    color: #c9d1d9;
    padding: 10px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 6px 0;
}

.markdown-body pre code {
    background: transparent;
    padding: 0;
}
</style>
<template>
    <div class="llm-demo">
        <!-- 顶部输入卡片 -->
        <div class="card input-card">
            <h2 class="card-title">大模型分析 Demo</h2>
            <div class="input-row">
                <input v-model="inputText" class="query-input" type="text" placeholder="请输入要分析的问题，例如：分析一下这个错误日志…"
                    @keyup.enter="handleAnalyze" />
                <button class="primary-btn" :disabled="!inputTextTrim || isLoading || isStreaming"
                    @click="handleAnalyze">
                    {{ isLoading || isStreaming ? '分析中…' : '分析' }}
                </button>
            </div>
            <p class="tip">演示：流式输出 + Markdown 渲染 + 动态耗时 + 点赞/点踩反馈。</p>
        </div>

        <!-- 输出卡片 -->
        <div class="card output-card">
            <!-- 顶部操作条：复制按钮、状态 -->
            <div class="output-toolbar">
                <div class="status-text">
                    <span v-if="isLoading">状态：思考中…</span>
                    <span v-else-if="isStreaming">状态：回答生成中…</span>
                    <span v-else-if="outputMarkdown">状态：已完成</span>
                    <span v-else>状态：待输入</span>
                </div>
                <button class="ghost-btn small" :disabled="!outputMarkdown" @click="copyOutput">
                    复制内容
                </button>
            </div>

            <!-- 加载动画 -->
            <div v-if="isLoading" class="loading-wrapper">
                <div class="spinner"></div>
                <span>大模型正在思考，请稍候…</span>
            </div>

            <!-- 固定高度输出区域 -->
            <div ref="outputContainer" class="output-wrapper fixed-height">
                <div v-if="outputMarkdown" class="markdown-body" v-html="renderedMarkdown"></div>

                <div v-else-if="!isLoading" class="empty-state">
                    暂无内容，请在上方输入问题并点击「分析」开始体验。
                </div>
            </div>

            <!-- 动态耗时 -->
            <div v-if="analyzeStartTime" class="timing-panel">
                <div class="timing-item">
                    <span class="label">从分析到首个响应：</span>
                    <span class="value">{{ timeToFirstStr }}</span>
                </div>
                <div class="timing-item">
                    <span class="label">响应耗时：</span>
                    <span class="value">{{ responseDurationStr }}</span>
                </div>
                <div class="timing-item">
                    <span class="label">总耗时：</span>
                    <span class="value">{{ totalDurationStr }}</span>
                </div>
            </div>

            <!-- 点赞 / 点踩 -->
            <div v-if="!isLoading && !isStreaming && outputMarkdown" class="feedback-actions">
                <button class="icon-btn" :class="{ active: liked === true }" @click="handleLike">
                    👍 满意
                </button>
                <button class="icon-btn" :class="{ active: liked === false }" @click="handleDislike">
                    👎 不满意
                </button>
                <span v-if="liked === true" class="feedback-hint">
                    感谢你的反馈 🙌
                </span>
            </div>

            <!-- 反馈文本框 -->
            <div v-if="showFeedbackBox" class="feedback-box">
                <textarea v-model="feedbackText" class="feedback-textarea"
                    placeholder="可以简单说明哪里不准确、不清晰或不符合预期…"></textarea>
                <div class="feedback-btn-row">
                    <button class="primary-btn" :disabled="!feedbackTextTrim || isSubmittingFeedback"
                        @click="submitFeedback">
                        {{ isSubmittingFeedback ? '提交中…' : '提交反馈' }}
                    </button>
                    <button class="ghost-btn" @click="cancelFeedback" :disabled="isSubmittingFeedback">
                        取消
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
// marked v15 写法
import { marked } from 'marked'

export default {
    name: 'LLMStreamDemo',
    data() {
        return {
            inputText: '',
            isLoading: false,
            isStreaming: false,
            outputMarkdown: '',
            streamTimer: null,

            liked: null,
            showFeedbackBox: false,
            feedbackText: '',
            isSubmittingFeedback: false,

            analyzeStartTime: null,
            firstChunkTime: null,
            lastChunkTime: null,
            timingTimer: null
        }
    },
    computed: {
        inputTextTrim() {
            return this.inputText.trim()
        },
        feedbackTextTrim() {
            return this.feedbackText.trim()
        },
        renderedMarkdown() {
            return marked.parse(this.outputMarkdown || '')
        },
        timeToFirst() {
            if (!this.analyzeStartTime || !this.firstChunkTime) return 0
            return this.firstChunkTime - this.analyzeStartTime
        },
        responseDuration() {
            if (!this.firstChunkTime || !this.lastChunkTime) return 0
            return this.lastChunkTime - this.firstChunkTime
        },
        totalDuration() {
            if (!this.analyzeStartTime) return 0
            return (this.lastChunkTime || Date.now()) - this.analyzeStartTime
        },
        timeToFirstStr() {
            return this.formatDuration(this.timeToFirst)
        },
        responseDurationStr() {
            return this.formatDuration(this.responseDuration)
        },
        totalDurationStr() {
            return this.formatDuration(this.totalDuration)
        }
    },
    watch: {
        // 每次输出变化时，自动滚动到底部
        outputMarkdown() {
            this.$nextTick(() => {
                const el = this.$refs.outputContainer
                if (el) {
                    el.scrollTop = el.scrollHeight
                }
            })
        }
    },
    methods: {
        handleAnalyze() {
            if (!this.inputTextTrim || this.isLoading || this.isStreaming) return

            this.resetAll()

            this.analyzeStartTime = Date.now()
            this.isLoading = true

            // 模拟“思考中”
            setTimeout(() => {
                this.isLoading = false
                this.startFakeStream()
            }, 500)

            // 动态刷新耗时显示
            this.timingTimer = setInterval(() => {
                this.$forceUpdate()
            }, 100)
        },

        resetAll() {
            clearInterval(this.streamTimer)
            clearInterval(this.timingTimer)

            this.outputMarkdown = ''
            this.isStreaming = false
            this.isLoading = false

            this.analyzeStartTime = null
            this.firstChunkTime = null
            this.lastChunkTime = null

            this.liked = null
            this.showFeedbackBox = false
            this.feedbackText = ''
            this.isSubmittingFeedback = false
        },

        // 模拟流式输出（真实接入时改这里）
        startFakeStream() {
            this.isStreaming = true
            this.outputMarkdown = ''

            const chunks = [
                `## 分析结果概览\n\n你输入的是：\n\n> ${this.inputText}\n\n下面是基于内容给出的示例分析：\n\n`,
                `### 1. 可能原因\n- 这是一个用于演示的段落。\n- 实际项目中，这里应替换为大模型的真实输出。\n\n`,
                `### 2. 建议步骤\n1. 提供更完整的上下文信息。\n2. 逐步拆解问题，分步骤提问。\n3. 对重要结论进行人工复核。\n\n`,
                `### 3. 示例代码\n\`\`\`js\nfunction demo() {\n  console.log('这里是代码块示例');\n}\n\`\`\`\n\n`,
                `---\n如果你觉得这个回答不够好，可以点击 👎 提交反馈，帮助我们优化大模型体验。`
            ]

            let idx = 0
            this.streamTimer = setInterval(() => {
                if (idx < chunks.length) {
                    if (idx === 0 && !this.firstChunkTime) {
                        this.firstChunkTime = Date.now()
                    }
                    this.outputMarkdown += chunks[idx]
                    idx++
                } else {
                    clearInterval(this.streamTimer)
                    this.isStreaming = false
                    this.lastChunkTime = Date.now()
                }
            }, 500)
        },

        formatDuration(ms) {
            if (!ms || ms <= 0) return '--'
            if (ms < 1000) return `${ms} ms`
            return (ms / 1000).toFixed(2) + ' s'
        },

        // 复制输出内容（复制 markdown 文本）
        copyOutput() {
            const text = this.outputMarkdown || ''
            if (!text) return

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(
                    () => {
                        alert('内容已复制到剪贴板')
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
                alert('内容已复制到剪贴板')
            } catch (e) {
                alert('复制失败，请手动选择内容复制')
            }
            document.body.removeChild(textarea)
        },

        // 反馈相关
        handleLike() {
            this.liked = true
            this.showFeedbackBox = false
        },
        handleDislike() {
            this.liked = false
            this.showFeedbackBox = true
        },
        submitFeedback() {
            if (!this.feedbackTextTrim) return
            this.isSubmittingFeedback = true

            // 这里可以换成真实接口
            setTimeout(() => {
                console.log('反馈内容：', this.feedbackTextTrim, {
                    timeToFirst: this.timeToFirst,
                    responseDuration: this.responseDuration,
                    totalDuration: this.totalDuration
                })
                this.isSubmittingFeedback = false
                this.showFeedbackBox = false
                alert('反馈已提交，感谢你的帮助！')
            }, 500)
        },
        cancelFeedback() {
            this.showFeedbackBox = false
            this.feedbackText = ''
        }
    },
    beforeDestroy() {
        clearInterval(this.streamTimer)
        clearInterval(this.timingTimer)
    }
}
</script>

<style scoped>
.llm-demo {
    max-width: 900px;
    margin: 32px auto;
    padding: 0 16px 40px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1f2328;
    box-sizing: border-box;
}

.card {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
    padding: 18px 20px 20px;
    margin-bottom: 18px;
    box-sizing: border-box;
}

.input-card {
    border-left: 4px solid #1677ff;
}

.card-title {
    margin: 0 0 10px;
    font-size: 18px;
    font-weight: 600;
}

.input-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.query-input {
    flex: 1;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid #d0d7de;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
}

.query-input:focus {
    border-color: #1677ff;
    box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.18);
}

.primary-btn {
    padding: 8px 16px;
    border-radius: 999px;
    border: none;
    background: #1677ff;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, opacity 0.15s, transform 0.1s;
}

.primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.primary-btn:not(:disabled):hover {
    background: #145fcb;
}

.primary-btn:not(:disabled):active {
    transform: scale(0.97);
}

.tip {
    margin-top: 6px;
    font-size: 12px;
    color: #6e7781;
}

.output-card {
    padding-top: 14px;
}

/* 顶部工具条 */
.output-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
}

.status-text {
    color: #6e7781;
}

.ghost-btn {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid #d0d7de;
    background: #f6f8fa;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}

.ghost-btn.small {
    font-size: 12px;
    padding: 4px 10px;
}

.ghost-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.ghost-btn:not(:disabled):hover {
    background: #eaeef2;
}

/* 输出区域 */
.output-wrapper {
    background: #f6f8fa;
    border-radius: 8px;
    padding: 10px 12px;
    box-sizing: border-box;
}

.fixed-height {
    height: 280px;
    overflow-y: auto;
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
    border-top-color: #1677ff;
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.empty-state {
    color: #8c959f;
    font-size: 13px;
}

/* 耗时信息 */
.timing-panel {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed #e3e3e3;
    font-size: 12px;
    color: #555;
}

.timing-item {
    display: flex;
    gap: 4px;
    margin-top: 2px;
}

.timing-item .label {
    color: #6e7781;
}

.timing-item .value {
    font-weight: 500;
}

/* 点赞 / 点踩 */
.feedback-actions {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.icon-btn {
    border-radius: 999px;
    border: 1px solid #d0d7de;
    padding: 4px 10px;
    font-size: 13px;
    background: #f6f8fa;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.icon-btn:hover {
    background: #eaeef2;
}

.icon-btn.active {
    background: #edf5ff;
    border-color: #1677ff;
    color: #1677ff;
}

.feedback-hint {
    font-size: 12px;
    color: #22863a;
}

/* 反馈文本框 */
.feedback-box {
    margin-top: 10px;
}

.feedback-textarea {
    width: 100%;
    min-height: 70px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid #d0d7de;
    font-size: 13px;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
}

.feedback-textarea:focus {
    border-color: #1677ff;
    box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.12);
}

.feedback-btn-row {
    margin-top: 8px;
    display: flex;
    gap: 8px;
}

/* Markdown 样式（简单版） */
.markdown-body {
    font-size: 14px;
    line-height: 1.6;
    color: #1f2328;
}

.markdown-body h2 {
    font-size: 18px;
    margin: 8px 0 4px;
}

.markdown-body h3 {
    font-size: 16px;
    margin: 6px 0 4px;
}

.markdown-body p {
    margin: 4px 0;
}

.markdown-body ul,
.markdown-body ol {
    margin: 4px 0 4px 20px;
}

.markdown-body code {
    font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
    background: #eaeef2;
    padding: 1px 4px;
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
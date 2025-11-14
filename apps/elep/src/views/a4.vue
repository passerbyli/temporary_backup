<script>
import marked from 'marked' // 1.x

// 独立的模拟函数：假装是后端 SSE 流
// 会按 data:{"errorCode":0,"result":{"content":"xxx"}} 这样的格式回调
function mockLLMStream({ partnerCode, customerCode, onData, onEnd }) {
    // 这里模拟拆成很多小块返回
    const logicalChunks = [
        { content: '伙伴编码：' + partnerCode + '\n\n' },
        { content: '客户编码：' + (customerCode || '未填写') + '\n\n' },
        { content: '开始为你分析相关信息。\n\n' },
        { content: '1. 这是一个模拟的大模型流式输出示例；\n' },
        { content: '2. 实际接入时只需要把 mockLLMStream 换成真实接口；\n\n' },
        { content: '```js\nconsole.log("mock streaming...")\n```\n\n' },
        { content: '如对结果不满意，可以点 👎 反馈。\n' }
    ]

    let index = 0
    const timer = setInterval(() => {
        if (index >= logicalChunks.length) {
            clearInterval(timer)
            onEnd && onEnd()
            return
        }

        const chunk = logicalChunks[index]
        index++

        const payload = {
            errorCode: 0,
            result: { content: chunk.content }
        }

        // 模拟后端返回的 data:xxx 行
        const line = 'data:' + JSON.stringify(payload)

        onData && onData(line)
    }, 400) // 每 400ms 返回一块

    // 返回一个“取消函数”，以后你要中断可以用
    return () => clearInterval(timer)
}

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

            tStart: null,
            tFirstAt: null,
            tEnd: null,

            mockCancel: null // 保存模拟流的取消函数
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

            // 模拟“思考中”显示一小会
            await new Promise(resolve => setTimeout(resolve, 300))

            this.isLoading = false
            this.startMockStream()
        },

        resetState() {
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

            if (this.mockCancel) {
                this.mockCancel()
                this.mockCancel = null
            }
        },

        // ⭐ 使用独立的模拟函数，而不是调用真实接口
        startMockStream() {
            this.isStreaming = true
            this.outputMarkdown = ''

            let firstChunkHandled = false

            this.mockCancel = mockLLMStream({
                partnerCode: this.form.partnerCode,
                customerCode: this.form.customerCode,
                onData: (line) => {
                    // line 形如: data:{"errorCode":0,"result":{"content":"xxx"}}
                    line = line.trim()
                    if (!line.startsWith('data:')) return

                    const jsonStr = line.replace('data:', '').trim()
                    try {
                        const json = JSON.parse(jsonStr)
                        if (json.errorCode === 0 && json.result && json.result.content) {
                            const content = json.result.content

                            if (!firstChunkHandled) {
                                firstChunkHandled = true
                                if (!this.tFirstAt && this.tStart) {
                                    this.tFirstAt = Date.now()
                                }
                            }

                            this.outputMarkdown += content

                            this.$nextTick(() => {
                                const el = this.$refs.outputScroll
                                if (el) el.scrollTop = el.scrollHeight
                            })
                        }
                    } catch (e) {
                        console.warn('解析模拟 data JSON 失败：', line, e)
                    }
                },
                onEnd: () => {
                    this.isStreaming = false
                    this.tEnd = Date.now()
                    this.mockCancel = null
                }
            })
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

            // 这里随便模拟一下
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
    beforeDestroy() {
        if (this.mockCancel) this.mockCancel()
    }
}
</script>
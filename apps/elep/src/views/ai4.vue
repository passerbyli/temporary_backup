<script>
import marked from 'marked' // 1.x

export default {
    name: 'LLMStreamDemo',
    data() {
        return {
            form: {
                partnerCode: '',
                customerCode: ''
            },

            // 状态
            isLoading: false,
            isStreaming: false,
            outputMarkdown: '',
            liked: null,
            showFeedbackBox: false,
            feedbackText: '',
            isSubmittingFeedback: false,
            feedbackSubmitted: false,

            // 耗时
            tStart: null,   // 点击分析时间
            tFirstAt: null, // 首个有效 content 到达时间
            tEnd: null,     // 完成（或中断）时间

            // 流控制
            abortController: null,
            streamBuffer: '' // 用于累积 data:... 片段
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
                // 给一点“思考中”的时间感
                await new Promise(resolve => setTimeout(resolve, 300))
                this.isLoading = false
                await this.startStreamFromApi()
            } catch (e) {
                this.isLoading = false
                this.isStreaming = false
                this.abortController = null
                this.$message.error('调用大模型接口失败')
                console.error(e)
            }
        },

        resetState() {
            // 终止上一次请求
            if (this.abortController) {
                this.abortController.abort()
                this.abortController = null
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
        },

        // 🔴 核心：兼容三种返回格式的流式读取
        async startStreamFromApi() {
            this.isStreaming = true
            this.streamBuffer = ''

            const url = 'https://your-api-host/llm/stream' // TODO: 换成你的地址

            const body = {
                partnerCode: this.form.partnerCode,
                customerCode: this.form.customerCode || undefined
            }

            this.abortController = new AbortController()

            let res
            try {
                res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                        // Authorization: 'Bearer xxx'
                    },
                    body: JSON.stringify(body),
                    signal: this.abortController.signal
                })
            } catch (e) {
                if (e.name === 'AbortError') {
                    // 被 stopStream 主动中断，不提示错误
                    return
                }
                this.isStreaming = false
                this.abortController = null
                this.$message.error('网络或接口异常')
                console.error(e)
                return
            }

            if (!res.ok) {
                this.isStreaming = false
                this.abortController = null
                this.$message.error('接口返回错误状态：' + res.status)
                return
            }

            const reader = res.body && res.body.getReader ? res.body.getReader() : null

            // 🔁 情况 3：不支持流（一次性返回）
            if (!reader) {
                const text = await res.text()
                this.handleFullText(text)
                this.isStreaming = false
                this.abortController = null
                this.tEnd = Date.now()
                return
            }

            const decoder = new TextDecoder()
            let done = false

            while (!done) {
                const { value, done: readerDone } = await reader.read()
                done = readerDone

                if (value) {
                    const chunkText = decoder.decode(value, { stream: true })
                    // 🔴 无论是哪种情况，统统先加到 buffer 里
                    this.streamBuffer += chunkText
                    this.processStreamBuffer() // 尽可能多地解析出 data:{...}
                }
            }

            // 流结束时再处理一次 buffer，防止还有完整 JSON 没处理
            this.processStreamBuffer()

            this.isStreaming = false
            this.abortController = null
            this.tEnd = Date.now()
        },

        /**
         * 处理 this.streamBuffer，解析出尽可能多的完整 JSON
         * 兼容：
         * 1. data:{...}\n
         * 2. data:{...}data:{...}
         * 3. 首尾 JSON 不完整，等下个 chunk 补全
         */
        processStreamBuffer() {
            const buf = this.streamBuffer
            // 匹配所有 data:{...} 块，{...} 尽量非贪婪，直到下一个 data: 或结尾
            const regex = /data:\s*({.*?})(?=data:|$)/gs

            let match
            let processedUntil = 0 // 记录“已经安全处理完”的位置
            let firstChunkHandled = !!this.tFirstAt

            while ((match = regex.exec(buf)) !== null) {
                const jsonStr = match[1]

                try {
                    const json = JSON.parse(jsonStr)

                    // JSON 能解析，说明这个块是完整的，可以安全前进
                    processedUntil = regex.lastIndex

                    if (json.errorCode === 0 && json.result && json.result.content) {
                        const content = json.result.content

                        // 首个 token 时间
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
                    } else if (json.errorCode !== 0) {
                        console.warn('LLM errorCode != 0', json)
                    }
                } catch (err) {
                    // 解析失败，说明这个 { ... } 很可能被拆成两半了
                    // 不能丢，保持在 buffer 里，等下次 chunk 补全
                    console.warn('JSON 可能未完整，保留到下次继续：', jsonStr)
                    break
                }
            }

            // 把已经成功处理过的部分从 buffer 中剪掉，只保留最后的尾巴
            if (processedUntil > 0) {
                this.streamBuffer = buf.slice(processedUntil)
            }
        },

        /**
         * 情况 3：一次性返回完整文本（非流式）
         * 同样用 processStreamBuffer 的逻辑解析
         */
        handleFullText(text) {
            this.streamBuffer = text
            this.processStreamBuffer()

            // 简单兜底一下首包时间
            if (!this.tFirstAt && this.tStart && this.outputMarkdown) {
                this.tFirstAt = this.tStart
            }
        },

        // 中断回答
        stopStream() {
            if (this.abortController) {
                this.abortController.abort()
                this.abortController = null
            }
            if (this.isStreaming) {
                this.isStreaming = false
                this.tEnd = Date.now()
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

            // TODO: 换成真实反馈接口
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
        if (this.abortController) {
            this.abortController.abort()
            this.abortController = null
        }
    }
}
</script>
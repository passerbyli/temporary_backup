<template>
  <div class="llm-demo">
    <!-- 输入区域 -->
    <el-card shadow="never" class="input-card">
      <div slot="header" class="card-header">
        <span class="card-title">大模型分析 Demo</span>
      </div>

      <el-form :inline="true" :model="form" class="query-form">
        <el-form-item label="伙伴编码" required>
          <el-input
            v-model="form.partnerCode"
            placeholder="请输入伙伴编码"
            clearable
            style="width: 220px"
          />
        </el-form-item>

        <el-form-item label="客户编码">
          <el-input
            v-model="form.customerCode"
            placeholder="客户编码（可选）"
            clearable
            style="width: 220px"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="isLoading || isStreaming"
            :disabled="!canAnalyze"
            @click="handleAnalyze"
          >
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

          <el-button
            size="mini"
            type="text"
            icon="el-icon-document-copy"
            :disabled="!outputMarkdown"
            @click="copyResult"
          >
            复制
          </el-button>

          <!-- 中断回答按钮 -->
          <el-button
            v-if="isStreaming"
            size="mini"
            type="text"
            icon="el-icon-close"
            @click="stopStream"
          >
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
      <div
        class="output-shell"
        v-if="outputMarkdown || isStreaming"
      >
        <div
          class="output-scroll"
          ref="outputScroll"
        >
          <div class="markdown-body" v-html="renderedMarkdown"></div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="!isLoading && !isStreaming && !outputMarkdown"
        class="empty-state"
      >
        暂无内容，请填写伙伴编码后点击「分析」。
      </div>

      <!-- 点赞 / 点踩 -->
      <div
        v-if="!isLoading && !isStreaming && outputMarkdown"
        class="feedback-actions"
      >
        <el-button
          size="mini"
          :type="liked === true ? 'primary' : 'default'"
          :plain="liked !== true"
          :disabled="feedbackSubmitted"
          @click="handleLike"
        >
          👍 满意
        </el-button>
        <el-button
          size="mini"
          :type="liked === false ? 'danger' : 'default'"
          :plain="liked !== false"
          :disabled="feedbackSubmitted"
          @click="handleDislike"
        >
          👎 不满意
        </el-button>

        <span v-if="liked === true" class="feedback-hint">
          感谢你的反馈 🙌
        </span>
        <span v-if="feedbackSubmitted" class="feedback-hint">
          已提交反馈，无法再次评价。
        </span>
      </div>

      <!-- 反馈输入 -->
      <div v-if="showFeedbackBox" class="feedback-box">
        <el-input
          type="textarea"
          :rows="3"
          v-model="feedbackText"
          placeholder="请描述哪里不准确、不有用或有问题…"
        />
        <div class="feedback-btn-row">
          <el-button
            type="primary"
            size="mini"
            :disabled="!feedbackTextTrim || isSubmittingFeedback"
            @click="submitFeedback"
          >
            {{ isSubmittingFeedback ? '提交中…' : '提交反馈' }}
          </el-button>
          <el-button
            size="mini"
            :disabled="isSubmittingFeedback"
            @click="cancelFeedback"
          >
            取消
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
import marked from 'marked' // 1.x 版本

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
      streamBuffer: '' // 用于累计 data:{...} 片段
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
        // 给一点“思考中”的感觉
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

    // 🔴 兼容三种返回格式的流式读取
    async startStreamFromApi() {
      this.isStreaming = true
      this.streamBuffer = ''

      // TODO: 换成你的实际接口地址
      const url = 'https://your-api-host/llm/stream'

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
          // 被 stopStream 主动中断，不提示为错误
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

      // 情况 3：一次性返回（不支持流式）
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
          // 所有 chunk 都先堆积到 buffer
          this.streamBuffer += chunkText
          this.processStreamBuffer() // 尽可能多地解析出完整 data:{...}
        }
      }

      // 结束前再处理一次 buffer，防止还有残留的完整 JSON
      this.processStreamBuffer()

      this.isStreaming = false
      this.abortController = null
      this.tEnd = Date.now()
    },

    /**
     * 处理 this.streamBuffer，挖出尽可能多的完整 data:{...}
     * 兼容：
     * 1. 每次一个 data:{...}
     * 2. 每次多个 data:{...}data:{...}，且首尾可能不完整
     * 3. 一次性返回整段文本
     */
    processStreamBuffer() {
      let buf = this.streamBuffer
      let firstHandled = !!this.tFirstAt

      while (true) {
        const start = buf.indexOf('data:')
        if (start === -1) {
          // 没有 data: 了，说明前面都是无效内容，清空
          buf = ''
          break
        }

        const next = buf.indexOf('data:', start + 5)

        let jsonStr
        if (next === -1) {
          // 从 start 开始到末尾只有一个 data:，但可能是不完整 JSON
          // 把 data: 前面的扔掉，只保留 data: 开始的尾巴，等下次 chunk 拼上再解析
          buf = buf.slice(start)
          break
        } else {
          // 当前 data: 的 json 内容是 start+5 到 next 之间
          jsonStr = buf.slice(start + 5, next).trim()
        }

        if (!jsonStr) {
          // 空 data:，跳过
          buf = buf.slice(next)
          continue
        }

        try {
          const json = JSON.parse(jsonStr)

          // 能被 JSON.parse 说明这一段是完整的，安全前进到 next
          buf = buf.slice(next)

          if (json.errorCode === 0 && json.result && json.result.content) {
            const content = json.result.content

            // 首个 content 到达时间
            if (!firstHandled) {
              firstHandled = true
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
        } catch (e) {
          // 解析失败，说明这个 JSON 很可能被拆成前后两块
          // 把从当前 data: 开头到末尾保留，等待下一块补全
          console.warn('JSON 可能未完整，等待下一块补齐：', jsonStr)
          buf = buf.slice(start)
          break
        }
      }

      this.streamBuffer = buf
    },

    // 情况 3：一次性返回文本，复用同样的 buffer 解析逻辑
    handleFullText(text) {
      this.streamBuffer = text
      this.processStreamBuffer()

      if (!this.tFirstAt && this.tStart && this.outputMarkdown) {
        this.tFirstAt = this.tStart // 没法精确，只能认为首包≈开始时间
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
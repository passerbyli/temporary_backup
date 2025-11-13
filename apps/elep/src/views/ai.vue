<template>
  <div class="llm-demo">
    <!-- 输入区域 -->
    <div class="input-card">
      <h2>大模型分析 Demo</h2>
      <div class="input-row">
        <input
          v-model="inputText"
          class="query-input"
          type="text"
          placeholder="请输入要分析的问题，如：分析一下这个错误日志…"
          @keyup.enter="handleAnalyze"
        />
        <button
          class="primary-btn"
          :disabled="!inputText.trim() || isLoading || isStreaming"
          @click="handleAnalyze"
        >
          {{ isLoading || isStreaming ? '分析中…' : '分析' }}
        </button>
      </div>
      <p class="tip">点击“分析”后，将模拟大模型流式输出，可按需替换为真实接口。</p>
    </div>

    <!-- 输出区域 -->
    <div class="output-card">
      <!-- 加载动画 -->
      <div v-if="isLoading" class="loading-wrapper">
        <div class="spinner"></div>
        <span>思考中，请稍候…</span>
      </div>

      <!-- 流式输出 / 结果 -->
      <div v-if="outputMarkdown" class="output-wrapper">
        <div class="markdown-body" v-html="renderedMarkdown"></div>
      </div>

      <!-- 空状态 -->
      <div v-if="!isLoading && !outputMarkdown" class="empty-state">
        请输入内容并点击「分析」开始体验流式输出效果。
      </div>

      <!-- 点赞 / 点踩 -->
      <div
        v-if="!isLoading && !isStreaming && outputMarkdown"
        class="feedback-actions"
      >
        <button
          class="icon-btn"
          :class="{ active: liked === true }"
          @click="handleLike"
        >
          👍 满意
        </button>
        <button
          class="icon-btn"
          :class="{ active: liked === false }"
          @click="handleDislike"
        >
          👎 不满意
        </button>
        <span v-if="liked === true" class="feedback-hint">
          感谢你的反馈 🙌
        </span>
      </div>

      <!-- 反馈文本框（点踩时出现） -->
      <div
        v-if="showFeedbackBox"
        class="feedback-box"
      >
        <textarea
          v-model="feedbackText"
          class="feedback-textarea"
          placeholder="可以简单描述哪里不准确、不有用或有问题…"
        ></textarea>
        <div class="feedback-btn-row">
          <button
            class="primary-btn"
            :disabled="!feedbackText.trim() || isSubmittingFeedback"
            @click="submitFeedback"
          >
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

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { marked } from 'marked'

// 输入内容
const inputText = ref('')

// 状态
const isLoading = ref(false)          // “思考中”加载动画
const isStreaming = ref(false)        // 是否正在流式输出
const outputMarkdown = ref('')        // 当前已输出的 markdown
const liked = ref(null)               // true / false / null
const showFeedbackBox = ref(false)    // 是否展示反馈文本框
const feedbackText = ref('')          // 反馈内容
const isSubmittingFeedback = ref(false) // 提交反馈中状态

let streamTimer = null                // 模拟流式输出的定时器句柄

// markdown 渲染
const renderedMarkdown = computed(() => {
  // 这里可以配置 marked 选项，比如支持代码高亮等
  return marked.parse(outputMarkdown.value || '')
})

// 点击“分析”按钮
const handleAnalyze = () => {
  if (!inputText.value.trim() || isLoading.value || isStreaming.value) return

  resetStateForNewQuery()

  isLoading.value = true

  // 模拟：先 loading 一小段时间，然后开始流式输出
  setTimeout(() => {
    isLoading.value = false
    startFakeStream()
  }, 600)
}

// 重置状态（每次新分析之前）
const resetStateForNewQuery = () => {
  clearStreamTimer()
  isLoading.value = false
  isStreaming.value = false
  outputMarkdown.value = ''
  liked.value = null
  showFeedbackBox.value = false
  feedbackText.value = ''
  isSubmittingFeedback.value = false
}

// 模拟流式输出（这里你可以替换成真实的流式 API）
const startFakeStream = () => {
  isStreaming.value = true
  outputMarkdown.value = ''

  // 这里用几段 markdown 内容模拟“逐段返回”
  const chunks = [
    `## 分析结果概览\n\n你输入的问题是：\n\n> ${inputText.value}\n\n下面是根据问题给出的分析：\n\n`,
    `### 1. 可能的原因\n\n- 这是一个示例段落，用于演示 **Markdown** 渲染。\n- 在真实场景下，这里应该是大模型返回的内容。\n\n`,
    `### 2. 建议的排查步骤\n\n1. 检查输入是否完整、上下文是否充分。\n2. 如果涉及错误日志，建议提供 **关键堆栈信息**。\n3. 可以多次迭代提问，让模型逐步细化结论。\n\n`,
    `### 3. 示例代码\n\n\`\`\`js\nfunction demo() {\n  console.log('这里可以放一些示例代码');\n}\n\`\`\`\n\n`,
    `---\n\n如果你觉得这个回答不够有用，可以点击 👎 并填写反馈，帮助我们不断改进体验。`
  ]

  let index = 0
  streamTimer = setInterval(() => {
    if (index < chunks.length) {
      outputMarkdown.value += chunks[index]
      index++
    } else {
      clearStreamTimer()
      isStreaming.value = false
    }
  }, 500) // 每 500ms 输出一段，模拟流式
}

const clearStreamTimer = () => {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
}

// 点赞
const handleLike = () => {
  liked.value = true
  showFeedbackBox.value = false
}

// 点踩
const handleDislike = () => {
  liked.value = false
  showFeedbackBox.value = true
}

// 提交反馈
const submitFeedback = () => {
  if (!feedbackText.value.trim()) return
  isSubmittingFeedback.value = true

  // 这里可以替换成真实接口调用
  setTimeout(() => {
    console.log('反馈内容：', feedbackText.value)
    isSubmittingFeedback.value = false
    showFeedbackBox.value = false
    // 可以在这里给个 toast 或状态提示
    alert('感谢你的反馈，我们会尽快改进！')
  }, 600)
}

// 取消反馈
const cancelFeedback = () => {
  showFeedbackBox.value = false
  feedbackText.value = ''
  // 点踩状态可以根据需要保留或重置
  // liked.value = null
}

// 组件卸载时清理定时器
onBeforeUnmount(() => {
  clearStreamTimer()
})
</script>

<style scoped>
.llm-demo {
  max-width: 800px;
  margin: 40px auto;
  padding: 0 16px 40px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #222;
}

.input-card,
.output-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
  padding: 20px 24px;
  margin-bottom: 20px;
}

.input-card h2 {
  margin: 0 0 12px;
  font-size: 20px;
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: center;
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
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.15);
}

.primary-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: #1677ff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, opacity 0.15s;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.primary-btn:not(:disabled):hover {
  background: #145fcb;
}

.tip {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

.output-card {
  min-height: 160px;
}

.loading-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #555;
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

.output-wrapper {
  margin-top: 4px;
}

.empty-state {
  color: #999;
  font-size: 13px;
}

.feedback-actions {
  margin-top: 16px;
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
  color: #4caf50;
}

.feedback-box {
  margin-top: 12px;
}

.feedback-textarea {
  width: 100%;
  min-height: 80px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #d0d7de;
  font-size: 13px;
  resize: vertical;
  outline: none;
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

.ghost-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #d0d7de;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.ghost-btn:hover {
  background: #f6f8fa;
}

/* 简单 markdown 渲染样式 */
.markdown-body {
  font-size: 14px;
  line-height: 1.6;
}

.markdown-body h2 {
  font-size: 18px;
  margin: 12px 0 6px;
}

.markdown-body h3 {
  font-size: 16px;
  margin: 10px 0 4px;
}

.markdown-body p {
  margin: 6px 0;
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
}

.markdown-body pre code {
  background: transparent;
  padding: 0;
}
</style>
processStreamBuffer() {
  let buf = this.streamBuffer
  let firstHandled = !!this.tFirstAt

  while (true) {
    // 找下一个 "data:"
    const start = buf.indexOf('data:')
    if (start === -1) {
      // 没有 data: 说明 buffer 前面都是垃圾，清空
      buf = ''
      break
    }

    // 找下一个 data: 的位置
    const next = buf.indexOf('data:', start + 5)

    let jsonStr
    if (next === -1) {
      // 后面没有 data: 了，说明剩下这一段可能是 “不完整 JSON”
      // 只保留从 start 开始的尾巴，等待下一块补全
      buf = buf.slice(start)
      break
    } else {
      // 取当前 data: 的 JSON 字符串（可能有换行也可能没有）
      jsonStr = buf.slice(start + 5, next).trim()
    }

    if (!jsonStr) {
      // 空 data:（可能多个 data: 紧邻）跳过
      buf = buf.slice(next)
      continue
    }

    // 尝试解析 JSON
    try {
      const json = JSON.parse(jsonStr)

      // 成功 → 表示 JSON 是完整的
      buf = buf.slice(next) // 删除这个片段，继续处理后面的 data:

      if (json.errorCode === 0 && json.result && json.result.content) {
        const content = json.result.content

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
      }
    } catch (err) {
      // JSON 被拆开（跨 chunk），无法解析
      // 保留从当前 data: 开始的所有内容，等待下一次 stream 填充
      buf = buf.slice(start)
      break
    }
  }

  this.streamBuffer = buf
}
// common/cronJob.ts
import { CronJob as NodeCronJob } from 'cron'
import validator from 'validator'

type CallbackFn = () => void

export class CronJob {
  private name: string
  private cronExpr: string
  private _job: NodeCronJob | null
  private _callback: CallbackFn

  constructor(name = 'DefaultJob') {
    this.name = name
    this.cronExpr = '0 * * * * *' // 默认每分钟执行一次
    this._job = null
    this._callback = () => {
      console.log(`[${this.name}] 默认任务执行`)
    }
  }

  public setCallback(fn: CallbackFn): void {
    if (typeof fn === 'function') {
      this._callback = fn
    } else {
      throw new Error('Callback 必须是函数')
    }
  }

  public setExpression(expr: string): void {
    if (typeof expr !== 'string' || !validator.isLength(expr, { min: 9 })) {
      throw new Error('无效的 cron 表达式')
    }

    const cronRegex = /^(\*|([0-9,-\/]+))(\s+(\*|([0-9,-\/]+))){4,5}$/
    if (!cronRegex.test(expr.trim())) {
      console.warn(`[${this.name}] 警告：cron 表达式格式可能不正确，请检查 -> ${expr}`)
    }

    this.cronExpr = expr.trim()
  }

  public start(): void {
    if (this._job) {
      this._job.stop()
    }

    try {
      this._job = new NodeCronJob(
        this.cronExpr,
        () => {
          const now = new Date().toISOString()
          console.log(`[${this.name}] 执行任务 at ${now}`)
          try {
            this._callback()
          } catch (err) {
            console.error(`[${this.name}] 执行回调时出错：`, err)
          }
        },
        null,
        true // 立即启动
      )
      console.log(`[${this.name}] 启动定时任务：${this.cronExpr}`)
    } catch (error: any) {
      console.error(`[${this.name}] 启动失败：`, error.message)
    }
  }

  public stop(): void {
    if (this._job) {
      this._job.stop()
      this._job = null
      console.log(`[${this.name}] 定时任务已停止`)
    }
  }
}

if (require.main === module) {
  const job = new CronJob('MyJob')
  // 0 0 9-18 0 0 1-6
  job.setExpression('0/5 * * * * *') // 每5秒执行
  job.setCallback(() => {
    console.log('定时任务触发', new Date().toLocaleTimeString())
  })
  job.start()

  // 例如 10 秒后手动停止
  setTimeout(() => {
    job.stop()
  }, 1000)
}

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let initialized = false;
let loggerInstance = null;

// 自定义日志类
class RollingLogger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 默认 5MB
    this.logsDir = options.logsDir || path.join(app.getPath('userData'), 'logs');
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
    this.currentLevelValue = this.levels[this.level] || 1;

    // 确保日志目录存在
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // 初始化当前日志文件
    this.currentLogFile = this.getLogFilePath();
    this.logBuffer = [];
    this.flushInterval = setInterval(() => this.flush(), 1000);
  }

  /**
   * 根据当前时间获取基础日志文件路径
   * 格式: logs/main-YYYY-MM-DD.log
   */
  getBaseLogFilePath(timestamp = Date.now()) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return path.join(this.logsDir, `main-${dateStr}.log`);
  }

  /**
   * 获取当前可写的日志文件路径
   * 如果主文件已存在且超大小，返回 main-2026-01-16.1.log 等
   */
  getLogFilePath() {
    const baseFile = this.getBaseLogFilePath();
    const baseDir = path.dirname(baseFile);
    const baseName = path.basename(baseFile, '.log');
    
    // 如果基础文件不存在或大小未超限，直接使用
    if (!fs.existsSync(baseFile) || this.getFileSize(baseFile) < this.maxFileSize) {
      return baseFile;
    }

    // 基础文件已存在且超大小，查找可用的编号文件
    let counter = 1;
    while (true) {
      const numberedFile = path.join(baseDir, `${baseName}.${counter}.log`);
      if (!fs.existsSync(numberedFile) || this.getFileSize(numberedFile) < this.maxFileSize) {
        return numberedFile;
      }
      counter++;
    }
  }

  /**
   * 格式化日志信息
   */
  formatMessage(level, message, meta = {}) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');

    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  /**
   * 获取文件大小
   */
  getFileSize(filePath) {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  }

  /**
   * 写入日志
   */
  log(level, message, meta = {}) {
    const levelValue = this.levels[level] || 1;
    if (levelValue < this.currentLevelValue) return;

    const formattedMessage = this.formatMessage(level, message, meta);
    this.logBuffer.push(formattedMessage);

    // 实时输出到控制台
    if (levelValue >= 2) {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  /**
   * 刷新缓冲区，写入文件
   */
  flush() {
    if (this.logBuffer.length === 0) return;

    try {
      // 获取当前应该写入的文件
      const currentFile = this.getLogFilePath();
      
      // 如果文件路径改变（由于超大小），更新当前文件引用
      if (currentFile !== this.currentLogFile) {
        this.currentLogFile = currentFile;
      }

      // 将缓冲区内容写入文件
      const content = this.logBuffer.join('\n') + '\n';
      fs.appendFileSync(this.currentLogFile, content, 'utf8');
      this.logBuffer = [];
    } catch (err) {
      console.error('Failed to flush logs:', err);
    }
  }

  /**
   * 便利方法
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  /**
   * 清理资源
   */
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

function initLogger(options = {}) {
  if (initialized) return loggerInstance;
  initialized = true;

  loggerInstance = new RollingLogger(options);
  loggerInstance.info('===== logger initialized =====');
  loggerInstance.info(`日志目录: ${loggerInstance.logsDir}`);
  loggerInstance.info(`最大文件大小: ${(loggerInstance.maxFileSize / (1024 * 1024)).toFixed(2)} MB`);

  return loggerInstance;
}

module.exports = {
  initLogger,
  get log() {
    return loggerInstance || initLogger();
  },
};

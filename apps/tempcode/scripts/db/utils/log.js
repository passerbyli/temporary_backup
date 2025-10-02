/**
 * 默认日志钩子
 */
function defaultLogHook(type, message) {
  const time = new Date().toISOString();
  console.log(`[${time}][${type.toUpperCase()}]`, message);
}

module.exports = {
  defaultLogHook,
};

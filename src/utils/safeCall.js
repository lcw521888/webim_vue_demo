/**
 * 在 SDK / 路由 / Vuex 等回调里执行同步逻辑，避免未捕获异常导致整页白屏或不可操作。
 */
export function safeSync(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`[safeSync:${label}]`, err);
  }
}

/**
 * 异步逻辑统一兜底，仅打日志，不向调用方冒泡未处理拒绝（由调用处决定是否还需要 reject）。
 */
export function safeAsync(label, promise) {
  if (!promise || typeof promise.then !== 'function') {
    return Promise.resolve();
  }
  return promise.catch((err) => {
    console.error(`[safeAsync:${label}]`, err);
  });
}

/**
 * 包装 IM addEventHandler 的 handler 对象：每个回调单独 try/catch，避免一条坏数据拖垮整页。
 */
export function wrapImEventHandler(handler) {
  if (!handler || typeof handler !== 'object') return handler;
  const wrapped = {};
  for (const key of Object.keys(handler)) {
    const fn = handler[key];
    if (typeof fn !== 'function') {
      wrapped[key] = fn;
      continue;
    }
    wrapped[key] = (...args) => {
      safeSync(`IMEvent.${key}`, () => fn(...args));
    };
  }
  return wrapped;
}

// 全局错误处理：用于捕获和调试所有TypeError错误

import {
  isImAuthFailedReason,
  redirectToLoginClearImSession,
} from './imAuthRedirect';
import { notifyRuntimeError } from './runtimeErrorNotifier';

/** 环信 miniCore 等对 undefined/null 取字段时的典型报错（Chrome / Firefox 文案略有差异） */
function isNullishPropertyTypeErrorText(text) {
  if (!text || typeof text !== 'string') return false;
  return (
    text.includes('Cannot read properties of undefined') ||
    text.includes('Cannot read properties of null') ||
    text.includes("Cannot read property '") ||
    text.includes('Cannot read property `')
  );
}

function isEasemobSdkStack(errorOrStack) {
  const s =
    typeof errorOrStack === 'string'
      ? errorOrStack
      : errorOrStack?.stack || '';
  return typeof s === 'string' && s.includes('easemob-websdk');
}

function isResizeObserverNoise(text) {
  if (!text || typeof text !== 'string') return false;
  return (
    text.includes('ResizeObserver loop completed with undelivered notifications') ||
    text.includes('ResizeObserver loop limit exceeded')
  );
}

// 捕获阶段优先于 webpack-dev-server overlay 的冒泡监听，避免全屏 ERROR
window.addEventListener(
  'error',
  function (event) {
    const err = event.error;
    const msg =
      (err && err.message) ||
      (typeof event.message === 'string' ? event.message : '');
    const fromStack = isEasemobSdkStack(err);
    const fromFilename =
      typeof event.filename === 'string' &&
      event.filename.includes('easemob-websdk');
    if (isResizeObserverNoise(msg)) {
      console.warn(
        '[Global Error] 已拦截 ResizeObserver 开发态噪音（仅控制台输出，不阻断页面）:',
        err || msg,
      );
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }
    if ((fromStack || fromFilename) && isNullishPropertyTypeErrorText(msg)) {
      console.error(
        '[IM SDK] 捕获到空引用异常:',
        err || msg,
      );
      if (err?.stack) console.error(err.stack);
      notifyRuntimeError(err || msg);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  },
  true,
);

// 保存原始的错误处理程序
const originalOnError = window.onerror;

// 设置新的全局错误处理程序
window.onerror = function (message, source, lineno, colno, error) {
  const isSDKError =
    (source && String(source).includes('easemob-websdk')) ||
    isEasemobSdkStack(error);
  const msgStr =
    typeof message === 'string' ? message : String(message ?? '');
  const isTypeError = isNullishPropertyTypeErrorText(msgStr);

  if (isSDKError && isTypeError) {
    console.error('\n=== 全局捕获到SDK内部TypeError错误 ===');
    console.error('错误信息:', message);
    console.error('错误源:', source);
    console.error('行号:', lineno);
    console.error('列号:', colno);
    console.error('错误对象:', error);

    if (error && error.stack) {
      console.error('完整错误栈:', error.stack);

      // 尝试解析调用栈，找出应用代码中的调用点
      const stackLines = error.stack.split('\n');
      const appCallStack = stackLines.filter(
        (line) =>
          line.includes('src/') || line.includes('webpack-internal:///./src/'),
      );

      if (appCallStack.length > 0) {
        console.error('应用代码调用栈:');
        appCallStack.forEach((line) => console.error(line));
      }
    }

    console.error('=========================\n');

    notifyRuntimeError(error || message);
    return true;
  }

  // 如果有原始的错误处理程序，调用它
  if (originalOnError) {
    return originalOnError(message, source, lineno, colno, error);
  }

  // 允许默认的错误处理继续
  return false;
};

// Promise 未处理拒绝：必须在捕获阶段处理并 stopImmediatePropagation，
// 否则 webpack-dev-server 的 overlay（冒泡监听）会先执行，把非 Error 的 reason 变成 Error('[object Object]') 全屏遮挡。
window.addEventListener(
  'unhandledrejection',
  function (event) {
    const reason = event.reason;

    if (reason && typeof reason === 'object' && !(reason instanceof Error)) {
      if (isImAuthFailedReason(reason)) {
        console.warn(
          '[IM] WebSocket 鉴权失败（type=2 / Auth failed）：已清除本地登录缓存并返回登录页；请核对 AppKey、REST、wss 是否同一应用。',
          reason,
        );
        redirectToLoginClearImSession();
      } else {
        try {
          console.warn(
            '[unhandledrejection] 非 Error 对象:',
            JSON.stringify(reason),
            reason,
          );
        } catch {
          console.warn('[unhandledrejection] 非 Error 对象:', reason);
        }
      }
      notifyRuntimeError(reason);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    if (reason instanceof Error && isImAuthFailedReason(reason)) {
      console.warn(
        '[IM] 鉴权失败，已清除本地登录缓存并返回登录页。',
        reason,
      );
      redirectToLoginClearImSession();
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    if (reason instanceof Error && String(reason.message) === '[object Object]') {
      console.warn(
        '[unhandledrejection] 捕获到 Error（message 为 [object Object]），详情见控制台:',
        reason,
      );
      notifyRuntimeError(reason);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    const isNetworkError =
      reason &&
      (reason.message?.includes('Network Error') ||
        reason.message?.includes('network error') ||
        reason.message?.includes('timeout') ||
        reason.message?.includes('Connection refused') ||
        reason.message?.includes('Failed to fetch') ||
        reason.code === 'ECONNABORTED');

    if (isNetworkError) {
      console.error(
        '[unhandledrejection] 网络类错误:',
        reason,
      );
      notifyRuntimeError(reason);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    const isSDKError = reason && isEasemobSdkStack(reason);
    const isTypeError =
      reason &&
      reason.message &&
      isNullishPropertyTypeErrorText(reason.message);

    if (isSDKError && isTypeError) {
      console.error(
        '\n=== 全局捕获到 SDK 空引用 TypeError ===',
      );
      console.error('错误原因:', reason);

      if (
        typeof reason === 'object' &&
        reason !== null &&
        !(reason instanceof Error)
      ) {
        console.error('错误对象内容:', JSON.stringify(reason, null, 2));
      }

      if (reason.stack) {
        console.error('完整错误栈:', reason.stack);

        const stackLines = reason.stack.split('\n');
        const appCallStack = stackLines.filter(
          (line) =>
            line.includes('src/') ||
            line.includes('webpack-internal:///./src/'),
        );

        if (appCallStack.length > 0) {
          console.error('应用代码调用栈:');
          appCallStack.forEach((line) => console.error(line));
        }
      }

      console.error('=========================\n');
      notifyRuntimeError(reason);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  },
  true,
);

export default window.onerror;

// 全局错误处理：用于捕获和调试所有TypeError错误

// 保存原始的错误处理程序
const originalOnError = window.onerror;

// 设置新的全局错误处理程序
window.onerror = function (message, source, lineno, colno, error) {
  // 检查是否是SDK内部的TypeError错误
  const isSDKError = source && source.includes('easemob-websdk');
  const isTypeError =
    message &&
    (message.includes('Cannot read properties of undefined') ||
      message.includes('Cannot read property'));

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

    // 阻止默认的错误处理，防止应用崩溃
    return true;
  }

  // 如果有原始的错误处理程序，调用它
  if (originalOnError) {
    return originalOnError(message, source, lineno, colno, error);
  }

  // 允许默认的错误处理继续
  return false;
};

// 设置Promise错误处理
window.addEventListener('unhandledrejection', function (event) {
  const reason = event.reason;

  // 检查是否是断网导致的页面显示错误
  const isNetworkError = reason && (
    reason.message?.includes('Network Error') || 
    reason.message?.includes('network error') || 
    reason.message?.includes('timeout') || 
    reason.message?.includes('Connection refused') || 
    reason.message?.includes('Failed to fetch') ||
    reason.code === 'ECONNABORTED'
  );

  // 处理断网导致的页面显示错误
  if (isNetworkError) {
    console.log('全局捕获到断网导致的页面显示错误，跳转到登录页面');
    const loginUser = localStorage.getItem('EASEIM_loginUser');
    if (loginUser) {
      // 清除本地存储的登录信息
      localStorage.removeItem('EASEIM_loginUser');
      // 跳转到登录页面
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    }
    // 阻止Promise拒绝事件冒泡，防止应用崩溃
    event.preventDefault();
    return;
  }

  // 检查是否是SDK内部的TypeError错误
  const isSDKError =
    reason && reason.stack && reason.stack.includes('easemob-websdk');
  const isTypeError =
    reason &&
    reason.message &&
    (reason.message.includes('Cannot read properties of undefined') ||
      reason.message.includes('Cannot read property'));

  // 增强错误处理，确保错误信息能够正确显示
  if (isSDKError && isTypeError) {
    console.error('\n=== 全局捕获到SDK内部TypeError错误 ===');
    console.error('错误原因:', reason);

    // 检查reason是否是对象但不是Error实例
    if (typeof reason === 'object' && reason !== null && !(reason instanceof Error)) {
      console.error('错误对象内容:', JSON.stringify(reason, null, 2));
    }

    if (reason.stack) {
      console.error('完整错误栈:', reason.stack);

      // 尝试解析调用栈，找出应用代码中的调用点
      const stackLines = reason.stack.split('\n');
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

    // 阻止Promise拒绝事件冒泡，防止应用崩溃
    event.preventDefault();
  }
});

export default window.onerror;

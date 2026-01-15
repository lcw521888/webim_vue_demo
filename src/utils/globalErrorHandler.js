// 全局错误处理：用于捕获和调试所有TypeError错误

// 保存原始的错误处理程序
const originalOnError = window.onerror;

// 设置新的全局错误处理程序
window.onerror = function(message, source, lineno, colno, error) {
  // 检查是否是SDK内部的TypeError错误
  const isSDKError = source && source.includes('easemob-websdk');
  const isTypeError = message && (message.includes('Cannot read properties of undefined') || message.includes('Cannot read property'));
  
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
      const appCallStack = stackLines.filter(line => 
        line.includes('src/') || line.includes('webpack-internal:///./src/')
      );
      
      if (appCallStack.length > 0) {
        console.error('应用代码调用栈:');
        appCallStack.forEach(line => console.error(line));
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
window.addEventListener('unhandledrejection', function(event) {
  const reason = event.reason;
  
  // 检查是否是SDK内部的TypeError错误
  const isSDKError = reason && reason.stack && reason.stack.includes('easemob-websdk');
  const isTypeError = reason && reason.message && (reason.message.includes('Cannot read properties of undefined') || reason.message.includes('Cannot read property'));
  
  if (isSDKError && isTypeError) {
    console.error('\n=== 全局捕获到SDK内部Promise TypeError错误 ===');
    console.error('错误原因:', reason);
    
    if (reason.stack) {
      console.error('完整错误栈:', reason.stack);
      
      // 尝试解析调用栈，找出应用代码中的调用点
      const stackLines = reason.stack.split('\n');
      const appCallStack = stackLines.filter(line => 
        line.includes('src/') || line.includes('webpack-internal:///./src/')
      );
      
      if (appCallStack.length > 0) {
        console.error('应用代码调用栈:');
        appCallStack.forEach(line => console.error(line));
      }
    }
    
    console.error('=========================\n');
    
    // 阻止Promise拒绝事件冒泡，防止应用崩溃
    event.preventDefault();
  }
});

export default window.onerror;

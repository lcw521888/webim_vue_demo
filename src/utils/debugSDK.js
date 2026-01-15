// 调试工具：用于追踪和调试EMClient的方法调用

// 保存原始的console.log方法，以便我们可以在调试时使用它
const originalLog = console.log;
const originalError = console.error;

// 增强的日志方法
console.log = function(...args) {
  // 只记录与EMClient相关的日志
  if (args.some(arg => 
    (typeof arg === 'string' && (arg.includes('EMClient') || arg.includes('EM_MSG'))) ||
    (typeof arg === 'object' && arg && (arg.__proto__ && arg.__proto__.constructor && arg.__proto__.constructor.name.includes('EM')))
  )) {
    const stack = new Error().stack;
    const callStack = stack.split('\n').slice(2, 5).join('\n');
    originalLog('\n=== EMClient 调试日志 ===');
    originalLog(...args);
    originalLog('调用栈:', callStack);
    originalLog('========================\n');
  } else {
    // 对于其他日志，保持原样
    originalLog(...args);
  }
};

// 增强的错误方法
console.error = function(...args) {
  const stack = new Error().stack;
  const callStack = stack.split('\n').slice(2, 10).join('\n');
  originalError('\n=== EMClient 错误日志 ===');
  originalError(...args);
  originalError('完整调用栈:', callStack);
  originalError('=========================\n');
};

// 导出调试函数
export const enableEMClientDebug = () => {
  console.log('EMClient调试已启用');
};

export const disableEMClientDebug = () => {
  console.log = originalLog;
  console.error = originalError;
  console.log('EMClient调试已禁用');
};

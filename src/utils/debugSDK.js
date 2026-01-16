// 调试工具：用于追踪和调试EMClient的方法调用

// 保存原始的console.log方法，以便我们可以在调试时使用它
const originalLog = console.log;
const originalError = console.error;

// 增强的日志方法
console.log = function (...args) {
  // 只记录与EMClient相关的日志
  if (
    args.some(
      (arg) =>
        (typeof arg === 'string' &&
          (arg.includes('EMClient') || arg.includes('EM_MSG'))) ||
        (typeof arg === 'object' &&
          arg &&
          arg.__proto__ &&
          arg.__proto__.constructor &&
          arg.__proto__.constructor.name.includes('EM')),
    )
  ) {
    const stack = new Error().stack;
    const callStack = stack.split('\n').slice(2, 5).join('\n');
    originalLog(...args);
    originalLog('调用栈:', callStack);
  } else {
    // 对于其他日志，保持原样
    originalLog(...args);
  }
};

// 增强的错误方法
// 使用标志位防止递归调用
let isHandlingError = false;

console.error = function (...args) {
  // 如果已经在处理错误，直接使用原始方法
  if (isHandlingError) {
    originalError(...args);
    return;
  }
  
  // 设置标志位
  isHandlingError = true;
  
  try {
    const stack = new Error().stack;
    const callStack = stack.split('\n').slice(2, 10).join('\n');
    originalError('\n=== EMClient 错误日志 ===');
    originalError(...args);
    originalError('完整调用栈:', callStack);
    originalError('=========================\n');
  } finally {
    // 确保无论如何都会重置标志位
    isHandlingError = false;
  }
};

// 导出调试函数
export const enableEMClientDebug = () => {
  console.log('EMClient调试已启用');
};

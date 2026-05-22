// 调试工具：用于追踪和调试 EMClient 的错误日志。
const originalError = console.error;

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
    // 只记录与EMClient相关的错误
    const isEMClientError = args.some(arg => {
      if (typeof arg === 'string') {
        return arg.includes('EMClient') || arg.includes('easemob');
      }
      if (typeof arg === 'object' && arg !== null) {
        return arg.__proto__ && 
               arg.__proto__.constructor && 
               arg.__proto__.constructor.name.includes('EM');
      }
      return false;
    });
    
    if (isEMClientError) {
      const stack = new Error().stack;
      const callStack = stack.split('\n').slice(2, 10).join('\n');
      originalError('\n=== EMClient 错误日志 ===');
      // 确保所有错误对象都被正确地转换为字符串
      const processedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return arg;
      });
      try {
        originalError(...processedArgs);
        originalError('完整调用栈:', callStack);
        originalError('=========================\n');
      } catch (e) {
        // 防止 originalError 调用本身出错
        console.log('调用 originalError 时出错:', e);
      }
    } else {
      // 对于其他错误，也确保错误对象被正确地转换为字符串
      const processedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return arg;
      });
      try {
        originalError(...processedArgs);
      } catch (e) {
        // 防止 originalError 调用本身出错
        console.log('调用 originalError 时出错:', e);
      }
    }
  } finally {
    // 确保无论如何都会重置标志位
    isHandlingError = false;
  }
};

// 导出调试函数
export const enableEMClientDebug = () => {
  console.log('EMClient调试已启用');
};

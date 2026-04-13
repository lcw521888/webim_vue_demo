const { defineConfig } = require('@vue/cli-service');
module.exports = defineConfig({
  productionSourceMap: false,
  transpileDependencies: true,
  lintOnSave: false,
  devServer: {
    host: 'localhost',
    port: 9001,
    // https:true
    client: {
      overlay: {
        errors: true,
        warnings: false,
        // 避免 SDK 等抛出非 Error / 不可序列化对象时，覆盖层只显示「[object Object]」且无上下文
        // webpack-dev-server 对非 Error 的 rejection 会 new Error(reason)，message 变成字面量「[object Object]」
        runtimeErrors: (error) => {
          try {
            const msg =
              error && typeof error.message === 'string'
                ? error.message.trim()
                : String(error?.message ?? error ?? '').trim();
            const stack = String(error?.stack || '');
            // webpack-dev-server 对非 Error 的 rejection 会 new Error(reason)，message 常为字面量「[object Object]」
            if (
              msg === '[object Object]' ||
              (msg.includes('[object Object]') &&
                (stack.includes('overlay.js') ||
                  stack.includes('runtime-error.js')))
            ) {
              console.warn(
                '[devServer overlay] 已抑制无意义的运行时覆盖层，详情见控制台:',
                error,
              );
              return false;
            }
            // 环信 SDK 对 null/undefined 取属性：只打控制台，不全屏遮挡
            if (
              stack.includes('easemob-websdk') &&
              (msg.includes('Cannot read properties of undefined') ||
                msg.includes('Cannot read properties of null') ||
                msg.includes("Cannot read property"))
            ) {
              console.warn(
                '[devServer overlay] 已抑制环信 SDK 空引用异常，详情见控制台:',
                error,
              );
              return false;
            }
          } catch (_) {
            /* 过滤器自身异常时不影响默认展示 */
          }
          return true;
        },
      },
    },
  },
  chainWebpack: (config) => {
    //最小化代码
    config.optimization.minimize(true);
    //分割代码
    config.optimization.splitChunks({
      chunks: 'all',
    });
  },
});

// 必须最先执行：在拉取 IM / easemob 之前注册 error 与 unhandledrejection 捕获
import './utils/globalErrorHandler';

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import { EMClient } from './IM';
import { CHANGE_MESSAGE_BODAY_TYPE } from './constant';

import ElementPlus from 'element-plus';
import './styles/element/index.scss';
import zhCn from 'element-plus/es/locale/lang/zh-cn';

const app = createApp(App)
  .use(store)
  .use(router)
  .use(ElementPlus, { locale: zhCn });

app.config.errorHandler = (err, instance, info) => {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : err && typeof err === 'object'
          ? JSON.stringify(err)
          : String(err);
  console.error('[Vue errorHandler]', message, '\ninfo:', info, '\nraw:', err);
};

// 监听自定义消息撤回事件
window.addEventListener('hx:messageRecall', (event) => {
  const msg = event.detail;
  if (msg == null || typeof msg !== 'object') {
    console.error('[hx:messageRecall] 无效的 event.detail，已忽略', msg);
    return;
  }
  try {
    store.commit('Message/CHANGE_MESSAGE_BODAY', {
      type: CHANGE_MESSAGE_BODAY_TYPE.RECALL,
      key: msg.to,
      mid: msg.id,
    });
  } catch (error) {
    console.error('[Vue App] hx:messageRecall 更新本地状态失败:', error);
  }
});

// 全局 error：只记录日志，不强制整页跳转（避免一般异常导致应用不可用）
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error || event.message, event);
  if (
    event.error &&
    event.error.message &&
    event.error.message.includes('pullCount')
  ) {
    console.error(
      '[Global Error] pullCount 相关异常，请视情况清除 EASEIM_loginUser 后重新登录；未自动跳转以免打断当前页面。',
    );
  }
});

app.mount('#app');

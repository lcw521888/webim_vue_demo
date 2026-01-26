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

// 监听自定义消息撤回事件
window.addEventListener('hx:messageRecall', (event) => {
  const msg = event.detail;
  
  // Update local message status to recalled
  try {
    store.commit('Message/CHANGE_MESSAGE_BODAY', {
      type: CHANGE_MESSAGE_BODAY_TYPE.RECALL,
      key: msg.to,
      mid: msg.id
    });
  } catch (error) {
    console.error('[Vue App] Failed to update local message status:', error);
  }
});

// 添加全局错误处理，捕获并处理 SDK 内部错误，如 "Cannot read properties of undefined (reading 'pullCount')"
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error);
  
  // 处理 pullCount 相关的错误
  if (event.error && event.error.message && event.error.message.includes('pullCount')) {
    console.error('[Global Error] 检测到 pullCount 相关错误，需要清除本地存储并重新登录');
    
    // 清除本地存储的登录信息
    localStorage.removeItem('EASEIM_loginUser');
    
    // 跳转到登录页面
    window.location.href = '/login';
  }
});

app.mount('#app');

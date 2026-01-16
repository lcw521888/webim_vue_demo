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

app.mount('#app');

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import { EMClient } from './IM';

import ElementPlus from 'element-plus';
import './styles/element/index.scss';
import zhCn from 'element-plus/es/locale/lang/zh-cn';

const app = createApp(App)
  .use(store)
  .use(router)
  .use(ElementPlus, { locale: zhCn });

// 添加消息撤回监听
EMClient.addEventHandler('messageRecall', {
  onRecallMessage: (msg) => {
    console.log('收到消息撤回通知:', msg);
    // 更新本地消息状态为撤回
    store.commit('Message/CHANGE_MESSAGE_BODAY', {
      type: 'recall',
      key: msg.to,
      mid: msg.id
    });
  }
});

app.mount('#app');

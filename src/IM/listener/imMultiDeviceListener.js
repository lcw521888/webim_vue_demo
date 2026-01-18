import { EMClient } from '../index';
import store from '@/store';

export const imMultiDeviceListener = () => {
  const onDispatchMultiDeviceEvent = (event) => {
    const { eventType, payload } = event;
    console.log('多设备事件：', eventType, payload);
    
    switch (eventType) {
      // 会话置顶事件
      case 'pinnedConversation':
        {
          console.log('收到多设备会话置顶事件', payload);
          // 触发更新会话置顶状态的action
          store.dispatch('getServerPinnedConversations');
        }
        break;
      // 取消会话置顶事件
      case 'unpinnedConversation':
        {
          console.log('收到多设备取消会话置顶事件', payload);
          // 触发更新会话置顶状态的action
          store.dispatch('getServerPinnedConversations');
        }
        break;
      default:
        console.log('未处理的多设备事件：', eventType);
        break;
    }
  };

  const mountMultiDeviceEventListener = () => {
    EMClient.addEventHandler('multiDeviceEvent', {
      onMultiDeviceEvent: (event) => {
        console.log('onMultiDeviceEvent:', event);
        onDispatchMultiDeviceEvent(event);
      },
    });
  };

  return {
    mountMultiDeviceEventListener,
  };
};

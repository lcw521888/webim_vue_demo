import { EMClient } from '../index';
import store from '@/store';
import { wrapImEventHandler } from '@/utils/safeCall';

export const imMultiDeviceListener = () => {
  const onDispatchMultiDeviceEvent = (event) => {
    if (!event || typeof event !== 'object') {
      console.warn('[onDispatchMultiDeviceEvent] 无效 event', event);
      return;
    }
    const { eventType, payload } = event;
    console.log('多设备事件：', eventType, payload);

    switch (eventType) {
      // 会话置顶事件
      case 'pinnedConversation':
        {
          console.log('收到多设备会话置顶事件', payload);
          Promise.resolve(
            store.dispatch('getServerPinnedConversations'),
          ).catch((err) =>
            console.error('[multiDevice pinnedConversation]', err),
          );
        }
        break;
      // 取消会话置顶事件
      case 'unpinnedConversation':
        {
          console.log('收到多设备取消会话置顶事件', payload);
          Promise.resolve(
            store.dispatch('getServerPinnedConversations'),
          ).catch((err) =>
            console.error('[multiDevice unpinnedConversation]', err),
          );
        }
        break;
      default:
        console.log('未处理的多设备事件：', eventType);
        break;
    }
  };

  const mountMultiDeviceEventListener = () => {
    EMClient.addEventHandler(
      'multiDeviceEvent',
      wrapImEventHandler({
      onMultiDeviceEvent: (event) => {
        console.log('onMultiDeviceEvent:', event);
        onDispatchMultiDeviceEvent(event);
      },
    }),
    );
  };

  return {
    mountMultiDeviceEventListener,
  };
};

import { EMClient } from '../index';
import store from '@/store';
export const imPresenceListener = () => {
  //处理登陆用户状态的变更
  const getUserPresence = (status) => {
    console.log('【DEBUG】收到在线状态变更:', status);
    store.dispatch('handlePresenceChanges', status);
  };
  const mountPresenceEventListener = () => {
    EMClient.addEventHandler('presenceStatusChange', {
      onPresenceStatusChange: (status) => {
        console.log('【DEBUG】onPresenceStatusChange 回调:', status);
        // 检查 status 是否是数组
        if (Array.isArray(status)) {
          // 如果是数组，遍历数组中的每个状态对象
          status.forEach(item => {
            getUserPresence(item);
          });
        } else {
          // 如果不是数组，直接传递
          getUserPresence(status);
        }
      },
    });
  };
  return {
    mountPresenceEventListener,
  };
};

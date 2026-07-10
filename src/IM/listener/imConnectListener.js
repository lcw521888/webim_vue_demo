import router from '@/router';
import store from '@/store';
import { handleSDKErrorNotifi } from '@/utils/handleSomeData';
import { EMClient } from '../index';
import { usePlayRing } from '@/hooks';
import { safeSync } from '@/utils/safeCall';

export const imConnectListener = () => {
  const mountConnectEventListener = () => {
    const { isOpenPlayRing, clickRing } = usePlayRing();
    EMClient.addEventHandler('connection', {
      onConnected: () => {
        safeSync('connection.onConnected', () => {
          store.commit('CHANGE_LOGIN_STATUS', true);
          if (isOpenPlayRing.value) clickRing();
          fetchLoginUsersInitData();
          const currentPath = window.location.pathname || '';
          if (currentPath === '/' || currentPath === '/login') {
            console.log('[connection.onConnected] 从登录入口进入主聊天页');
            router.replace('/chat');
          } else {
            console.log('[connection.onConnected] 保留当前路由，不自动跳转', {
              currentPath,
            });
          }
        });
      },
      onDisconnected: () => {
        safeSync('connection.onDisconnected', () => {
          store.commit('CHANGE_LOGIN_STATUS', false);
          console.warn(
            '[connection.onDisconnected] IM 连接已断开，等待 SDK 自动重连；未跳转登录页。',
          );
        });
      },
      onOnline: () => {
        safeSync('connection.onOnline', () => {
          store.commit('CHANGE_NETWORK_STATUS', true);
        });
      },
      onOffline: () => {
        safeSync('connection.onOffline', () => {
          store.commit('CHANGE_NETWORK_STATUS', false);
        });
      },
      onError: (error) => {
        safeSync('connection.onError', () => {
          handleSDKErrorNotifi(error?.type, error?.message, error);
        });
      },
    });
  };

  //fetch 登陆用户的初始数据
  const fetchLoginUsersInitData = () => {
    getMyUserInfos();
    fetchLoginUserPresenceStatus();
    fetchFriendList();
    fetchTheLoginUserBlickList();
    fetchGroupList();
    Promise.resolve(store.dispatch('getConversationList')).catch((err) =>
      console.error('[fetchLoginUsersInitData.getConversationList]', err),
    );
  };
  //获取登陆用户属性
  const getMyUserInfos = () => {
    const userId = EMClient.user;
    Promise.resolve(store.dispatch('getMyUserInfo', userId)).catch((err) =>
      console.error('[getMyUserInfos]', err),
    );
  };
  //获取登录用户自己的在线状态
  const fetchLoginUserPresenceStatus = () => {
    const userId = EMClient.user;
    Promise.resolve(store.dispatch('fetchLoginUserPresenceStatus', userId)).catch(
      (err) => console.error('[fetchLoginUserPresenceStatus]', err),
    );
  };
  //获取好友列表
  const fetchFriendList = () => {
    Promise.resolve(
      store.dispatch('fetchAllContactsListWithRemarkFromServer'),
    ).catch((err) => console.error('[fetchFriendList]', err));
  };
  //获取黑名单列表
  const fetchTheLoginUserBlickList = () =>
    Promise.resolve(store.dispatch('fetchBlackList')).catch((err) =>
      console.error('[fetchTheLoginUserBlickList]', err),
    );
  //获取加入的群组列表
  const fetchGroupList = () =>
    Promise.allSettled([
      Promise.resolve(
        store.dispatch('fetchJoinedGroupListFromServer', {
          startPageNum: 0,
          reset: true,
        }),
      ),
      Promise.resolve(store.dispatch('fetchJoinedGroupCountFromServer')),
    ]).catch((err) => console.error('[fetchGroupList]', err));
  return {
    mountConnectEventListener,
    fetchLoginUsersInitData,
    getMyUserInfos,
    fetchLoginUserPresenceStatus,
    fetchFriendList,
    fetchTheLoginUserBlickList,
    fetchGroupList,
  };
};

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
          router.replace('/chat');
        });
      },
      onDisconnected: () => {
        safeSync('connection.onDisconnected', () => {
          router.push('/login');
          store.commit('CHANGE_LOGIN_STATUS', false);
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
    fetchFriendList,
    fetchTheLoginUserBlickList,
    fetchGroupList,
  };
};

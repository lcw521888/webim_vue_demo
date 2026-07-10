import { createStore } from 'vuex';
import { EMClient } from '@/IM';
import Conversation from './modules/conversation';
import Contacts from './modules/contacts';
import Message from './modules/message';
import Groups from './modules/groups';
import UsersProfile from './modules/usersProfile';
import { SOURCE_TYPE } from './modules/usersProfile';
export default createStore({
  state: {
    loginState: false,
    networkStatus: true,
    isShowWarningTips: true,
    chatroomMembers: new Map(),
    loginUserInfo: {
      hxId: '',
      nickname: '',
      avatarurl:
        'https://download-sdk.oss-cn-beijing.aliyuncs.com/downloads/IMDemo/avatar/Image5.png',
    },
    loginUserOnlineStatus: '',
  },
  getters: {
    loginUserInfo: (state) => state.loginUserInfo,
    loginUserOnlineStatus: (state) => state.loginUserOnlineStatus,
    getChatroomMembersMap: (state) => state.chatroomMembers,
  },
  mutations: {
    CLOSE_WARNING_TIPS: (state) => (state.isShowWarningTips = false),
    CHANGE_LOGIN_STATUS: (state, status) => {
      state.loginState = status;
    },
    CHANGE_NETWORK_STATUS: (state, status) => {
      state.networkStatus = status;
    },
    SET_CHATROOM_MEMBERS: (state, payload) => {
      const { chatRoomId, members } = payload;
      state.chatroomMembers.set(String(chatRoomId), [...members]);
    },

    SET_LOGIN_USER_INFO: (state, infos) => {
      state.loginUserInfo = Object.assign(state.loginUserInfo, infos);
    },
    SET_LOGIN_USER_ONLINE_STATUS: (state, payload) => {
      state.loginUserOnlineStatus = payload;
    },
  },
  actions: {
    //获取登陆用户的用户属性
    getMyUserInfo: async ({ commit }, userId) => {
      const { data } = await EMClient.fetchUserInfoById(userId);
      data[userId].hxId = userId;
      commit('SET_LOGIN_USER_INFO', data[userId]);
      commit(
        'UsersProfile/UPDATE_USER_PROFILE',
        {
          userId,
          sourceType: SOURCE_TYPE.CONTACT,
          profile: {
            ...data[userId],
          },
        },
        { root: true },
      );
    },
    //修改登陆用户的用户属性
    updateMyUserInfo: async ({ commit }, params) => {
      const { data } = await EMClient.updateUserInfo({ ...params });
      commit('SET_LOGIN_USER_INFO', data);
    },
    //查询登录用户自己的在线状态。只展示 SDK/服务端返回的真实状态，不做本地默认在线。
    fetchLoginUserPresenceStatus: async ({ commit, dispatch }, userId) => {
      const currentUserId = userId || EMClient.user;
      if (!currentUserId) {
        commit('SET_LOGIN_USER_ONLINE_STATUS', 'Unset');
        return null;
      }
      const list = await dispatch('fetchPresenceStatusByUsers', [currentUserId]);
      const presence = list.find((item) => item.uid === currentUserId) || list[0];
      commit('SET_LOGIN_USER_ONLINE_STATUS', presence?.ext || 'Unset');
      return presence || null;
    },
    //处理在线状态订阅变更（包含他人的用户状态）
    handlePresenceChanges: ({ commit }, status) => {
      const presenceUserId = status?.userId ?? status?.uid;
      const statusType = status?.ext ?? status?.description;
      if (presenceUserId === EMClient.user) {
        commit(
          'SET_LOGIN_USER_ONLINE_STATUS',
          statusType ? statusType : 'Unset',
        );
      } else {
        commit('SET_CONTACTS_PRESENCE_TO_MAP', [{ ...status }]);
      }
    },
  },
  modules: {
    Conversation,
    Contacts,
    Message,
    Groups,
    UsersProfile,
  },
});

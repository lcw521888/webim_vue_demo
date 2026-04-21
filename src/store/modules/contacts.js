import { EMClient } from '@/IM';
// import { useLocalStorage } from '@vueuse/core';
import { sortPinyinFriendItem, handlePresence } from '@/utils/handleSomeData';
import _ from 'lodash';
import { userProfileUtils, SOURCE_TYPE } from './usersProfile';
const Contacts = {
  state: {
    contactsWithRemarkMap: new Map(),
    contactsUserInfosMap: new Map(),
    contactsUsersPresenceMap: new Map(),
    subscribedPresenceList: [],
    friendBlackList: [],
  },
  mutations: {
    SET_FRIEND_LIST: (state, payload) => {
      state.friendList = _.assign({}, payload);
    },
    SET_ADD_NEW_FRIEND: (state, payload) => {
      state.friendList = _.assign(state.friendList, payload);
    },
    SET_FRIEND_LIST_WITH_REMARK: (state, payload) => {
      const { friendList } = payload;
      const toObj = _.keyBy(friendList, 'userId');
      const toMap = new Map(Object.entries(toObj));
      state.contactsWithRemarkMap = toMap;
    },
    SET_FRIEND_LIST_USER_INFOS: function (state, payload) {
      const { userInfos } = payload;
      const userInfosToMap = new Map(Object.entries(userInfos));
      if (state.contactsUserInfosMap.size === 0) {
        state.contactsUserInfosMap = userInfosToMap;
      } else {
        state.contactsUserInfosMap = new Map([
          ...state.contactsUserInfosMap,
          ...userInfosToMap,
        ]);
      }
    },
    DELETE_CONTACTS_FROM_MAP: (state, payload) => {
      state.contactsWithRemarkMap.has(payload) &&
        state.contactsWithRemarkMap.delete(payload);
      state.contactsUserInfosMap.has(payload) &&
        state.contactsUserInfosMap.delete(payload);
    },
    SET_BLACK_LIST: (state, payload) => {
      state.friendBlackList = _.assign([], payload);
    },
    SET_SUBSCRIBED_PRESENCE_LIST: (state, payload) => {
      state.subscribedPresenceList = _.assign([], payload);
    },
    SET_CONTACTS_PRESENCE_TO_MAP: (state, usersPresenceList) => {
      usersPresenceList.length > 0 &&
        usersPresenceList.forEach((presenceItem) => {
          const commonStatus = handlePresence(presenceItem);
          const mapKey = commonStatus.uid;
          if (mapKey) {
            state.contactsUsersPresenceMap.set(mapKey, commonStatus);
          }
        });
    },
    DELETE_CONTACTS_PRESENCE_TO_MAP: (state, payload) => {
      state.contactsUsersPresenceMap.has(payload) &&
        state.contactsUsersPresenceMap.delete(payload);
    },
    SET_CONTACTS_REMARK_TO_MAP: (state, payload) => {
      const { userId, remark } = payload;
      state.contactsWithRemarkMap.set(userId, {
        userId,
        remark,
      });
    },
    ADD_NEW_CONTACT: (state, payload) => {
      state.contactsWithRemarkMap.set(payload.userId, payload);
    },
  },
  actions: {
    //获取好友列表
    fetchAllFriendListFromServer: async ({ dispatch, commit }) => {
      const friendListData = {};
      try {
        //获取好友列表
        console.log('开始获取好友列表');
        const result = await EMClient.getContacts();
        console.log('获取好友列表结果', result);
        
        // 安全检查
        if (!result || !result.data) {
          console.warn('获取好友列表返回数据为空');
          commit('SET_FRIEND_LIST', friendListData);
          return;
        }
        
        const { data } = result;
        console.log('获取好友列表数据', data);
        
        data.length > 0 &&
          data.map((item) => (friendListData[item] = { hxId: item }));
        //获取好友列表对应的用户属性
        const friendListWithInfos = await dispatch('getOtherUserInfo', data);
        //合并两对象
        const mergedFriendList = _.merge(friendListData, friendListWithInfos);
        commit('SET_FRIEND_LIST', mergedFriendList);
        //提交之后订阅好友状态
        data.length > 0 && dispatch('subFriendsPresence', data);
      } catch (error) {
        console.error('获取好友列表失败', error);
        // 忽略 SDK 内部错误，防止应用崩溃
        if (error.message?.includes('Cannot read properties of undefined (reading')) {
          console.warn('SDK 内部错误，已忽略');
        }
        //异常一般为获取会话异常，直接提交好友列表
        commit('SET_FRIEND_LIST', friendListData);
      }
    },
    //获取全部好友列表（包含好友备注）
    fetchAllContactsListWithRemarkFromServer: async ({ dispatch, commit }) => {
      try {
        //获取好友列表
        console.log('开始获取全部好友列表');
        const result = await EMClient.getAllContacts();
        console.log('获取全部好友列表结果', result);
        
        // 安全检查
        if (!result || !result.data) {
          console.warn('获取好友列表返回数据为空');
          return;
        }
        
        const { data } = result;
        console.log('>>>>>获取全部好友列表', data);
        
        if (data?.length > 0) {
          commit('SET_FRIEND_LIST_WITH_REMARK', {
            friendList: { ...data },
          });
          const normalizedContacts = userProfileUtils.normalizeUserData()(data);
          commit('UsersProfile/MERGE_USER_PROFILES', normalizedContacts, {
            root: true,
          });
          
          const userIds = _.map(data, 'userId');
          if (userIds?.length > 0) {
            dispatch('fetchContactsUserInfos', userIds);
            // 登录后批量订阅好友在线状态，之后对方 publishPresence / 上下线会触发 onPresenceStatusChange
            dispatch('subFriendsPresence', userIds);
          }
        }
      } catch (error) {
        console.error('好友列表获取失败', error);
        // 忽略 SDK 内部错误，防止应用崩溃
        if (error.message?.includes('Cannot read properties of undefined (reading')) {
          console.warn('SDK 内部错误，已忽略');
        }
      }
    },
    //新增联系人
    onAddNewContact: async ({ dispatch, commit }, params) => {
      const { from: userId } = params;
      const newContactParams = {
        userId,
        remark: '',
      };
      console.log('>>>>>新增联系人', newContactParams);
      commit('ADD_NEW_CONTACT', newContactParams);
      dispatch('fetchContactsUserInfos', [userId]);
      dispatch('subFriendsPresence', [userId]);
    },
    //好友关系解除
    onDeleteContact: async ({ dispatch, commit }, params) => {
      //取消订阅好友状态。
      const { from: userId } = params;
      dispatch('unsubFriendsPresence', userId);
      //从本地好友列表中删除此好友
      commit('DELETE_CONTACTS_FROM_MAP', userId);
    },
    //获取黑名单列表
    fetchBlackList: async ({ dispatch, commit }, params) => {
      try {
        const { data } = await EMClient.getBlocklist();
        commit('SET_BLACK_LIST', data);
      } catch (error) {
        console.error('获取黑名单列表失败', error);
      }
    },
    //获取联系人用户属性
    fetchContactsUserInfos: async ({ commit }, users) => {
      /**
       * @param {String|Array} users - 用户id
       */
      let usersInfosObj = {};
      const requestTask = [];
      const usersArr = _.chunk([...users], 99); //分拆users 用户属性获取一次不能超过100个
      try {
        usersArr.length > 0 &&
          usersArr.map((userItem) =>
            requestTask.push(EMClient.fetchUserInfoById(userItem)),
          );
        const result = await Promise.all(requestTask);
        const usersInfos = _.map(result, 'data');
        usersInfos.length > 0 &&
          usersInfos.map(
            (item) => (usersInfosObj = Object.assign(usersInfosObj, item)),
          );

        commit('SET_FRIEND_LIST_USER_INFOS', {
          userInfos: usersInfosObj,
        });
        const normalizedContacts = userProfileUtils.normalizeUserData(
          SOURCE_TYPE.CONTACT,
        )(usersInfosObj);
        commit('UsersProfile/MERGE_USER_PROFILES', normalizedContacts, {
          root: true,
        });
      } catch (error) {
        console.error('>>>获取联系人用户属性失败', error);
      }
    },
    //订阅好友的在线状态
    subFriendsPresence: async ({ commit }, users) => {
      const requestTask = [];
      const usersArr = _.chunk([...users], 100); //分拆users 订阅好友状态一次不能超过100个
      try {
        usersArr.length > 0 &&
          usersArr.map((userItem) =>
            requestTask.push(
              EMClient.subscribePresence({
                usernames: userItem,
                expiry: 30 * 24 * 3600,
              }),
            ),
          );
        const resultData = await Promise.all(requestTask);
        const usersPresenceList = _.flattenDeep(_.map(resultData, 'result')); //返回值是个二维数组，flattenDeep处理为一维数组
        const list =
          usersPresenceList.length > 0
            ? usersPresenceList.filter((p) => p.uid !== '')
            : [];
        if (list.length > 0) {
          commit('SET_CONTACTS_PRESENCE_TO_MAP', list);
        }
        console.log('[环信 Presence] subscribePresence 已请求', {
          订阅的用户名列表: users,
          返回快照条数: list.length,
          快照: list,
        });
      } catch (error) {
        console.error('[环信 Presence] subscribePresence 失败', error);
      }
    },
    //取消订阅
    unsubFriendsPresence: async ({ commit }, user) => {
      try {
        const option = {
          usernames: [user],
        };
        await EMClient.unsubscribePresence(option);
        commit('DELETE_CONTACTS_PRESENCE_TO_MAP', user);
      } catch (error) {
        console.error('取消订阅好友状态失败', error);
      }
    },
    //查询已订阅用户列表
    fetchSubscribedPresenceList: async (
      { commit },
      option = { pageNum: 0, pageSize: 50 },
    ) => {
      try {
        const res = await EMClient.getSubscribedPresencelist(option);
        const rawList = res?.result || res?.data || [];
        const list = Array.isArray(rawList) ? rawList : [];
        commit('SET_SUBSCRIBED_PRESENCE_LIST', list);
        return list;
      } catch (error) {
        console.error('[环信 Presence] getSubscribedPresencelist 失败', error);
        commit('SET_SUBSCRIBED_PRESENCE_LIST', []);
        return [];
      }
    },
    //主动查询指定用户当前在线状态
    fetchPresenceStatusByUsers: async ({ commit }, users = []) => {
      try {
        const usernames = Array.isArray(users) ? users : [users];
        if (usernames.length === 0) return [];
        const res = await EMClient.getPresenceStatus({ usernames });
        const rawList = res?.result || res?.data || [];
        const list = Array.isArray(rawList) ? rawList : [];
        if (list.length > 0) {
          commit('SET_CONTACTS_PRESENCE_TO_MAP', list);
        }
        return list.map((item) => handlePresence(item));
      } catch (error) {
        console.error('[环信 Presence] getPresenceStatus 失败', error);
        return [];
      }
    },
    //设置联系人备注
    setContactsRemark: async ({ commit }, params) => {
      const { userId, remark } = params;
      if (!userId && !remark) throw new Error('userId or remark is required');
      try {
        EMClient.setContactRemark({
          userId, // 添加备注的目标好友的用户 ID
          remark, // 好友备注
        });
        commit('SET_CONTACTS_REMARK_TO_MAP', { userId, remark });
        commit(
          'UsersProfile/UPDATE_USER_PROFILE',
          {
            userId,
            sourceType: SOURCE_TYPE.BASE,
            profile: {
              remark,
            },
          },
          { root: true },
        );
      } catch (error) {
        console.error('设置联系人备注失败', error);
      }
    },
  },
  getters: {
    //返回排序后的好友列表
    //legacy
    sortedFriendList: (state) => {
      console.log(state.friendList);
      return sortPinyinFriendItem(state.friendList);
    },
    //获取基础好友列表 //legacy
    getFriendList: (state) => {
      return state.friendList;
    },
    getContactsUserInfosMap: (state) => {
      return state.contactsUserInfosMap;
    },
    getContactsWithRemarkMap: (state) => {
      return state.contactsWithRemarkMap;
    },
    getContactsUsersPresenceMap: (state) => {
      return state.contactsUsersPresenceMap;
    },
    getSubscribedPresenceList: (state) => {
      return state.subscribedPresenceList;
    },
  },
};

export default Contacts;

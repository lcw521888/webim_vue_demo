import { EMClient } from '@/IM';
import { setMessageKey } from '@/utils/handleSomeData';
import _ from 'lodash';
import {
  MESSAGE_STATUS_TYPE,
  CUSTOM_MESSAGE_TYPE,
  CHANGE_MESSAGE_BODAY_TYPE,
  CHAT_TYPE,
  MAX_MESSAGE_LIST_COUNT,
} from '@/constant';
import eventEmitter from '@/utils/eventEmitter';
const Message = {
  state: {
    messageList: {},
    messageIdsCollection: {
      // 'pfh':new Map(),
      // 'pfh1':new Map(),
    },
  },
  mutations: {
    UPDATE_MESSAGE_LIST: (state, msgBody) => {
      // 确保msgBody有基本属性
      if (!msgBody) {
        console.error('msgBody为空，无法更新消息列表');
        return;
      }

      const serverMsgId =
        msgBody.id || Date.now() + Math.random().toString(36).substring(2);
      const listKey = setMessageKey(msgBody);

      if (!state.messageList[listKey]) {
        state.messageList[listKey] = [];
      }

      // 为所有类型的消息生成临时ID（如果没有）
      if (!msgBody.id) {
        msgBody.id = serverMsgId;
      }

      // 先检查是否已存在相同ID的消息，仅在不存在时添加
      if (msgBody.id) {
        const exists = state.messageList[listKey].some(
          (m) => m.id === msgBody.id,
        );
        if (!exists) {
          state.messageList[listKey].push(msgBody);
        } else {
          // 如果存在相同ID的消息，更新它而不是忽略
          const index = state.messageList[listKey].findIndex(
            (m) => m.id === msgBody.id,
          );
          if (index !== -1) {
            state.messageList[listKey][index] = msgBody;
          }
        }
      } else {
        // 如果没有ID，直接添加
        state.messageList[listKey].push(msgBody);
      }

      // 限制数组的长度为 MAX_MESSAGE_LIST_COUNT
      if (state.messageList[listKey].length > MAX_MESSAGE_LIST_COUNT) {
        state.messageList[listKey] = state.messageList[listKey].slice(
          -MAX_MESSAGE_LIST_COUNT,
        );
      }
      /**
       * 暂只实现以单对单已读回执
       * 群组已读回执可通过Reaction方案实现
       */
      if (
        !state.messageIdsCollection[listKey] &&
        msgBody.chatType === CHAT_TYPE.SINGLE
      ) {
        state.messageIdsCollection[listKey] = new Map();
      }
      if (
        msgBody.from === EMClient.user &&
        msgBody.chatType === CHAT_TYPE.SINGLE
      ) {
        state.messageIdsCollection[listKey].set(serverMsgId, {
          [MESSAGE_STATUS_TYPE.READ_STATUS]: false,
        });
      }
    },
    UPDATE_HISTORY_MESSAGE: (state, payload) => {
      const { listKey, historyMessageList } = payload;
      if (!state.messageList[listKey]) {
        state.messageList[listKey] = [];
      }
      state.messageList[listKey] = _.unionBy(
        historyMessageList,
        state.messageList[listKey],
        (m) => m.id,
      );
    },
    UPDATE_MESSAGE_IDS_COLLECTION: (state, payload) => {
      const { id: serverMsgId, key, type } = payload;
      switch (type) {
        case MESSAGE_STATUS_TYPE.READ_STATUS:
          {
            if (state.messageIdsCollection[key]) {
              state.messageIdsCollection[key].set(serverMsgId, {
                [MESSAGE_STATUS_TYPE.READ_STATUS]: true,
              });
            }
          }
          break;
        case MESSAGE_STATUS_TYPE.CHANLE_STATUS:
          {
            if (state.messageIdsCollection[key]) {
              const READ_STATUS_KEY = MESSAGE_STATUS_TYPE.READ_STATUS;
              // 直接使用Map的forEach方法
              state.messageIdsCollection[key].forEach((value, key) => {
                if (value[READ_STATUS_KEY] !== true) {
                  value[READ_STATUS_KEY] = true;
                }
              });
            }
          }
          break;
        default:
          break;
      }
    },
    //清除某条会话消息
    CLEAR_SOMEONE_MESSAGE: (state, payload) => {
      state.messageList[payload] = [];
    },
    //修改本地原消息【撤回、删除、编辑】
    CHANGE_MESSAGE_BODAY: (state, payload) => {
      const { type, key, mid } = payload;
      switch (type) {
        case CHANGE_MESSAGE_BODAY_TYPE.RECALL:
          {
            if (state.messageList[key]) {
              const res = _.find(state.messageList[key], (o) => o.id === mid);
              res.isRecall = true;
            }
          }

          break;
        case CHANGE_MESSAGE_BODAY_TYPE.DELETE:
          {
            if (state.messageList[key]) {
              const sourceData = state.messageList[key];
              const index = _.findIndex(
                state.messageList[key],
                (o) => o.id === mid,
              );
              sourceData.splice(index, 1);
              state.messageList[key] = _.assign([], sourceData);
            }
          }
          break;
        case CHANGE_MESSAGE_BODAY_TYPE.MODIFY:
          {
            if (state.messageList[key]) {
              const res = _.find(state.messageList[key], (o) => o.id === mid);
              _.assign(res, payload?.message);
            }
          }
          break;
        default:
          break;
      }
    },
  },
  actions: {
    //添加新消息
    createNewMessage: ({ dispatch, commit }, params) => {
      console.log('[Vuex Action] createNewMessage 被调用');
      console.log('消息参数:', params);

      const key = setMessageKey(params);

      console.log('生成的消息列表键:', key);

      commit('UPDATE_MESSAGE_LIST', params);
      // 触发新消息事件，用于播放提示音
      eventEmitter.emit('newMessage', params);
      
      dispatch('updateConversationList', {
        conversationId: key,
        chatType: params.chatType,
      });

      console.log('[Vuex Action] createNewMessage 执行完成');
    },
    //获取历史消息
    getHistoryMessage: async ({ state, dispatch, commit }, params) => {
      const { id, chatType, cursor } = params;
      return new Promise((resolve, reject) => {
        const options = {
          targetId: id,
          pageSize: 20,
          cursor: cursor,
          chatType: chatType,
          searchDirection: 'up',
        };
        EMClient.getHistoryMessages(options)
          .then((res) => {
            const { cursor, messages } = res;
            messages.length > 0 &&
              messages.forEach((item) => {
                item.read = true;
                // 确保历史消息有正确的chatType和to字段
                if (!item.chatType) {
                  item.chatType = chatType;
                }
                if (!item.to) {
                  item.to = id;
                }
              });
            resolve({ messages, cursor });
            const reversedMessages = _.reverse(_.cloneDeep(messages));
            // 为历史消息生成正确的listKey
            const listKey = setMessageKey({ to: id, chatType });
            commit('UPDATE_HISTORY_MESSAGE', {
              listKey: listKey,
              historyMessageList: reversedMessages,
            });
            if (!state.messageList[listKey]) {
              //提示会话列表更新
              dispatch('updateConversationList', {
                conversationId: id,
                chatType: chatType,
              });
            }
            dispatch('UsersProfile/processMessageExt', reversedMessages, {
              root: true,
            });
          })
          .catch((error) => {
            console.error('【Store】获取历史消息失败:', {
              error,
              errorType: error.type,
              errorMessage: error.message,
              errorStack: error.stack
            });
            
            // 处理INVALID_TOKEN错误
            if (
              error.type === 28 || // 错误类型28对应INVALID_TOKEN
              error.message?.includes('INVALID_TOKEN') ||
              error.message?.includes('Invalid token')
            ) {
              console.error('【Store】令牌无效，跳转到登录页面');
              // 清除本地存储的登录信息
              localStorage.removeItem('EASEIM_loginUser');
              // 跳转到登录页面
              window.location.href = '/login';
            }
            
            reject(error);
          });
      });
    },
    //已发送展示类型消息
    senedShowTypeMessage: async ({ dispatch, commit }, message) => {
      commit('UPDATE_MESSAGE_LIST', message);
      // 提示会话列表更新
      dispatch('updateConversationList', {
        conversationId: setMessageKey(message), // 使用setMessageKey生成正确的列表键
        chatType: message.chatType,
      });
    },
    //添加通知类消息
    createInformMessage: ({ dispatch, commit }, params) => {
      /** 
               const params = {
                    from: '',
                    to: '',
                    chatType: '',
                    msg:''
                }
            */
      console.log('first', params);
      const msgBody = _.cloneDeep(params);
      msgBody.type = CUSTOM_MESSAGE_TYPE.INFORM;
      const key = setMessageKey(params);

      commit('UPDATE_MESSAGE_LIST', msgBody);
      dispatch('updateConversationList', {
        conversationId: key,
        chatType: msgBody.chatType,
      });
    },
    //删除消息
    removeMessage: ({ dispatch, commit }, params) => {
      const { id: mid, chatType } = params;
      const key = setMessageKey(params);
      return new Promise((resolve, reject) => {
        EMClient.removeHistoryMessages({
          targetId: key,
          chatType: chatType,
          messageIds: [mid],
        })
          .then((res) => {
            commit('CHANGE_MESSAGE_BODAY', {
              type: CHANGE_MESSAGE_BODAY_TYPE.DELETE,
              key: key,
              mid,
            });
            dispatch('updateConversationList', {
              conversationId: key,
              chatType,
            });
            resolve('OK');
          })
          .catch((error) => {
            reject(error);
          });
      });
    },
    //撤回消息
    recallMessage: async ({ dispatch, commit }, params) => {
      const { mid, to, chatType } = params;
      console.log('[Vuex Action] Starting Message Recall (recallMessage)');
      console.log('Request Params:', {
        messageId: mid,
        conversationId: to,
        chatType: chatType,
      });

      return new Promise((resolve, reject) => {
        console.log('[IM SDK] Calling recallMessage method...');
        EMClient.recallMessage({ mid, to, chatType })
          .then((result) => {
            console.log('[IM SDK] recallMessage method called successfully');
            console.log('SDK Result:', result || 'No return value');

            console.log(
              '[Vuex Mutation] Updating message status to recalled...',
            );
            commit('CHANGE_MESSAGE_BODAY', {
              type: CHANGE_MESSAGE_BODAY_TYPE.RECALL,
              key: to,
              mid,
            });

            console.log('[Vuex Action] Updating conversation list...');
            dispatch('updateConversationList', {
              conversationId: to,
              chatType,
            });

            console.log('[Vuex Action] Message recall process completed');
            resolve('OK');
          })
          .catch((error) => {
            console.error('[IM SDK] recallMessage method call failed');
            console.error('Error Details:', {
              errorType: error.type,
              errorMessage: error.message,
              errorData: error.data,
              originalError: error,
            });
            reject(error);
          });
      });
    },
    //修改（编辑）消息
    modifyMessage: async ({ dispatch, commit }, params) => {
      if (
        !params ||
        !params.id ||
        !params.to ||
        !params.chatType ||
        !params.msg
      ) {
        console.error('modifyMessage 参数错误:', params);
        return Promise.reject(new Error('参数错误'));
      }

      const { id: mid, to, chatType, msg } = params;
      return new Promise((resolve, reject) => {
        const textMessage = EMClient.Message.create({
          type: 'txt',
          msg: msg,
          to: to,
          chatType: chatType,
        });

        EMClient.modifyMessage({
          messageId: mid,
          modifiedMessage: textMessage,
        })
          .then((res) => {
            const { message } = res || {};
            commit('CHANGE_MESSAGE_BODAY', {
              type: CHANGE_MESSAGE_BODAY_TYPE.MODIFY,
              key: to,
              mid,
              message,
            });
            dispatch('updateConversationList', {
              conversationId: to,
              chatType,
            });
            resolve(res);
          })
          .catch((e) => {
            reject(e);
          });
      });
    },
  },
  getters: {
    getMessageIdsCollectionMap: (state) => state.messageIdsCollection,
  },
};
export default Message;

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
import { isDirectedMessage } from '@/utils/directedMessage';
import eventEmitter from '@/utils/eventEmitter';

const normalizeReactionList = (reactions = []) => {
  if (!Array.isArray(reactions)) return [];
  return reactions
    .filter((item) => item && item.reaction)
    .map((item) => ({
      reaction: item.reaction,
      count: Number(item.count) || 0,
      userList: Array.isArray(item.userList) ? item.userList : [],
      isAddedBySelf: !!item.isAddedBySelf,
      op: Array.isArray(item.op) ? item.op : [],
    }));
};

const updateMessageReactionByKey = (state, listKey, messageId, reactions) => {
  if (!state.messageList[listKey]) return false;
  const message = _.find(state.messageList[listKey], (o) => o.id === messageId);
  if (!message) return false;
  message.reactions = normalizeReactionList(reactions);
  return true;
};

const updateMessageReactionInAllLists = (state, messageId, reactions) => {
  let found = false;
  Object.keys(state.messageList).forEach((listKey) => {
    const updated = updateMessageReactionByKey(
      state,
      listKey,
      messageId,
      reactions,
    );
    if (updated) found = true;
  });
  return found;
};

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
              if (res) {
                res.isRecall = true;
              } else {
                console.warn('未找到要撤回的消息:', mid);
              }
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
              if (res) {
                // 保存原始的发送者信息和聊天类型
                const originalFrom = res.from;
                const originalChatType = res.chatType;
                // 更新消息内容，但保持发送者和聊天类型不变
                _.assign(res, payload?.message);
                // 恢复原始的发送者信息和聊天类型
                res.from = originalFrom;
                res.chatType = originalChatType;
              } else {
                console.warn('未找到要修改的消息:', mid);
              }
            }
          }
          break;
        default:
          break;
      }
    },
    UPDATE_MESSAGE_REACTIONS: (state, payload) => {
      const { messageId, reactions, key } = payload;
      if (!messageId) return;
      if (key) {
        const updated = updateMessageReactionByKey(state, key, messageId, reactions);
        if (updated) return;
      }
      updateMessageReactionInAllLists(state, messageId, reactions);
    },
    // 更新消息送达状态
    UPDATE_MESSAGE_DELIVERED: (state, payload) => {
      console.log('更新消息送达状态:', payload);
      const { messageId, conversationId, chatType } = payload;
      const key = setMessageKey({ to: conversationId, chatType });
      console.log('生成的消息列表键:', key);
      if (state.messageList[key]) {
        console.log('消息列表存在，查找消息:', messageId);
        const message = _.find(state.messageList[key], (o) => o.id === messageId);
        if (message) {
          message.delivered = true;
          console.log('消息送达状态更新成功:', messageId);
        } else {
          console.log('未找到消息:', messageId);
        }
      } else {
        console.log('消息列表不存在:', key);
      }
    },
    // 更新消息已读状态
    UPDATE_MESSAGE_READ: (state, payload) => {
      console.log('更新消息已读状态:', payload);
      const { messageId, conversationId, chatType, groupReadCount } = payload;
      const key = setMessageKey({ to: conversationId, chatType });
      console.log('生成的消息列表键:', key);
      if (state.messageList[key]) {
        console.log('消息列表存在，查找消息:', messageId);
        const message = _.find(state.messageList[key], (o) => o.id === messageId);
        if (message) {
          message.read = true;
          if (groupReadCount) {
            message.groupReadCount = groupReadCount;
          }
          console.log('消息已读状态更新成功:', messageId);
        } else {
          console.log('未找到消息:', messageId);
        }
      } else {
        console.log('消息列表不存在:', key);
      }
    },
    // 发送消息已读回执
    SEND_MESSAGE_READ_RECEIPT: (state, payload) => {
      console.log('发送消息已读回执:', payload);
      const { messageId, to, chatType } = payload;
      const key = setMessageKey({ to, chatType });
      console.log('生成的消息列表键:', key);
      if (state.messageList[key]) {
        console.log('消息列表存在，查找消息:', messageId);
        const message = _.find(state.messageList[key], (o) => o.id === messageId);
        if (message) {
          // 创建已读回执消息
          const readReceipt = {
            type: 'read',
            chatType: chatType,
            to: to,
            id: messageId
          };
          console.log('创建已读回执消息:', readReceipt);
          // 发送已读回执
          if (typeof EMClient !== 'undefined' && EMClient.Message && EMClient.send) {
            const msg = EMClient.Message.create(readReceipt);
            console.log('发送已读回执:', msg);
            EMClient.send(msg).then((result) => {
              console.log('发送已读回执成功:', result);
            }).catch((error) => {
              console.error('发送已读回执失败:', error);
            });
          } else {
            console.error('EMClient 未定义或缺少必要方法');
          }
        } else {
          console.log('未找到消息:', messageId);
        }
      } else {
        console.log('消息列表不存在:', key);
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

      if (!isDirectedMessage(params)) {
        dispatch('updateConversationList', {
          conversationId: key,
          chatType: params.chatType,
        });
      }

      console.log('[Vuex Action] createNewMessage 执行完成');
    },
    //获取历史消息
    getHistoryMessage: async ({ state, dispatch, commit }, params) => {
      const {
        id,
        chatType,
        cursor = -1,
        pageSize = 20,
        searchDirection = 'up',
        searchOptions,
      } = params;
      console.log('【Store】开始拉取历史消息:', {
        conversationId: id,
        chatType: chatType,
        cursor: cursor || '初始加载',
        pageSize,
        searchDirection,
        searchOptions,
      });
      return new Promise((resolve, reject) => {
        const options = {
          targetId: id,
          pageSize: Math.min(Math.max(Number(pageSize) || 20, 1), 50),
          cursor,
          chatType: chatType,
          searchDirection,
          ...(searchOptions ? { searchOptions } : {}),
        };
        console.log('【Store】拉取历史消息参数:', options);
        console.log('【Store】开始调用 EMClient.getHistoryMessages');
        EMClient.getHistoryMessages(options)
          .then((res) => {
            console.log('【Store】拉取历史消息成功，返回结果:', {
              hasCursor: !!res.cursor,
              messageCount: res.messages?.length || 0
            });
            const { cursor: nextCursor, messages } = res;
            console.log('【Store】处理拉取到的历史消息:', {
              originalCount: messages?.length || 0,
              firstMessageId: messages?.length > 0 ? messages[0].id : '无',
              lastMessageId: messages?.length > 0 ? messages[messages.length - 1].id : '无'
            });
            const reactionMessages = (messages || []).filter(
              (item) => Array.isArray(item?.reactions) && item.reactions.length > 0,
            );
            if (reactionMessages.length > 0) {
              console.log(
                '[Reaction] getHistoryMessages 返回的消息包含 Reaction 概览',
                reactionMessages.map((item) => ({
                  messageId: item.id,
                  chatType: item.chatType,
                  reactions: item.reactions,
                })),
              );
            }
            messages?.length > 0 &&
              messages.forEach((item) => {
                // 确保历史消息有正确的chatType和to字段
                if (!item.chatType) {
                  item.chatType = chatType;
                }
                if (!item.to) {
                  item.to = id;
                }
              });
            console.log('【Store】处理完成，准备解析结果');
            resolve({
              messages,
              cursor: nextCursor,
              hasMore:
                typeof nextCursor === 'string'
                  ? nextCursor !== ''
                  : (messages?.length || 0) >= options.pageSize,
            });
            const reversedMessages = _.reverse(_.cloneDeep(messages || []));
            // 为历史消息生成正确的listKey
            const listKey = setMessageKey({ to: id, chatType });
            console.log('【Store】生成消息列表键:', listKey);
            commit('UPDATE_HISTORY_MESSAGE', {
              listKey: listKey,
              historyMessageList: reversedMessages,
            });
            if (!state.messageList[listKey]) {
              console.log('【Store】消息列表不存在，更新会话列表');
              //提示会话列表更新
              dispatch('updateConversationList', {
                conversationId: id,
                chatType: chatType,
              });
            }
            console.log('【Store】处理消息扩展信息');
            dispatch('UsersProfile/processMessageExt', reversedMessages, {
              root: true,
            });
            console.log('【Store】历史消息拉取流程完成');
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
      if (!isDirectedMessage(message)) {
        // 提示会话列表更新
        dispatch('updateConversationList', {
          conversationId: setMessageKey(message), // 使用setMessageKey生成正确的列表键
          chatType: message.chatType,
        });
      }
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
      const { id: mid, to, chatType } = params;
      
      // 验证参数
      if (!to || to === '') {
        return Promise.reject(new Error('缺少targetId参数'));
      }
      
      const key = setMessageKey(params);
      const deleteOptions = {
        targetId: to,
        chatType: chatType,
        messageIds: [mid],
      };
      console.log('[Message Delete] removeHistoryMessages 请求参数', {
        event: '聊天室/会话消息删除',
        messageId: mid,
        targetId: deleteOptions.targetId,
        conversationKey: key,
        chatType,
        to,
        from: params?.from,
        sdkOptions: deleteOptions,
        rawMessage: params,
      });
      return new Promise((resolve, reject) => {
        EMClient.removeHistoryMessages(deleteOptions)
          .then((res) => {
            console.log('[Message Delete] removeHistoryMessages 成功', {
              messageId: mid,
              targetId: deleteOptions.targetId,
              conversationKey: key,
              chatType,
              response: res,
            });
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
            console.error('[Message Delete] removeHistoryMessages 失败', {
              messageId: mid,
              targetId: deleteOptions.targetId,
              conversationKey: key,
              chatType,
              to,
              from: params?.from,
              sdkOptions: deleteOptions,
              rawMessage: params,
              error,
            });
            reject(error);
          });
      });
    },
    //撤回消息
    recallMessage: async ({ dispatch, commit }, params) => {
      const { mid, to, chatType } = params;

      return new Promise((resolve, reject) => {
        EMClient.recallMessage(params)
          .then((result) => {
            const key = setMessageKey({ to, chatType });
            commit('CHANGE_MESSAGE_BODAY', {
              type: CHANGE_MESSAGE_BODAY_TYPE.RECALL,
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
            // 打印真实的错误信息
            console.error('消息撤回失败:', error);
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
      const key = setMessageKey(params);
      return new Promise((resolve, reject) => {
        const textMessage = EMClient.Message.create({
          type: 'txt',
          msg: msg,
          to: to,
          from: EMClient.user,
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
              key: key,
              mid,
              message,
            });
            dispatch('updateConversationList', {
              conversationId: key,
              chatType,
            });
            resolve('OK');
          })
          .catch((error) => {
            console.error('[Message Modify] modifyMessage 失败', {
              error,
              messageId: mid,
              targetId: to,
              chatType,
              conversationKey: key,
              modifiedContent: msg,
              loginUser: EMClient.user,
            });
            reject(error);
          });
      });
    },
    fetchMessageReactionList: async ({ commit }, params) => {
      const { messageId, chatType, groupId, key } = params || {};
      if (!messageId || !chatType) return [];
      try {
        console.log('[Reaction] getReactionlist 请求', {
          messageId,
          chatType,
          groupId,
        });
        const res = await EMClient.getReactionlist({
          messageId,
          chatType,
          groupId,
        });
        console.log('[Reaction] getReactionlist 返回', res);
        const rawList = Array.isArray(res?.data) ? res.data : [];
        const target = rawList.find((item) => item?.messageId === messageId) || {};
        const reactions = normalizeReactionList(target?.reactions || []);
        commit('UPDATE_MESSAGE_REACTIONS', {
          key,
          messageId,
          reactions,
        });
        return reactions;
      } catch (error) {
        console.error('[Reaction] getReactionlist 失败', error);
        return [];
      }
    },
    fetchMessageReactionDetail: async (_, params) => {
      const { messageId, reaction, cursor = null, pageSize = 20 } = params || {};
      if (!messageId || !reaction) return null;
      try {
        console.log('[Reaction] getReactionDetail 请求', {
          messageId,
          reaction,
          cursor,
          pageSize,
        });
        const res = await EMClient.getReactionDetail({
          messageId,
          reaction,
          cursor,
          pageSize,
        });
        console.log('[Reaction] getReactionDetail 返回', res);
        return res;
      } catch (error) {
        console.error('[Reaction] getReactionDetail 失败', error);
        throw error;
      }
    },
    handleReactionChange: ({ commit }, payload) => {
      if (!payload?.messageId) return;
      commit('UPDATE_MESSAGE_REACTIONS', {
        messageId: payload.messageId,
        reactions: payload.reactions || [],
      });
    },
    addMessageReaction: async ({ dispatch }, params) => {
      const { messageId, reaction, chatType, groupId, key } = params || {};
      if (!messageId || !reaction) {
        throw new Error('addMessageReaction 缺少参数');
      }
      if (chatType === CHAT_TYPE.CHATROOM) {
        throw new Error('聊天室暂不支持 Reaction');
      }
      try {
        console.log('[Reaction] addReaction 请求', { messageId, reaction });
        await EMClient.addReaction({ messageId, reaction });
        console.log('[Reaction] addReaction 成功', { messageId, reaction });
      } catch (error) {
        // 1101 表示当前用户已对同一条消息添加过该 Reaction。
        // 这属于幂等场景，刷新列表后直接返回，避免把它当成真正失败。
        if (
          error?.type === 1101 ||
          error?.message?.includes('already operation this message')
        ) {
          console.warn('[Reaction] 已添加过该表情，改为刷新当前 Reaction 列表');
        } else {
          throw error;
        }
      }
      return dispatch('fetchMessageReactionList', {
        messageId,
        chatType,
        groupId,
        key,
      });
    },
    deleteMessageReaction: async ({ dispatch }, params) => {
      const { messageId, reaction, chatType, groupId, key } = params || {};
      if (!messageId || !reaction) {
        throw new Error('deleteMessageReaction 缺少参数');
      }
      if (chatType === CHAT_TYPE.CHATROOM) {
        throw new Error('聊天室暂不支持 Reaction');
      }
      console.log('[Reaction] deleteReaction 请求', { messageId, reaction });
      await EMClient.deleteReaction({ messageId, reaction });
      console.log('[Reaction] deleteReaction 成功', { messageId, reaction });
      return dispatch('fetchMessageReactionList', {
        messageId,
        chatType,
        groupId,
        key,
      });
    },
  },
  getters: {
    getMessageIdsCollectionMap: (state) => state.messageIdsCollection,
  },
};
export default Message;

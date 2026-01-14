import { EMClient } from '../index';
import { CHAT_TYPE } from '../constant';
import { CHANGE_MESSAGE_BODAY_TYPE } from '@/constant';
import { setMessageKey } from '@/utils/handleSomeData';
import store from '@/store';

export const imReviceMessageListener = () => {
  //接收的消息往store中push
  const pushNewMessage = (message) => {
    // 确保消息有基本属性
    if (!message || !message.to || !message.chatType) {
      console.error('收到无效消息:', message);
      return;
    }
    
    // 确保聊天室消息能被正确处理
    if (message.chatType === CHAT_TYPE.CHATROOM) {
      console.log('=== 收到聊天室消息 ===', {
        from: message.from,
        to: message.to,
        chatType: message.chatType,
        msg: message.msg || message.content,
        id: message.id
      });
    }
    
    store.dispatch('createNewMessage', message);
    store.dispatch('UsersProfile/processMessageExt', message, { root: true });
  };
  //收到他人的撤回指令
  const otherRecallMessage = (message) => {
    const { from, to, mid, chatType: messageChatType } = message;
    //单对单的撤回to必然为登陆的用户id，群组/聊天室发起撤回to必然为群组/聊天室id 所以key可以这样来区分群组/聊天室或者单人。
    const key = to === EMClient.user ? from : to;

    // 根据消息中的chatType确定聊天类型
    const chatType = to === EMClient.user ? CHAT_TYPE.SINGLE : 
                    messageChatType === CHAT_TYPE.CHATROOM ? CHAT_TYPE.CHATROOM : CHAT_TYPE.GROUP;
    store.commit('CHANGE_MESSAGE_BODAY', {
      type: CHANGE_MESSAGE_BODAY_TYPE.RECALL,
      key,
      mid,
    });
    store.dispatch('updateConversationList', {
      conversationId: key,
      chatType,
    });
  };
  //收到消息修改指令
  const otherModifyMessage = (message) => {
    const { from, to, id: mid, chatType } = message;
    //单对单的撤回to必然为登陆的用户id，群组发起撤回to必然为群组id 所以key可以这样来区分群组或者单人。
    if (!to) return;
    const key = to === EMClient.user ? from : to;
    store.commit('CHANGE_MESSAGE_BODAY', {
      type: CHANGE_MESSAGE_BODAY_TYPE.MODIFY,
      key,
      mid,
      message,
    });
    store.dispatch('updateConversationList', {
      conversationId: key,
      chatType,
    });
  };
  const mountReviceMessageEventListener = () => {
    /* message 相关监听 */
    EMClient.addEventHandler('messageListen', {
      onTextMessage: function (message) {
        console.log('=== onTextMessage 触发 ===', message);
        pushNewMessage(message);
      }, // 收到文本消息。
      onEmojiMessage: function (message) {
        pushNewMessage(message);
      }, // 收到表情消息。
      onImageMessage: function (message) {
        pushNewMessage(message);
      }, // 收到图片消息。
      onCmdMessage: function (message) {
        console.log('=== onCmdMessage 触发 ===', message);
        // 命令消息可能包含聊天室相关的指令，需要处理
        if (message.chatType === CHAT_TYPE.CHATROOM) {
          // 确保聊天室消息能被正确处理
          pushNewMessage(message);
        }
      }, // 收到命令消息。
      onAudioMessage: function (message) {
        pushNewMessage(message);
      }, // 收到音频消息。
      onLocationMessage: function (message) {
        pushNewMessage(message);
      }, // 收到位置消息。
      onFileMessage: function (message) {
        pushNewMessage(message);
      }, // 收到文件消息。
      onCustomMessage: function (message) {
        pushNewMessage(message);
      }, // 收到自定义消息。
      onVideoMessage: function (message) {
        pushNewMessage(message);
      }, // 收到视频消息。
      onRecallMessage: function (message) {
        otherRecallMessage(message);
      }, // 收到消息撤回回执。
      onModifiedMessage: function (message) {
        otherModifyMessage(message);
      },
    });
    
    console.log('=== 消息监听器已挂载 ===');
  };
  return {
    mountReviceMessageEventListener,
    pushNewMessage,
    otherModifyMessage,
    otherRecallMessage,
  };
};
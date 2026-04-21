import { EMClient } from '../index';
import { CHAT_TYPE } from '../constant';
import { CHANGE_MESSAGE_BODAY_TYPE } from '@/constant';
import { setMessageKey } from '@/utils/handleSomeData';
import store from '@/store';
import { safeSync, wrapImEventHandler } from '@/utils/safeCall';

export const imReviceMessageListener = () => {
  //接收的消息往store中push
  const pushNewMessage = (message) => {
    if (message == null || typeof message !== 'object') {
      console.warn('【IM】忽略空或非对象消息:', message);
      return;
    }
    console.log('【DEBUG】收到消息:', message);

    // 确保消息有chatType
    if (!message.chatType) {
      console.log('【DEBUG】消息缺少chatType，根据to字段推断');
      // 如果消息没有chatType，则根据to字段推断
      if (message.to && (message.to.startsWith('group-') || message.to.startsWith('chatgroup-'))) {
        message.chatType = CHAT_TYPE.GROUP;
        console.log('【DEBUG】推断chatType为GROUP');
      } else if (message.to && message.to.startsWith('chatroom-')) {
        message.chatType = CHAT_TYPE.CHATROOM;
        console.log('【DEBUG】推断chatType为CHATROOM');
      } else {
        message.chatType = CHAT_TYPE.SINGLE;
        console.log('【DEBUG】推断chatType为SINGLE');
      }
    }
    
    console.log('【DEBUG】准备添加消息到消息列表:', message);
    Promise.resolve(store.dispatch('createNewMessage', message)).catch((err) => {
      console.error('[pushNewMessage.createNewMessage]', err);
    });
    Promise.resolve(
      store.dispatch('UsersProfile/processMessageExt', message, { root: true }),
    ).catch((err) => {
      console.error('[pushNewMessage.processMessageExt]', err);
    });
  };
  const pushStreamMessage = (message) => {
    if (message == null || typeof message !== 'object') {
      console.warn('【IM】忽略空流式消息事件:', message);
      return;
    }
    console.log('【Stream Message】收到流式消息分片:', {
      id: message.id,
      chatType: message.chatType,
      from: message.from,
      to: message.to,
      msg: message.msg,
      stream: message.stream,
    });
    pushNewMessage(message);
  };
  //收到他人的撤回指令
  const otherRecallMessage = (message) => {
    if (message == null || typeof message !== 'object') {
      console.warn('【IM】忽略空撤回事件:', message);
      return;
    }
    const { from, to, mid } = message;
    //单对单的撤回to必然为登陆的用户id，群组发起撤回to必然为群组id 所以key可以这样来区分群组或者单人。
    const key = to === EMClient.user ? from : to;

    const chatType = to === EMClient.user ? CHAT_TYPE.SINGLE : CHAT_TYPE.GROUP;
    safeSync('otherRecallMessage.commit', () => {
      store.commit('CHANGE_MESSAGE_BODAY', {
        type: CHANGE_MESSAGE_BODAY_TYPE.RECALL,
        key,
        mid,
      });
    });
    Promise.resolve(
      store.dispatch('updateConversationList', {
        conversationId: key,
        chatType,
      }),
    ).catch((err) => console.error('[otherRecallMessage.updateConversationList]', err));
  };
  //收到消息修改指令
  const otherModifyMessage = (message) => {
    if (message == null || typeof message !== 'object') {
      console.warn('【IM】忽略空编辑消息事件:', message);
      return;
    }
    const { from, to, id: mid, chatType } = message;
    //单对单的撤回to必然为登陆的用户id，群组发起撤回to必然为群组id 所以key可以这样来区分群组或者单人。
    if (!to) return;
    const key = to === EMClient.user ? from : to;
    safeSync('otherModifyMessage.commit', () => {
      store.commit('CHANGE_MESSAGE_BODAY', {
        type: CHANGE_MESSAGE_BODAY_TYPE.MODIFY,
        key,
        mid,
        message,
      });
    });
    Promise.resolve(
      store.dispatch('updateConversationList', {
        conversationId: key,
        chatType,
      }),
    ).catch((err) => console.error('[otherModifyMessage.updateConversationList]', err));
  };
  const mountReviceMessageEventListener = () => {
    /* message 相关监听 */
    EMClient.addEventHandler(
      'messageListen',
      wrapImEventHandler({
      // 全局消息监听器，接收所有类型的消息
      onMessage: function (message) {
        pushNewMessage(message);
      }, // 收到所有类型的消息
      
      onTextMessage: function (message) {
        pushNewMessage(message);
      }, // 收到文本消息。
      onEmojiMessage: function (message) {
        pushNewMessage(message);
      }, // 收到表情消息。
      onImageMessage: function (message) {
        pushNewMessage(message);
      }, // 收到图片消息。
      onCmdMessage: function (message) {
        if (message == null || typeof message !== 'object') return;
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
      onStreamMessage: function (message) {
        pushStreamMessage(message);
      }, // 收到流式消息。
      onGroupMessage: function (message) {
        pushNewMessage(message);
      }, // 收到群组消息。
      onChatRoomMessage: function (message) {
        pushNewMessage(message);
      }, // 收到聊天室消息。
      onRecallMessage: function (message) {
        otherRecallMessage(message);
      }, // 收到消息撤回回执。
      onModifiedMessage: function (message) {
        otherModifyMessage(message);
      },
    }),
    );
  };
  return {
    mountReviceMessageEventListener,
    pushNewMessage,
    pushStreamMessage,
    otherModifyMessage,
    otherRecallMessage,
  };
};

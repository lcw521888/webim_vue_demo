import { EMClient } from '../index';
import { CHAT_TYPE } from '../constant';
import { CHANGE_MESSAGE_BODAY_TYPE } from '@/constant';
import { setMessageKey } from '@/utils/handleSomeData';
import store from '@/store';

export const imReviceMessageListener = () => {
  //接收的消息往store中push
  const pushNewMessage = (message) => {
    // 确保消息有基本属性
    if (!message) {
      console.error('收到无效消息:', message);
      return;
    }
    
    // 确保聊天室消息能被正确处理
    if (message.chatType === CHAT_TYPE.CHATROOM) {
      console.log('事件名称：收到聊天室消息');
      console.log('请求参数：', {
        from: message.from,
        to: message.to,
        chatType: message.chatType,
        msg: message.msg || message.content,
        id: message.id
      });
      console.log('返回值：无');
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
        console.log('事件名称：onTextMessage');
        console.log('请求参数：', message);
        pushNewMessage(message);
        console.log('返回值：无');
      }, // 收到文本消息。
      onEmojiMessage: function (message) {
        console.log('事件名称：onEmojiMessage');
        console.log('请求参数：', message);
        pushNewMessage(message);
        console.log('返回值：无');
      }, // 收到表情消息。
      onImageMessage: function (message) {
        console.log('事件名称：onImageMessage');
        console.log('请求参数：', message);
        pushNewMessage(message);
        console.log('返回值：无');
      }, // 收到图片消息。
      onCmdMessage: function (message) {
        console.log('事件名称：onCmdMessage');
        console.log('请求参数：', message);
        // 处理所有命令消息，包括其他成员的通知
        pushNewMessage(message);
        console.log('返回值：无');
      }, // 收到命令消息。
      onAudioMessage: function (message) {
        console.log('事件名称：onAudioMessage');
        console.log('请求参数：', message);
        pushNewMessage(message);
        console.log('返回值：无');
      }, // 收到音频消息。
      onLocationMessage: function (message) {
        console.log('事件名称：onLocationMessage');
        console.log('请求参数：', message);
        pushNewMessage(message);
        console.log('返回值：无');
      }, // 收到位置消息。
      onFileMessage: function (message) {
        console.log('事件名称：onFileMessage');
        console.log('请求参数：', message);
        pushNewMessage(message);
        console.log('返回值：无');
      }, // 收到文件消息。
      onCustomMessage: function (message) {
        console.log('事件名称：onCustomMessage');
        console.log('请求参数：', message);
        pushNewMessage(message);
        console.log('返回值：无');
      }, // 收到自定义消息。
      onVideoMessage: function (message) {
        console.log('事件名称：onVideoMessage');
        console.log('请求参数：', message);
        pushNewMessage(message);
        console.log('返回值：无');
      }, // 收到视频消息。
      onRecallMessage: function (message) {
        console.log('事件名称：onRecallMessage');
        console.log('请求参数：', message);
        otherRecallMessage(message);
        console.log('返回值：无');
      }, // 收到消息撤回回执。
      onModifiedMessage: function (message) {
        console.log('事件名称：onModifiedMessage');
        console.log('请求参数：', message);
        otherModifyMessage(message);
        console.log('返回值：无');
      },
      // 聊天室事件监听
      onChatroomEvent: function(msg) {
        console.log('事件名称：onChatroomEvent');
        console.log('请求参数：', msg);
        switch(msg.operation) {
          // 解除聊天室一键禁言。聊天室所有成员（除操作者外）会收到该事件。
          case 'unmuteAllMembers':
            break;
          // 聊天室一键禁言。聊天室所有成员（除操作者外）会收到该事件。
          case 'muteAllMembers':
            break;
          // 将成员移出聊天室白名单。被移出的成员收到该事件。
          case 'removeAllowlistMember':
            break;
          // 添加成员至聊天室白名单。被添加的成员收到该事件。
          case 'addUserToAllowlist':
            break;
          // 删除聊天室公告。聊天室的所有成员会收到该事件。
          case 'deleteAnnouncement':
            break;
          // 更新聊天室公告。聊天室的所有成员会收到该事件。
          case 'updateAnnouncement':
            break;
          // 更新聊天室详情。聊天室的所有成员会收到该事件。
          case 'updateInfo':
            break;
          // 解除对指定成员的禁言。被解除禁言的成员会收到该事件。
          case 'unmuteMember':
            break;
          // 有成员被移出聊天室黑名单。被移出的成员会收到该事件。
          case 'unblockMember':
            break;
          // 禁言指定成员。被禁言的成员会收到该事件。
          case 'muteMember':
            break;
          // 移除管理员。被移除的管理员会收到该事件。
          case 'removeAdmin':
            break;
          // 设置管理员。被添加的管理员会收到该事件。
          case 'setAdmin':
            break;
          // 转让聊天室。聊天室全体成员会收到该事件。
          case 'changeOwner':
            break;
          // 解散聊天室。聊天室的所有成员会收到该事件。
          case 'destroy':
            break;
          // 主动退出聊天室。聊天室的所有成员（除退出的成员）会收到该事件。
          case 'memberAbsence':
            break;
          // 有成员被移出聊天室。被踢出聊天室的成员会收到该事件。
          case 'removeMember':
            break;
          // 有用户加入聊天室。聊天室的所有成员（除新成员外）会收到该事件。
          case 'memberPresence':
            break;
          // 有成员修改/设置聊天室自定义属性，聊天室的所有成员会收到该事件。
          case 'updateChatRoomAttributes':
            break;
          // 有成员删除聊天室自定义属性，聊天室所有成员会收到该事件。
          case 'removeChatRoomAttributes':
            break;
          default:
            break;
        }
        console.log('返回值：无');
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
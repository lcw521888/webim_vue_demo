//MiniCore
import MiniCore from 'easemob-websdk/miniCore/miniCore';
import * as contactPlugin from 'easemob-websdk/contact/contact';
import * as groupPlugin from 'easemob-websdk/group/group';
import * as presencePlugin from 'easemob-websdk/presence/presence';
import * as chatroomPlugin from 'easemob-websdk/chatroom/chatroom';
import * as localCachePlugin from 'easemob-websdk/localCache/localCache';
import {
  DEFAULT_EASEMOB_APPKEY,
  DEFAULT_EASEMOB_SOCKET_URL,
  DEFAULT_EASEMOB_REST_URL,
} from '../config';
let miniCore = {};
const IM_IS_OPEN_CUSTOM_SERVER_CONFIG =
  JSON.parse(window.localStorage.getItem('IM_IS_OPEN_CUSTOM_SERVER_CONFIG')) ||
  false;
const webimConfig = window.localStorage.getItem('webimConfig');
const CUSTOM_CONFIG = (webimConfig && JSON.parse(webimConfig)) || {};
const initEMClient = () => {
  // 读取自定义配置（因demo需要自定义配置，非必须）
  const configOptions = {};
  
  if (IM_IS_OPEN_CUSTOM_SERVER_CONFIG) {
    Object.assign(configOptions, {
      appKey: CUSTOM_CONFIG.appKey
        ? CUSTOM_CONFIG.appKey
        : DEFAULT_EASEMOB_APPKEY,
      isHttpDNS: !CUSTOM_CONFIG.isPrivate, //取反isPrivate
      url: CUSTOM_CONFIG.imServer
        ? CUSTOM_CONFIG.imServer
        : DEFAULT_EASEMOB_SOCKET_URL,
      apiUrl: CUSTOM_CONFIG.restServer
        ? CUSTOM_CONFIG.restServer
        : DEFAULT_EASEMOB_REST_URL,
    });
  } else {
    Object.assign(configOptions, {
      appKey: DEFAULT_EASEMOB_APPKEY,
      isHttpDNS: true,
      url: DEFAULT_EASEMOB_SOCKET_URL,
      apiUrl: DEFAULT_EASEMOB_REST_URL,
    });
  }
  miniCore = new MiniCore({ ...configOptions });

  // 添加连接错误处理
  miniCore.addEventHandler('connectionError', {
    onConnected: () => {
      console.log('IM SDK 连接成功');
    },
    onDisconnected: () => {
      console.log('IM SDK 断开连接');
    },
    onConnectError: (error) => {
      console.error('IM SDK 连接错误:', error);
      // 处理401未授权错误
      if (
        error.type === 401 ||
        error.message?.includes('401') ||
        error.message?.includes('Unauthorized')
      ) {
        console.error('连接错误: 未授权，请重新登录');
        // 清除本地存储的登录信息
        localStorage.removeItem('EASEIM_loginUser');
        // 跳转到登录页面
        window.location.href = '/login';
      }
    },
    onWillReconnect: (retryTimes) => {
      console.log(`IM SDK 即将重试连接，第${retryTimes}次`);
    },
    onReconnected: () => {
      console.log('IM SDK 重新连接成功');
    },
  });

  // 添加消息撤回监听
  miniCore.addEventHandler('messageRecall', {
    onRecallMessage: (msg) => {
      console.log(
        '[IM SDK Event] Message Recall Event (onRecallMessage) Triggered',
      );
      console.log('Event Details:', {
        messageId: msg.id,
        from: msg.from,
        to: msg.to,
        chatType: msg.chatType,
        messageType: msg.type,
        ext: msg.ext,
        originalMessage: msg,
      });
      // 发送自定义事件，让Vue应用能够监听并更新状态
      const event = new CustomEvent('hx:messageRecall', { detail: msg });
      window.dispatchEvent(event);
      console.log('[IM SDK Event] Custom Event hx:messageRecall Sent');
    },
  });

  // 添加各种插件
  miniCore.usePlugin(contactPlugin);
  miniCore.usePlugin(groupPlugin);
  miniCore.usePlugin(presencePlugin);
  miniCore.usePlugin(chatroomPlugin);
  miniCore.usePlugin(localCachePlugin, 'localCache');

  return miniCore;
};
initEMClient();

// 包装 Message.create 方法，添加参数验证
if (Object.keys(miniCore).length) {
  // 保存原始方法
  const originalCreateMessage = miniCore.Message.create;

  // 包装方法
  miniCore.Message.create = function (options) {
    console.log('调用 EMClient.Message.create，options:', options);

    // 验证参数
    if (!options) {
      console.error('EMClient.Message.create: 缺少options参数');
      throw new Error('EMClient.Message.create: 缺少options参数');
    }

    if (!options.to || options.to === '') {
      console.error('EMClient.Message.create: options.to 为空', options);
      throw new Error('EMClient.Message.create: options.to 为空');
    }

    // 调用原始方法
    try {
      const message = originalCreateMessage.call(this, options);
      console.log('创建的消息对象:', message);
      return message;
    } catch (error) {
      console.error('EMClient.Message.create 内部错误:', error);
      throw error;
    }
  };

  // 包装 send 方法，添加参数验证
  const originalSendMessage = miniCore.send;
  miniCore.send = function (message) {
    console.log('调用 EMClient.send，message:', message);

    // 验证参数
    if (!message) {
      console.error('EMClient.send: 缺少message参数');
      throw new Error('EMClient.send: 缺少message参数');
    }

    if (!message.to || message.to === '') {
      console.error('EMClient.send: message.to 为空', message);
      throw new Error('EMClient.send: message.to 为空');
    }

    // 调用原始方法
    try {
      const result = originalSendMessage.call(this, message);
      console.log('EMClient.send 返回结果:', result);
      return result;
    } catch (error) {
      console.error('EMClient.send 内部错误:', error);
      throw error;
    }
  };

}
export default miniCore;

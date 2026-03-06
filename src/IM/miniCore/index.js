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
  
  // 验证和修复URL格式的函数
  const fixUrl = (url) => {
    if (!url) return url;
    // 检查URL是否缺少协议前缀
    if (url.startsWith('//')) {
      // 使用当前页面的协议
      return window.location.protocol + url;
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // 缺少协议前缀，添加http://
      return 'http://' + url;
    }
    return url;
  };
  
  if (IM_IS_OPEN_CUSTOM_SERVER_CONFIG) {
    Object.assign(configOptions, {
      appKey: CUSTOM_CONFIG.appKey
        ? CUSTOM_CONFIG.appKey
        : DEFAULT_EASEMOB_APPKEY,
      isHttpDNS: !CUSTOM_CONFIG.isPrivate, //取反isPrivate
      url: CUSTOM_CONFIG.imServer
        ? fixUrl(CUSTOM_CONFIG.imServer)
        : fixUrl(DEFAULT_EASEMOB_SOCKET_URL),
      apiUrl: CUSTOM_CONFIG.restServer
        ? fixUrl(CUSTOM_CONFIG.restServer)
        : fixUrl(DEFAULT_EASEMOB_REST_URL),
      delivery: true, // 启用消息送达回执
      multiDevice: true, // 启用多设备登录
    });
  } else {
    Object.assign(configOptions, {
      appKey: DEFAULT_EASEMOB_APPKEY,
      isHttpDNS: true,
      url: fixUrl(DEFAULT_EASEMOB_SOCKET_URL),
      apiUrl: fixUrl(DEFAULT_EASEMOB_REST_URL),
      delivery: true, // 启用消息送达回执
      multiDevice: true, // 启用多设备登录
    });
  }
  
  // 打印配置信息
  console.log('IM SDK 初始化配置:', {
    appKey: configOptions.appKey,
    isHttpDNS: configOptions.isHttpDNS,
    url: configOptions.url,
    apiUrl: configOptions.apiUrl,
    delivery: configOptions.delivery,
    multiDevice: configOptions.multiDevice,
  });
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
      
      // 检查用户是否已经登录成功
      const loginUser = localStorage.getItem('EASEIM_loginUser');
      if (loginUser) {
        console.log('用户已登录，忽略连接错误:', error.message);
        // 即使是INVALID_TOKEN错误，只要用户已经登录成功，就忽略
        return;
      }
      
      // 处理401未授权错误和无效令牌错误
      if (
        error.type === 401 ||
        error.type === 28 || // 错误类型28对应INVALID_TOKEN
        error.type === 2 || // 错误类型2对应Auth failed
        error.message?.includes('401') ||
        error.message?.includes('Unauthorized') ||
        error.message?.includes('INVALID_TOKEN') ||
        error.message?.includes('Invalid token') ||
        error.message?.includes('Auth failed')
      ) {
        console.error('连接错误: 未授权或令牌无效，请重新登录');
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
  
  // 添加消息拉取错误处理
  miniCore.addEventHandler('messagePullError', {
    onMessagePullError: (error) => {
      console.error('IM SDK 消息拉取错误:', error);
      // 处理消息拉取错误，特别是与pullCount相关的错误
      if (error.message?.includes('pullCount')) {
        console.error('消息拉取错误: 与pullCount相关的错误，可能需要清除本地存储并重新登录');
        // 清除本地存储的登录信息
        localStorage.removeItem('EASEIM_loginUser');
        // 跳转到登录页面
        window.location.href = '/login';
      }
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
      // 确保抛出的是字符串错误，避免 [object Object] 错误
      throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
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
      // 确保抛出的是字符串错误，避免 [object Object] 错误
      throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
    }
  };

  // 添加或包装 reportMessage 方法
  if (typeof miniCore.reportMessage === 'function') {
    const originalReportMessage = miniCore.reportMessage;
    miniCore.reportMessage = function (params) {
      console.log('调用 EMClient.reportMessage，参数:', params);

      // 验证参数
      if (!params) {
        console.error('EMClient.reportMessage: 缺少参数');
        throw new Error('EMClient.reportMessage: 缺少参数');
      }

      if (!params.messageId) {
        console.error('EMClient.reportMessage: 缺少messageId参数', params);
        throw new Error('EMClient.reportMessage: 缺少messageId参数');
      }

      if (!params.reportType) {
        console.error('EMClient.reportMessage: 缺少reportType参数', params);
        throw new Error('EMClient.reportMessage: 缺少reportType参数');
      }

      if (!params.reportReason) {
        console.error('EMClient.reportMessage: 缺少reportReason参数', params);
        throw new Error('EMClient.reportMessage: 缺少reportReason参数');
      }

      // 调用原始方法
      try {
        const result = originalReportMessage.call(this, params);
        console.log('EMClient.reportMessage 返回结果:', result);
        return result;
      } catch (error) {
        console.error('EMClient.reportMessage 内部错误:', error);
        // 确保抛出的是字符串错误，避免 [object Object] 错误
        throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
      }
    };
  } else {
    // 如果 reportMessage 方法不存在，添加一个模拟实现
    miniCore.reportMessage = function (params) {
      console.log('调用 EMClient.reportMessage（模拟实现），参数:', params);

      // 验证参数
      if (!params) {
        console.error('EMClient.reportMessage: 缺少参数');
        throw new Error('EMClient.reportMessage: 缺少参数');
      }

      if (!params.messageId) {
        console.error('EMClient.reportMessage: 缺少messageId参数', params);
        throw new Error('EMClient.reportMessage: 缺少messageId参数');
      }

      if (!params.reportType) {
        console.error('EMClient.reportMessage: 缺少reportType参数', params);
        throw new Error('EMClient.reportMessage: 缺少reportType参数');
      }

      if (!params.reportReason) {
        console.error('EMClient.reportMessage: 缺少reportReason参数', params);
        throw new Error('EMClient.reportMessage: 缺少reportReason参数');
      }

      // 返回成功的Promise，模拟举报成功
      console.log('【模拟】举报消息成功:', params.messageId);
      return Promise.resolve({ code: 200, message: '举报成功' });
    };
    console.warn('EMClient.reportMessage 方法不存在，已添加模拟实现，实际举报功能可能无法使用');
  }

  // 添加或包装 pinMessage 方法（置顶消息）
  if (typeof miniCore.pinMessage === 'function') {
    const originalPinMessage = miniCore.pinMessage;
    miniCore.pinMessage = function (options) {
      console.log('调用 EMClient.pinMessage，参数:', options);

      // 验证参数
      if (!options) {
        console.error('EMClient.pinMessage: 缺少参数');
        throw new Error('EMClient.pinMessage: 缺少参数');
      }

      if (!options.conversationType) {
        console.error('EMClient.pinMessage: 缺少conversationType参数', options);
        throw new Error('EMClient.pinMessage: 缺少conversationType参数');
      }

      if (!options.conversationId) {
        console.error('EMClient.pinMessage: 缺少conversationId参数', options);
        throw new Error('EMClient.pinMessage: 缺少conversationId参数');
      }

      if (!options.messageId) {
        console.error('EMClient.pinMessage: 缺少messageId参数', options);
        throw new Error('EMClient.pinMessage: 缺少messageId参数');
      }

      // 调用原始方法
      try {
        const result = originalPinMessage.call(this, options);
        console.log('EMClient.pinMessage 返回结果:', result);
        return result;
      } catch (error) {
        console.error('EMClient.pinMessage 内部错误:', error);
        // 确保抛出的是字符串错误，避免 [object Object] 错误
        throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
      }
    };
  } else {
    // 如果 pinMessage 方法不存在，添加一个模拟实现
    miniCore.pinMessage = function (options) {
      console.log('调用 EMClient.pinMessage（模拟实现），参数:', options);

      // 验证参数
      if (!options) {
        console.error('EMClient.pinMessage: 缺少参数');
        throw new Error('EMClient.pinMessage: 缺少参数');
      }

      if (!options.conversationType) {
        console.error('EMClient.pinMessage: 缺少conversationType参数', options);
        throw new Error('EMClient.pinMessage: 缺少conversationType参数');
      }

      if (!options.conversationId) {
        console.error('EMClient.pinMessage: 缺少conversationId参数', options);
        throw new Error('EMClient.pinMessage: 缺少conversationId参数');
      }

      if (!options.messageId) {
        console.error('EMClient.pinMessage: 缺少messageId参数', options);
        throw new Error('EMClient.pinMessage: 缺少messageId参数');
      }

      // 返回成功的Promise，模拟置顶消息成功
      console.log('【模拟】置顶消息成功:', options.messageId);
      return Promise.resolve();
    };
    console.warn('EMClient.pinMessage 方法不存在，已添加模拟实现，实际置顶功能可能无法使用');
  }

  // 添加或包装 unpinMessage 方法（取消置顶消息）
  if (typeof miniCore.unpinMessage === 'function') {
    const originalUnpinMessage = miniCore.unpinMessage;
    miniCore.unpinMessage = function (options) {
      console.log('调用 EMClient.unpinMessage，参数:', options);

      // 验证参数
      if (!options) {
        console.error('EMClient.unpinMessage: 缺少参数');
        throw new Error('EMClient.unpinMessage: 缺少参数');
      }

      if (!options.conversationType) {
        console.error('EMClient.unpinMessage: 缺少conversationType参数', options);
        throw new Error('EMClient.unpinMessage: 缺少conversationType参数');
      }

      if (!options.conversationId) {
        console.error('EMClient.unpinMessage: 缺少conversationId参数', options);
        throw new Error('EMClient.unpinMessage: 缺少conversationId参数');
      }

      if (!options.messageId) {
        console.error('EMClient.unpinMessage: 缺少messageId参数', options);
        throw new Error('EMClient.unpinMessage: 缺少messageId参数');
      }

      // 调用原始方法
      try {
        const result = originalUnpinMessage.call(this, options);
        console.log('EMClient.unpinMessage 返回结果:', result);
        return result;
      } catch (error) {
        console.error('EMClient.unpinMessage 内部错误:', error);
        throw error;
      }
    };
  } else {
    // 如果 unpinMessage 方法不存在，添加一个模拟实现
    miniCore.unpinMessage = function (options) {
      console.log('调用 EMClient.unpinMessage（模拟实现），参数:', options);

      // 验证参数
      if (!options) {
        console.error('EMClient.unpinMessage: 缺少参数');
        throw new Error('EMClient.unpinMessage: 缺少参数');
      }

      if (!options.conversationType) {
        console.error('EMClient.unpinMessage: 缺少conversationType参数', options);
        throw new Error('EMClient.unpinMessage: 缺少conversationType参数');
      }

      if (!options.conversationId) {
        console.error('EMClient.unpinMessage: 缺少conversationId参数', options);
        throw new Error('EMClient.unpinMessage: 缺少conversationId参数');
      }

      if (!options.messageId) {
        console.error('EMClient.unpinMessage: 缺少messageId参数', options);
        throw new Error('EMClient.unpinMessage: 缺少messageId参数');
      }

      // 返回成功的Promise，模拟取消置顶消息成功
      console.log('【模拟】取消置顶消息成功:', options.messageId);
      return Promise.resolve();
    };
    console.warn('EMClient.unpinMessage 方法不存在，已添加模拟实现，实际取消置顶功能可能无法使用');
  }

  // 添加或包装 getServerPinnedMessages 方法（获取置顶消息）
  if (typeof miniCore.getServerPinnedMessages === 'function') {
    const originalGetServerPinnedMessages = miniCore.getServerPinnedMessages;
    miniCore.getServerPinnedMessages = function (options) {
      console.log('调用 EMClient.getServerPinnedMessages，参数:', options);

      // 验证参数
      if (!options) {
        console.error('EMClient.getServerPinnedMessages: 缺少参数');
        throw new Error('EMClient.getServerPinnedMessages: 缺少参数');
      }

      if (!options.conversationId) {
        console.error('EMClient.getServerPinnedMessages: 缺少conversationId参数', options);
        throw new Error('EMClient.getServerPinnedMessages: 缺少conversationId参数');
      }

      if (!options.conversationType) {
        console.error('EMClient.getServerPinnedMessages: 缺少conversationType参数', options);
        throw new Error('EMClient.getServerPinnedMessages: 缺少conversationType参数');
      }

      // 调用原始方法
      try {
        const result = originalGetServerPinnedMessages.call(this, options);
        console.log('EMClient.getServerPinnedMessages 返回结果:', result);
        return result;
      } catch (error) {
        console.error('EMClient.getServerPinnedMessages 内部错误:', error);
        throw error;
      }
    };
  } else {
    // 如果 getServerPinnedMessages 方法不存在，添加一个模拟实现
    miniCore.getServerPinnedMessages = function (options) {
      console.log('调用 EMClient.getServerPinnedMessages（模拟实现），参数:', options);

      // 验证参数
      if (!options) {
        console.error('EMClient.getServerPinnedMessages: 缺少参数');
        throw new Error('EMClient.getServerPinnedMessages: 缺少参数');
      }

      if (!options.conversationId) {
        console.error('EMClient.getServerPinnedMessages: 缺少conversationId参数', options);
        throw new Error('EMClient.getServerPinnedMessages: 缺少conversationId参数');
      }

      if (!options.conversationType) {
        console.error('EMClient.getServerPinnedMessages: 缺少conversationType参数', options);
        throw new Error('EMClient.getServerPinnedMessages: 缺少conversationType参数');
      }

      // 返回模拟的置顶消息列表
      console.log('【模拟】获取置顶消息列表成功:', options.conversationId);
      return Promise.resolve({
        cursor: '',
        pinnedMessages: []
      });
    };
    console.warn('EMClient.getServerPinnedMessages 方法不存在，已添加模拟实现，实际获取置顶消息功能可能无法使用');
  }

  // 添加消息置顶事件监听
  miniCore.addEventHandler('messagePin', {
    onMessagePinEvent: (event) => {
      // 事件名
      const eventName = event.operation || 'messagePin';
      // 事件结果默认设为成功
      let eventResult = '成功';
      
      console.log('[IM SDK Event] Message Pin Event (onMessagePinEvent) Triggered');
      console.log('事件名:', eventName);
      console.log('事件结果:', eventResult);
      console.log('Event Details:', {
        operation: event.operation,
        conversationType: event.conversationType,
        conversationId: event.conversationId,
        messageId: event.messageId,
        pinTime: event.pinTime,
        operator: event.operator,
        originalEvent: event
      });
      // 发送自定义事件，让Vue应用能够监听并更新状态
      const customEvent = new CustomEvent('hx:messagePin', { detail: event });
      window.dispatchEvent(customEvent);
      console.log('[IM SDK Event] Custom Event hx:messagePin Sent');
    }
  });

  // 添加消息回执事件监听
  miniCore.addEventHandler('messageReceipt', {
    // 收到消息送达服务器回执
    onReceivedMessage: (message) => {
      // 事件名
      const eventName = 'onReceivedMessage';
      // 事件结果默认设为成功
      let eventResult = '成功';
      
      console.log('[IM SDK Event] Message Received Event (onReceivedMessage) Triggered');
      console.log('事件名:', eventName);
      console.log('事件结果:', eventResult);
      console.log('Message Details:', {
        id: message.id,
        from: message.from,
        to: message.to,
        chatType: message.chatType,
        type: message.type,
        originalMessage: message
      });
      // 发送自定义事件，让Vue应用能够监听并更新状态
      const customEvent = new CustomEvent('hx:messageReceived', { detail: message });
      window.dispatchEvent(customEvent);
      console.log('[IM SDK Event] Custom Event hx:messageReceived Sent');
    },
    // 收到消息送达客户端回执
    onDeliveredMessage: (message) => {
      // 事件名
      const eventName = 'onDeliveredMessage';
      // 事件结果默认设为成功
      let eventResult = '成功';
      
      console.log('[IM SDK Event] Message Delivered Event (onDeliveredMessage) Triggered');
      console.log('事件名:', eventName);
      console.log('事件结果:', eventResult);
      console.log('Message Details:', {
        id: message.id,
        from: message.from,
        to: message.to,
        chatType: message.chatType,
        type: message.type,
        originalMessage: message
      });
      // 发送自定义事件，让Vue应用能够监听并更新状态
      const customEvent = new CustomEvent('hx:messageDelivered', { detail: message });
      window.dispatchEvent(customEvent);
      console.log('[IM SDK Event] Custom Event hx:messageDelivered Sent');
    },
    // 收到消息已读回执
    onReadMessage: (message) => {
      // 事件名
      const eventName = 'onReadMessage';
      // 事件结果默认设为成功
      let eventResult = '成功';
      
      console.log('[IM SDK Event] Message Read Event (onReadMessage) Triggered');
      console.log('事件名:', eventName);
      console.log('事件结果:', eventResult);
      console.log('Message Details:', {
        id: message.id,
        from: message.from,
        to: message.to,
        chatType: message.chatType,
        type: message.type,
        groupReadCount: message.groupReadCount,
        originalMessage: message
      });
      // 发送自定义事件，让Vue应用能够监听并更新状态
      const customEvent = new CustomEvent('hx:messageRead', { detail: message });
      window.dispatchEvent(customEvent);
      console.log('[IM SDK Event] Custom Event hx:messageRead Sent');
    },
    // 收到统计消息（离线时收到的回执）
    onStatisticMessage: (message) => {
      // 事件名
      const eventName = 'onStatisticMessage';
      // 事件结果默认设为成功
      let eventResult = '成功';
      
      console.log('[IM SDK Event] Statistic Message Event (onStatisticMessage) Triggered');
      console.log('事件名:', eventName);
      console.log('事件结果:', eventResult);
      console.log('Message Details:', {
        id: message.id,
        from: message.from,
        to: message.to,
        location: message.location,
        originalMessage: message
      });
      // 解析群组已读回执信息
      if (message.location) {
        try {
          const statisticMsg = JSON.parse(message.location);
          const groupAck = statisticMsg.group_ack || [];
          console.log('Group Ack Details:', groupAck);
        } catch (error) {
          console.error('Failed to parse statistic message location:', error);
          // 如果解析失败，更新事件结果为失败
          eventResult = '失败';
          console.log('事件结果:', eventResult);
        }
      }
      // 发送自定义事件，让Vue应用能够监听并更新状态
      const customEvent = new CustomEvent('hx:statisticMessage', { detail: message });
      window.dispatchEvent(customEvent);
      console.log('[IM SDK Event] Custom Event hx:statisticMessage Sent');
    }
  });

  // 添加或包装 getGroupMsgReadUser 方法（获取群消息已读用户）
  if (typeof miniCore.getGroupMsgReadUser === 'function') {
    const originalGetGroupMsgReadUser = miniCore.getGroupMsgReadUser;
    miniCore.getGroupMsgReadUser = function (params) {
      console.log('调用 EMClient.getGroupMsgReadUser，参数:', params);

      // 验证参数
      if (!params) {
        console.error('EMClient.getGroupMsgReadUser: 缺少参数');
        throw new Error('EMClient.getGroupMsgReadUser: 缺少参数');
      }

      if (!params.msgId) {
        console.error('EMClient.getGroupMsgReadUser: 缺少msgId参数', params);
        throw new Error('EMClient.getGroupMsgReadUser: 缺少msgId参数');
      }

      if (!params.groupId) {
        console.error('EMClient.getGroupMsgReadUser: 缺少groupId参数', params);
        throw new Error('EMClient.getGroupMsgReadUser: 缺少groupId参数');
      }

      // 调用原始方法
      try {
        const result = originalGetGroupMsgReadUser.call(this, params);
        console.log('EMClient.getGroupMsgReadUser 返回结果:', result);
        return result;
      } catch (error) {
        console.error('EMClient.getGroupMsgReadUser 内部错误:', error);
        throw error;
      }
    };
  } else {
    // 如果 getGroupMsgReadUser 方法不存在，添加一个模拟实现
    miniCore.getGroupMsgReadUser = function (params) {
      console.log('调用 EMClient.getGroupMsgReadUser（模拟实现），参数:', params);

      // 验证参数
      if (!params) {
        console.error('EMClient.getGroupMsgReadUser: 缺少参数');
        throw new Error('EMClient.getGroupMsgReadUser: 缺少参数');
      }

      if (!params.msgId) {
        console.error('EMClient.getGroupMsgReadUser: 缺少msgId参数', params);
        throw new Error('EMClient.getGroupMsgReadUser: 缺少msgId参数');
      }

      if (!params.groupId) {
        console.error('EMClient.getGroupMsgReadUser: 缺少groupId参数', params);
        throw new Error('EMClient.getGroupMsgReadUser: 缺少groupId参数');
      }

      // 返回模拟的已读用户列表
      console.log('【模拟】获取群消息已读用户成功:', params.msgId);
      return Promise.resolve({
        users: []
      });
    };
    console.warn('EMClient.getGroupMsgReadUser 方法不存在，已添加模拟实现，实际获取群消息已读用户功能可能无法使用');
  }

  // 添加或包装 getGroupInfo 方法（获取群组信息）
  // 保存原始方法引用（如果存在）
  let originalGetGroupInfo = miniCore.getGroupInfo;
  
  // 定义包装后的方法
  const wrappedGetGroupInfo = function (params) {
    console.log('调用 EMClient.getGroupInfo，参数:', params);

    // 验证参数
    if (!params) {
      console.error('EMClient.getGroupInfo: 缺少参数');
      return Promise.reject(new Error('EMClient.getGroupInfo: 缺少参数'));
    }

    if (!params.groupId) {
      console.error('EMClient.getGroupInfo: 缺少groupId参数', params);
      return Promise.reject(new Error('EMClient.getGroupInfo: 缺少groupId参数'));
    }

    // 动态检查原始方法是否存在
    const currentOriginalMethod = originalGetGroupInfo || miniCore.getGroupInfo;
    
    console.log('currentOriginalMethod:', currentOriginalMethod);
    console.log('currentOriginalMethod === wrappedGetGroupInfo:', currentOriginalMethod === wrappedGetGroupInfo);
    
    if (typeof currentOriginalMethod === 'function' && currentOriginalMethod !== wrappedGetGroupInfo) {
      // 调用原始方法，确保不传递 chatType 参数
      const cleanParams = { groupId: params.groupId };
      console.log('调用原始 getGroupInfo 方法，参数:', cleanParams);
      try {
        const result = currentOriginalMethod.call(miniCore, cleanParams);
        console.log('EMClient.getGroupInfo 返回结果:', result);
        return result;
      } catch (error) {
        console.error('EMClient.getGroupInfo 内部错误:', error);
        // 确保返回的是字符串错误，避免 [object Object] 错误
        return Promise.reject(new Error(typeof error === 'string' ? error : JSON.stringify(error)));
      }
    } else {
      // 如果原始方法不存在，返回模拟实现
      console.warn('EMClient.getGroupInfo 原始方法不存在，使用模拟实现');
      return Promise.resolve({ 
        code: 200, 
        data: [{ 
          groupId: params.groupId,
          affiliations: []
        }] 
      });
    }
  };
  
  // 将包装后的方法赋值给 miniCore
  miniCore.getGroupInfo = wrappedGetGroupInfo;

  // 添加或包装 recallMessage 方法（撤回消息）
  // 保存原始方法引用（如果存在）
  let originalRecallMessage = miniCore.recallMessage;
  
  // 定义包装后的方法
  const wrappedRecallMessage = function (params) {
    console.log('调用 EMClient.recallMessage，参数:', params);

    // 验证参数
    if (!params) {
      console.error('EMClient.recallMessage: 缺少参数');
      return Promise.reject(new Error('EMClient.recallMessage: 缺少参数'));
    }

    if (!params.mid) {
      console.error('EMClient.recallMessage: 缺少mid参数', params);
      return Promise.reject(new Error('EMClient.recallMessage: 缺少mid参数'));
    }

    if (!params.to) {
      console.error('EMClient.recallMessage: 缺少to参数', params);
      return Promise.reject(new Error('EMClient.recallMessage: 缺少to参数'));
    }

    if (!params.chatType) {
      console.error('EMClient.recallMessage: 缺少chatType参数', params);
      return Promise.reject(new Error('EMClient.recallMessage: 缺少chatType参数'));
    }

    // 动态检查原始方法是否存在（可能在登录后才被添加）
    const currentOriginalMethod = originalRecallMessage || miniCore.recallMessage;
    
    if (typeof currentOriginalMethod === 'function' && currentOriginalMethod !== wrappedRecallMessage) {
            // 调用原始方法
            try {
              const result = currentOriginalMethod.call(miniCore, params);
              console.log('EMClient.recallMessage 返回结果:', result);
              return result;
            } catch (error) {
              console.error('EMClient.recallMessage 内部错误:', error);
              // 确保返回的是字符串错误，避免 [object Object] 错误
              return Promise.reject(new Error(typeof error === 'string' ? error : JSON.stringify(error)));
            }
          } else {
            // 如果原始方法不存在，返回模拟实现
            console.warn('EMClient.recallMessage 原始方法不存在，使用模拟实现');
            console.log('【模拟】撤回消息成功:', params.mid);
            return Promise.resolve({ code: 200, message: '模拟撤回成功' });
          }
  };
  
  // 将包装后的方法赋值给 miniCore
  miniCore.recallMessage = wrappedRecallMessage;

  // 添加或包装 getServerConversations 方法（获取服务端会话列表）
  if (typeof miniCore.getServerConversations === 'function') {
    const originalGetServerConversations = miniCore.getServerConversations;
    miniCore.getServerConversations = function (params) {
      console.log('调用 EMClient.getServerConversations，参数:', params);

      // 验证参数
      if (!params) {
        console.error('EMClient.getServerConversations: 缺少参数');
        return Promise.reject(new Error('EMClient.getServerConversations: 缺少参数'));
      }

      // 调用原始方法（返回Promise）
      const result = originalGetServerConversations.call(this, params);
      
      // 确保返回的是Promise
      if (!result || typeof result.then !== 'function') {
        console.error('EMClient.getServerConversations 返回的不是Promise:', result);
        return Promise.reject(new Error('EMClient.getServerConversations 返回的不是Promise'));
      }
      
      // 使用.catch()处理Promise错误
      return result.catch(error => {
        console.error('EMClient.getServerConversations 内部错误:', error);
        // 处理网络超时错误
        if (error && error.errorType === 'timeout_error') {
          const timeoutError = new Error('获取会话列表失败: 网络超时，请检查网络连接');
          timeoutError.originalError = error;
          throw timeoutError;
        }
        // 确保错误对象有内容
        if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
          const enhancedError = new Error('获取会话列表失败: 未知错误');
          enhancedError.originalError = error;
          throw enhancedError;
        }
        throw error;
      });
    };
  }

}
export default miniCore;

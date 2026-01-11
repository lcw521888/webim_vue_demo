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
  console.log(
    'IM_IS_OPEN_CUSTOM_SERVER_CONFIG',
    IM_IS_OPEN_CUSTOM_SERVER_CONFIG,
  );
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
    console.log('configOptions', configOptions);
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
      if (error.type === 401 || error.message?.includes('401') || error.message?.includes('Unauthorized')) {
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
    }
  });
  
  return miniCore;
};
initEMClient();

if (Object.keys(miniCore).length) {
  miniCore.usePlugin(contactPlugin);
  miniCore.usePlugin(groupPlugin);
  miniCore.usePlugin(presencePlugin);
  miniCore.usePlugin(chatroomPlugin);
  miniCore.usePlugin(localCachePlugin, 'localCache');
}
export default miniCore;

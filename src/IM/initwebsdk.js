//引入环信SDK
import EaseChatSDK from 'easemob-websdk';
import {
  DEFAULT_EASEMOB_APPKEY,
  DEFAULT_EASEMOB_SOCKET_URL,
  DEFAULT_EASEMOB_REST_URL,
  fixSocketUrl,
  fixRestUrl,
} from './config';
// 读取自定义配置（因demo需要自定义配置，非必须）
const webimConfig = window.localStorage.getItem('webimConfig');
const CUSTOM_CONFIG = (webimConfig && JSON.parse(webimConfig)) || {};

//存放实例化后所有的方法
// let EaseIMClient = {};
// window.EaseIM = EaseIM = Easemob_SDK;
//实例化环信SDK
/*
 * isHttpDNS： isPrivate为true开启私有化配置则走自有配置的url以及apiUrl，
 * 否则为true就SDK自助获取DNS地址。
 * 【特别注意】如果不需要私有化配置，也就是自己定义url以及apiUrl。isHttpDNS、url、apiUrl，均可不用填写只用填入appKey！SDK内部会进行自动获取！
 **/
const restBase = CUSTOM_CONFIG.restServer
  ? fixRestUrl(CUSTOM_CONFIG.restServer).replace(/\/+$/, '')
  : fixRestUrl(DEFAULT_EASEMOB_REST_URL);
const apiUrlWithPort =
  CUSTOM_CONFIG.restServer && CUSTOM_CONFIG.port
    ? `${restBase}:${String(CUSTOM_CONFIG.port).trim()}`
    : restBase;

const EaseChatClient = new EaseChatSDK.connection({
  appKey: CUSTOM_CONFIG.appKey ? CUSTOM_CONFIG.appKey : DEFAULT_EASEMOB_APPKEY,
  isHttpDNS: !CUSTOM_CONFIG.isPrivate, //取反isPrivate
  url: fixSocketUrl(
    CUSTOM_CONFIG.imServer || DEFAULT_EASEMOB_SOCKET_URL,
  ),
  apiUrl: apiUrlWithPort,
});
//向EaseChatClient下添加构建消息方法。
EaseChatClient.Message = EaseChatSDK.message;

export { EaseChatSDK, EaseChatClient };

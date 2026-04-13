//环信appKey默认配置项
// 须与下方 REST、长连同属控制台同一应用；不一致时 REST 可能成功但 WebSocket 报 Auth failed（type:2）
export const DEFAULT_EASEMOB_APPKEY = 'easemob-demo#sdk111';
// 以下两项须与该 AppKey 在控制台看到的接入地址一致（长连固定 wss，避免被当成 http 再拼一层协议）
export const DEFAULT_EASEMOB_SOCKET_URL =
  'wss://im-api-new-hsb.easemob.com/websocket';
export const DEFAULT_EASEMOB_REST_URL = '//a1-hsb.easemob.com';

/**
 * 长连接地址：禁止对已有 ws/wss 再套 http://（否则会出现 http://wss://...）
 */
export function fixSocketUrl(url) {
  if (!url) return url;
  let u = String(url).trim();
  if (/^wss:\/\//i.test(u) || /^ws:\/\//i.test(u)) return u;
  if (u.startsWith('//')) {
    return (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + u;
  }
  if (u.startsWith('https://')) return 'wss://' + u.slice(8);
  if (u.startsWith('http://')) return 'ws://' + u.slice(7);
  return (
    (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
    u.replace(/^\/+/, '')
  );
}

/** REST 根地址：// 随页面协议；无协议时补 https */
export function fixRestUrl(url) {
  if (!url) return url;
  let u = String(url).trim().replace(/\/+$/, '');
  if (!u) return u;
  if (u.startsWith('//')) return window.location.protocol + u;
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    return 'https://' + u.replace(/^\/+/, '');
  }
  return u;
}

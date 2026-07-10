/**
 * 环信 WebSocket 鉴权失败（常见 { type: 2, message: 'Auth failed' }）：
 * 统一跳转登录并清除本地缓存，避免 dev overlay / 未处理拒绝打扰用户。
 */
let redirectScheduled = false;

export function isImAuthFailedReason(reason) {
  if (reason == null) return false;
  if (typeof reason === 'object' && !(reason instanceof Error)) {
    const msg = String(reason.message ?? '');
    const lower = msg.toLowerCase();
    if (reason.type === 2 && lower.includes('auth')) return true;
    if (reason.type === 28 || reason.type === 401) return true;
    if (msg.includes('Auth failed')) return true;
    if (msg.includes('INVALID_TOKEN')) return true;
    if (lower.includes('invalid token')) return true;
    if (lower.includes('unauthorized')) return true;
    if (lower.includes('not login')) return true;
    return false;
  }
  if (reason instanceof Error) {
    const raw = reason.originalError;
    if (raw && typeof raw === 'object') {
      if (raw.type === 2 || raw.type === 28 || raw.type === 401) return true;
      const rawMsg = String(raw.message ?? '');
      if (
        rawMsg.includes('Auth failed') ||
        rawMsg.includes('INVALID_TOKEN') ||
        rawMsg.toLowerCase().includes('invalid token') ||
        rawMsg.toLowerCase().includes('unauthorized') ||
        rawMsg.toLowerCase().includes('not login')
      ) {
        return true;
      }
    }
    const msg = String(reason.message ?? '');
    if (msg.includes('Auth failed')) return true;
    if (msg.includes('INVALID_TOKEN')) return true;
    if (msg.toLowerCase().includes('invalid token')) return true;
    if (msg.toLowerCase().includes('unauthorized')) return true;
    if (msg.toLowerCase().includes('not login')) return true;
  }
  return false;
}

export function redirectToLoginClearImSession() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname || '';
  try {
    window.localStorage.removeItem('EASEIM_loginUser');
  } catch {
    /* ignore */
  }
  if (path === '/login' || path === '/') {
    return;
  }
  if (redirectScheduled) return;
  redirectScheduled = true;
  window.location.assign('/login');
}

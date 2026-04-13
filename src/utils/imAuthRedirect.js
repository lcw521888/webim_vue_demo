/**
 * 环信 WebSocket 鉴权失败（常见 { type: 2, message: 'Auth failed' }）：
 * 统一跳转登录并清除本地缓存，避免 dev overlay / 未处理拒绝打扰用户。
 */
let redirectScheduled = false;

export function isImAuthFailedReason(reason) {
  if (reason == null) return false;
  if (typeof reason === 'object' && !(reason instanceof Error)) {
    const msg = String(reason.message ?? '');
    if (reason.type === 2 && msg.toLowerCase().includes('auth')) return true;
    if (msg.includes('Auth failed')) return true;
    return false;
  }
  if (reason instanceof Error) {
    const raw = reason.originalError;
    if (raw && typeof raw === 'object' && raw.type === 2) return true;
    if (String(reason.message).includes('Auth failed')) return true;
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

import { sdkErrorToError } from './sdkError';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isAlreadyLoggedInError(err) {
  const e = sdkErrorToError(err);
  const m = String(e.message || '');
  const lower = m.toLowerCase();
  const o = e.originalError;
  return (
    m === 'You are already logged in' ||
    m.includes('already logged on another device') ||
    m === 'The user has logged in.' ||
    lower.includes('the user has logged in') ||
    (o && typeof o === 'object' && o.type === 208)
  );
}

/** 不应盲目重试：已登录、设备数、明确令牌过期 */
function shouldNotRetry(err) {
  const e = sdkErrorToError(err);
  const m = String(e.message || '');
  const o = e.originalError;
  if (isAlreadyLoggedInError(err)) return true;
  if (m.includes('devices is overflow') || m.includes('device limit'))
    return true;
  if (o && typeof o === 'object' && (o.type === 28 || o.type === 2)) return true;
  if (m.includes('Auth failed')) return true;
  return false;
}

/**
 * 首次登录若遇网络抖动 / 长连短暂失败，自动退避重试，避免必须退出再登。
 */
export async function openImWithRetry(emClient, openParams) {
  let lastErr;
  let hasRetriedAfterClose = false;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await emClient.open(openParams);
    } catch (err) {
      lastErr = err;
      if (isAlreadyLoggedInError(err) && !hasRetriedAfterClose) {
        hasRetriedAfterClose = true;
        console.warn('[IM] 检测到本地残留登录态，先关闭连接后重试一次', err);
        try {
          if (typeof emClient.close === 'function') {
            emClient.close();
          }
        } catch (closeError) {
          console.warn('[IM] close 清理本地会话失败，继续后续流程', closeError);
        }
        await sleep(300);
        continue;
      }
      if (shouldNotRetry(err)) {
        throw err;
      }
      if (attempt < MAX_ATTEMPTS - 1) {
        const wait = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[IM] EMClient.open 失败，${wait}ms 后第 ${attempt + 2}/${MAX_ATTEMPTS} 次重试`,
          err,
        );
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

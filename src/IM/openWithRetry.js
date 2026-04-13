import { sdkErrorToError } from './sdkError';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 不应盲目重试：已登录、设备数、明确令牌过期 */
function shouldNotRetry(err) {
  const e = sdkErrorToError(err);
  const m = String(e.message || '');
  const o = e.originalError;
  if (m === 'You are already logged in') return true;
  if (m.includes('already logged on another device')) return true;
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
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await emClient.open(openParams);
    } catch (err) {
      lastErr = err;
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

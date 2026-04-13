/**
 * 环信 Web SDK 常 reject 普通对象（如 { type: 2, message: 'Auth failed' }），
 * 统一转成 Error，便于覆盖层、ElMessage 显示可读文案。
 */
export function sdkErrorToError(error) {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  if (error && typeof error === 'object') {
    const msg =
      error.message ||
      error.msg ||
      error.error_description ||
      error.error ||
      (error.type != null && `type:${error.type}`);
    if (msg) {
      const e = new Error(String(msg));
      e.originalError = error;
      return e;
    }
  }
  try {
    const e = new Error(JSON.stringify(error));
    e.originalError = error;
    return e;
  } catch {
    const e = new Error(String(error));
    e.originalError = error;
    return e;
  }
}

/** type 2 Auth failed 等：给用户看的说明（技术细节见控制台 originalError） */
export function formatImAuthHint(error) {
  const raw = error?.originalError ?? error;
  if (
    raw &&
    typeof raw === 'object' &&
    (raw.type === 2 || String(raw.message).includes('Auth failed'))
  ) {
    return 'IM 鉴权失败：请确认 AppKey 与 REST、长连接地址同属控制台同一应用；账号密码或 Token 是否正确；修改后可在「服务器配置」保存并刷新。';
  }
  return null;
}

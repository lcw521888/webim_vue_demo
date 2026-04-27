let reconnectPromise = null;

function isClientOpened(client) {
  if (!client) return false;
  if (typeof client.isOpened === 'function') {
    try {
      return !!client.isOpened();
    } catch {
      return false;
    }
  }
  return !!client.isOpened;
}

function normalizeLoginSession(session) {
  if (!session || typeof session !== 'object') return null;
  const user = String(session.user || session.username || '').trim();
  const accessToken = String(session.accessToken || '').trim();
  if (!user || !accessToken) return null;
  return {
    username: user.toLowerCase(),
    accessToken,
  };
}

function createNotLoginError(message = '未登录，请重新登录后再发送') {
  const error = new Error(message);
  error.type = 39;
  return error;
}

function extractErrorCode(error) {
  if (!error || typeof error !== 'object') return undefined;
  return error.type ?? error.code ?? error.originalError?.type;
}

function extractErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return String(
    error.message ??
      error.msg ??
      error.reason ??
      error.originalError?.message ??
      '',
  );
}

function isNotLoginError(error) {
  const code = extractErrorCode(error);
  if (code === 39 || code === 28 || code === 401) return true;

  const message = extractErrorMessage(error).toLowerCase();
  if (!message) return false;
  return (
    message.includes('not login') ||
    message.includes('not logged in') ||
    message.includes('未登录') ||
    message.includes('appkey or token error')
  );
}

async function runReconnect(reopen, session) {
  if (!reconnectPromise) {
    reconnectPromise = Promise.resolve().then(() => reopen(session));
    reconnectPromise.finally(() => {
      reconnectPromise = null;
    });
  }
  await reconnectPromise;
}

async function ensureImReadyForSend(options) {
  const {
    client,
    getLoginSession,
    reopen,
    forceReopen = false,
  } = options || {};

  if (!forceReopen && isClientOpened(client)) {
    return false;
  }

  const session = normalizeLoginSession(
    typeof getLoginSession === 'function' ? getLoginSession() : null,
  );

  if (!session) {
    throw createNotLoginError();
  }

  if (typeof reopen !== 'function') {
    throw createNotLoginError();
  }

  await runReconnect(reopen, session);
  return true;
}

async function sendWithReadyCheck(options) {
  const { message, send, recreateMessage } = options || {};

  if (typeof send !== 'function') {
    throw new Error('sendWithReadyCheck: send is required');
  }

  const reopenedBeforeSend = await ensureImReadyForSend(options);
  const messageForFirstSend =
    reopenedBeforeSend && typeof recreateMessage === 'function'
      ? recreateMessage(message)
      : message;

  try {
    return await send(messageForFirstSend);
  } catch (error) {
    if (!isNotLoginError(error)) {
      throw error;
    }
    const reopenedAfterFailure = await ensureImReadyForSend({
      ...options,
      forceReopen: true,
    });
    const retryMessage =
      reopenedAfterFailure && typeof recreateMessage === 'function'
        ? recreateMessage(message)
        : message;
    return send(retryMessage);
  }
}

module.exports = {
  createNotLoginError,
  ensureImReadyForSend,
  isNotLoginError,
  normalizeLoginSession,
  sendWithReadyCheck,
};

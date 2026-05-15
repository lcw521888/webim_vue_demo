function unwrapModifyMessageError(error) {
  if (error && typeof error === 'object' && error.error) {
    return error.error;
  }
  return error;
}

function getModifyMessageErrorText(error) {
  const rawError = unwrapModifyMessageError(error);
  if (rawError instanceof Error) {
    return rawError.message || '';
  }
  if (typeof rawError?.message === 'string') {
    return rawError.message;
  }
  if (typeof rawError === 'string') {
    return rawError;
  }
  return '';
}

function resolveModifyMessageErrorMessage(error) {
  const rawError = unwrapModifyMessageError(error);
  const rawMessage = getModifyMessageErrorText(error);

  if (rawError?.type === 50) {
    return '该消息可编辑次数已达上限';
  }

  if (rawMessage.includes('The message modify function is not activated')) {
    return '聊天室消息编辑当前不可用，请先确认该环境/AppKey已开通消息编辑能力';
  }

  if (rawMessage) {
    return `消息编辑失败：${rawMessage}`;
  }

  return '消息编辑失败请稍后重试';
}

module.exports = {
  unwrapModifyMessageError,
  getModifyMessageErrorText,
  resolveModifyMessageErrorMessage,
};

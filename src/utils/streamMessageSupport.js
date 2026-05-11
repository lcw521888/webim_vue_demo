const STREAM_STATUS_TEXT_MAP = {
  START: '生成开始',
  START_AND_COMPLETE: '单片完成',
  IN_PROGRESS: '生成中',
  COMPLETED: '已完成',
  ERROR: '异常结束',
};

export const STREAM_MIN_SDK_VERSION = '4.19.1';

const normalizeVersion = (version) =>
  String(version || '')
    .split('.')
    .map((item) => Number.parseInt(item, 10) || 0);

export const isSdkVersionAtLeast = (currentVersion, minimumVersion) => {
  const current = normalizeVersion(currentVersion);
  const minimum = normalizeVersion(minimumVersion);
  const maxLength = Math.max(current.length, minimum.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentValue = current[index] || 0;
    const minimumValue = minimum[index] || 0;
    if (currentValue > minimumValue) return true;
    if (currentValue < minimumValue) return false;
  }

  return true;
};

export const isStreamMessage = (message) =>
  !!(message && message.stream && typeof message.stream === 'object');

export const getStreamStatusText = (message) => {
  const status = message?.stream?.status;
  return STREAM_STATUS_TEXT_MAP[status] || '流式消息';
};

export const getStreamStatusDetailText = (message) => {
  if (!isStreamMessage(message)) return '';

  const status = message?.stream?.status;
  const errorType = message?.stream?.errorType;
  const finishReason = message?.stream?.finishReason;

  if (status !== 'ERROR') return '';

  const details = [];

  if (errorType !== undefined && errorType !== null && Number(errorType) !== 0) {
    details.push(`errorType: ${errorType}`);
  }
  if (
    finishReason !== undefined &&
    finishReason !== null &&
    Number(finishReason) !== 0
  ) {
    details.push(`finishReason: ${finishReason}`);
  }

  return details.join(' | ');
};

export const shouldTriggerIncomingMessageEffects = ({
  message,
  existedBefore = false,
}) => {
  if (!isStreamMessage(message)) return true;
  return !existedBefore;
};

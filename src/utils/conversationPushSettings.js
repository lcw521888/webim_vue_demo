export const CONVERSATION_PUSH_REMIND_TYPES = [
  { label: '接收所有离线推送', value: 'ALL' },
  { label: '仅 @ 消息推送', value: 'AT' },
  { label: '不接收离线推送', value: 'NONE' },
];

export function isPushSettingSupportedConversation(conversationType) {
  return (
    conversationType === 'singleChat' ||
    conversationType === 'groupChat' ||
    conversationType === 'chatRoom'
  );
}

export function buildConversationPushSettingParams(conversation, remindType) {
  const conversationId = conversation?.conversationId;
  const type = conversation?.conversationType;

  if (!conversationId || !type) {
    throw new Error('缺少会话 ID 或会话类型');
  }

  return {
    conversationId,
    type,
    options: {
      paramType: 0,
      remindType,
    },
  };
}

export function buildConversationDndDurationParams(
  conversation,
  durationMinutes,
) {
  const conversationId = conversation?.conversationId;
  const type = conversation?.conversationType;
  const duration = Number(durationMinutes);

  if (!conversationId || !type) {
    throw new Error('缺少会话 ID 或会话类型');
  }

  if (!Number.isInteger(duration) || duration < 1 || duration > 10080) {
    throw new Error('免打扰时长必须为 1 到 10080 分钟');
  }

  return {
    conversationId,
    type,
    options: {
      paramType: 1,
      duration: duration * 60 * 1000,
    },
  };
}

export function buildConversationPushQueryParams(conversation) {
  const conversationId = conversation?.conversationId;
  const type = conversation?.conversationType;

  if (!conversationId || !type) {
    throw new Error('缺少会话 ID 或会话类型');
  }

  return {
    conversationId,
    type,
  };
}

export function getConversationPushRemindType(response) {
  const remindType =
    response?.data?.type ||
    response?.data?.remindType ||
    response?.data?.value ||
    response?.type ||
    '';

  return remindType === 'DEFAULT' ? '' : remindType;
}

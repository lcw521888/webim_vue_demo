import { wrapImEventHandler } from '@/utils/safeCall';

export const CHATROOM_EVENT_OPERATIONS = {
  MEMBER_PRESENCE: 'memberPresence',
  MEMBER_ABSENCE: 'memberAbsence',
  DESTROY: 'destroy',
  REMOVE_MEMBER: 'removeMember',
  UNBLOCK_MEMBER: 'unblockMember',
  UPDATE_INFO: 'updateInfo',
  MUTE_ALL_MEMBERS: 'muteAllMembers',
  UNMUTE_ALL_MEMBERS: 'unmuteAllMembers',
  ADD_USER_TO_ALLOWLIST: 'addUserToAllowlist',
  REMOVE_ALLOWLIST_MEMBER: 'removeAllowlistMember',
  UPDATE_ANNOUNCEMENT: 'updateAnnouncement',
  DELETE_ANNOUNCEMENT: 'deleteAnnouncement',
  MUTE_MEMBER: 'muteMember',
  UNMUTE_MEMBER: 'unmuteMember',
  SET_ADMIN: 'setAdmin',
  REMOVE_ADMIN: 'removeAdmin',
  CHANGE_OWNER: 'changeOwner',
  UPDATE_CHATROOM_ATTRIBUTES: 'updateChatRoomAttributes',
  REMOVE_CHATROOM_ATTRIBUTES: 'removeChatRoomAttributes',
};

export const CHATROOM_EVENT_LABELS = {
  [CHATROOM_EVENT_OPERATIONS.MEMBER_PRESENCE]: '成员加入聊天室',
  [CHATROOM_EVENT_OPERATIONS.MEMBER_ABSENCE]: '成员离开聊天室',
  [CHATROOM_EVENT_OPERATIONS.DESTROY]: '聊天室被解散',
  [CHATROOM_EVENT_OPERATIONS.REMOVE_MEMBER]: '成员被移出聊天室',
  [CHATROOM_EVENT_OPERATIONS.UNBLOCK_MEMBER]: '成员被移出黑名单',
  [CHATROOM_EVENT_OPERATIONS.UPDATE_INFO]: '聊天室信息更新',
  [CHATROOM_EVENT_OPERATIONS.MUTE_ALL_MEMBERS]: '开启全员禁言',
  [CHATROOM_EVENT_OPERATIONS.UNMUTE_ALL_MEMBERS]: '解除全员禁言',
  [CHATROOM_EVENT_OPERATIONS.ADD_USER_TO_ALLOWLIST]: '成员加入白名单',
  [CHATROOM_EVENT_OPERATIONS.REMOVE_ALLOWLIST_MEMBER]: '成员移出白名单',
  [CHATROOM_EVENT_OPERATIONS.UPDATE_ANNOUNCEMENT]: '聊天室公告更新',
  [CHATROOM_EVENT_OPERATIONS.DELETE_ANNOUNCEMENT]: '聊天室公告删除',
  [CHATROOM_EVENT_OPERATIONS.MUTE_MEMBER]: '成员被禁言',
  [CHATROOM_EVENT_OPERATIONS.UNMUTE_MEMBER]: '成员解除禁言',
  [CHATROOM_EVENT_OPERATIONS.SET_ADMIN]: '成员被设为管理员',
  [CHATROOM_EVENT_OPERATIONS.REMOVE_ADMIN]: '成员被移除管理员',
  [CHATROOM_EVENT_OPERATIONS.CHANGE_OWNER]: '聊天室所有者变更',
  [CHATROOM_EVENT_OPERATIONS.UPDATE_CHATROOM_ATTRIBUTES]: '聊天室属性更新',
  [CHATROOM_EVENT_OPERATIONS.REMOVE_CHATROOM_ATTRIBUTES]: '聊天室属性删除',
};

export function normalizeChatroomEventRoomId(event) {
  const roomId = event?.chatRoomId ?? event?.roomId ?? event?.id ?? '';
  return roomId === '' || roomId == null ? '' : String(roomId);
}

export function normalizeChatroomEvent(event) {
  const roomId = normalizeChatroomEventRoomId(event);
  return {
    operation: event?.operation || 'unknown',
    roomId,
    from: event?.from ?? event?.userId ?? '',
    to: event?.to ?? event?.newOwner ?? '',
    memberCount: Number(event?.memberCount ?? event?.affiliations_count ?? 0),
    announcement: event?.announcement ?? '',
    attributes: event?.attributes ?? null,
    attributeKeys: event?.attributeKeys ?? event?.attributeKey ?? null,
    ext: event?.ext ?? null,
    raw: event,
  };
}

export function logChatroomEvent(scope, event, extra = {}) {
  const normalized = normalizeChatroomEvent(event);
  const knownOperations = Object.values(CHATROOM_EVENT_OPERATIONS);
  const isKnownEvent = knownOperations.includes(normalized.operation);
  const operationLabel =
    CHATROOM_EVENT_LABELS[normalized.operation] || '未知聊天室事件';
  const logLabel = `[ChatroomSDKEvent:${scope}] 已收到 SDK 聊天室事件｜事件名：${normalized.operation}｜事件：${operationLabel}`;
  const payload = {
    scope,
    eventName: normalized.operation,
    operation: normalized.operation,
    operationLabel,
    roomId: normalized.roomId,
    from: normalized.from,
    to: normalized.to,
    memberCount: normalized.memberCount,
    announcement: normalized.announcement,
    attributeKeys: normalized.attributeKeys,
    attributes: normalized.attributes,
    ext: normalized.ext,
    isKnownEvent,
    timestamp: new Date().toISOString(),
    ...extra,
    rawEvent: normalized.raw,
  };

  if (isKnownEvent) {
    console.groupCollapsed(logLabel);
    console.log('事件来源：SDK onChatroomEvent');
    console.log('接收状态：已收到');
    console.log('事件名：', normalized.operation);
    console.log('事件：', operationLabel);
    console.log('返回值：', normalized.raw);
    console.log('标准化日志：', payload);
    console.groupEnd();
    return;
  }

  console.warn(`${logLabel}`, normalized.raw);
  console.warn(`[ChatroomSDKEvent:${scope}] 标准化日志：`, payload);
}

export function logChatroomActionResult(scope, action, params, result, extra = {}) {
  const logLabel = `[ChatroomAction:${scope}] 接口调用成功｜方法：${action}`;
  const payload = {
    scope,
    action,
    eventReceived: false,
    eventNote:
      '这是接口调用结果日志，不代表已收到 SDK onChatroomEvent；如果没有对应 [ChatroomSDKEvent] 日志，就是未收到该事件。',
    roomId: String(params?.roomId ?? params?.chatRoomId ?? ''),
    from: extra.from ?? '',
    to: extra.to ?? '',
    timestamp: new Date().toISOString(),
    params,
    result,
    ...extra,
  };

  console.groupCollapsed(logLabel);
  console.log('日志类型：接口调用结果');
  console.log('事件接收状态：未收到 SDK 事件，仅记录本次接口返回');
  console.log('方法：', action);
  console.log('方法入参：', params);
  console.log('返回值：', result);
  console.log('标准化日志：', payload);
  console.groupEnd();
}

export function createChatroomEventHandler(scope, handler) {
  return wrapImEventHandler({
    onChatroomEvent: (event) => {
      logChatroomEvent(scope, event);
      handler?.(event, normalizeChatroomEvent(event));
    },
  });
}

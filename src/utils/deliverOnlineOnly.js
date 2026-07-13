import { CHAT_TYPE } from '@/IM/constant';

export const DELIVER_ONLINE_ONLY_VALUE = 'true';

export const supportsDeliverOnlineOnly = (chatType, isChatThread = false) =>
  !isChatThread &&
  (chatType === CHAT_TYPE.SINGLE || chatType === CHAT_TYPE.GROUP);

export const buildDeliverOnlineOnlyOptions = (enabled) =>
  enabled ? { deliverOnlineOnly: DELIVER_ONLINE_ONLY_VALUE } : {};

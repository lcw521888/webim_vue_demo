import { EMClient } from '../index';
import store from '@/store';
import { wrapImEventHandler } from '@/utils/safeCall';
import { CHAT_TYPE } from '../constant';

export const imReactionListener = () => {
  const mountReactionEventListener = () => {
    console.log('[环信 Reaction] 注册 onReactionChange 监听器');
    EMClient.addEventHandler(
      'REACTION',
      wrapImEventHandler({
        onReactionChange: async (reactionMsg) => {
          console.log(
            '%c[环信 Reaction] onReactionChange',
            'color:#f59e0b;font-weight:bold;',
            reactionMsg,
          );
          Promise.resolve(
            store.dispatch('handleReactionChange', reactionMsg),
          ).catch((err) =>
            console.error('[imReactionListener] handleReactionChange', err),
          );

          // 兜底：若某些端返回的 reactions 不完整，则按当前会话类型主动补拉概览。
          const messageId = reactionMsg?.messageId;
          const chatType = reactionMsg?.chatType;
          if (!messageId || !chatType) return;
          const normalizedChatType =
            chatType === CHAT_TYPE.GROUP ? CHAT_TYPE.GROUP : CHAT_TYPE.SINGLE;
          const groupId =
            normalizedChatType === CHAT_TYPE.GROUP ? reactionMsg?.to : undefined;
          Promise.resolve(
            store.dispatch('fetchMessageReactionList', {
              messageId,
              chatType: normalizedChatType,
              groupId,
            }),
          ).catch((err) =>
            console.error('[imReactionListener] fetchMessageReactionList', err),
          );
        },
      }),
    );
  };

  return {
    mountReactionEventListener,
  };
};

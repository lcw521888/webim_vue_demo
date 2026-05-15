import { EMClient } from '../index';
import store from '@/store';
import { wrapImEventHandler } from '@/utils/safeCall';

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
        },
      }),
    );
  };

  return {
    mountReactionEventListener,
  };
};

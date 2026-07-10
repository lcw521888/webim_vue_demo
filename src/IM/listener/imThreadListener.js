import { EMClient } from '../index';
import { wrapImEventHandler } from '@/utils/safeCall';

export const imThreadListener = () => {
  const describeThreadEvent = (threadEvent) => ({
    operation: threadEvent?.operation,
    chatThreadId: threadEvent?.id || threadEvent?.chatThreadId || '',
    threadName: threadEvent?.name || '',
    parentId: threadEvent?.parentId || '',
    messageId: threadEvent?.messageId || '',
    operator: threadEvent?.operator || '',
    userName: threadEvent?.userName || '',
    messageCount: threadEvent?.messageCount ?? '',
    timestamp: threadEvent?.timestamp || '',
    rawEvent: threadEvent,
  });

  const mountThreadEventListener = () => {
    EMClient.addEventHandler(
      'THREAD',
      wrapImEventHandler({
        onChatThreadChange: (threadEvent) => {
          console.log(
            '[Thread Event] onChatThreadChange received',
            describeThreadEvent(threadEvent),
          );
        },
      }),
    );
  };

  return {
    mountThreadEventListener,
  };
};

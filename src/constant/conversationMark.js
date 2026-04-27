export const CONVERSATION_MARK = Object.freeze({
  IMPORTANT: 0,
  NORMAL: 1,
  STAR: 2,
});

export const CONVERSATION_MARK_LABEL_MAP = new Map([
  [CONVERSATION_MARK.IMPORTANT, 'IMPORTANT'],
  [CONVERSATION_MARK.NORMAL, 'NORMAL'],
  [CONVERSATION_MARK.STAR, 'STAR'],
]);

export const hasConversationMark = (marks, mark) =>
  Array.isArray(marks) && marks.includes(mark);

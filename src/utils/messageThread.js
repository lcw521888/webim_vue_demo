export const isThreadRouteQuery = (value) => value === true || value === 'true';

export const getThreadIdFromResponse = (response) =>
  response?.data?.chatThreadId ||
  response?.chatThreadId ||
  response?.data?.threadId ||
  response?.threadId ||
  '';

export const getThreadIdFromMessage = (message) =>
  message?.chatThread?.chatThreadId ||
  message?.chatThread?.id ||
  message?.chatThreadId ||
  '';

export const normalizeThreadMessage = (message) => {
  if (!message || typeof message !== 'object') return message;
  const chatThreadId = getThreadIdFromMessage(message);
  if (!chatThreadId) return message;
  const normalizedMessage = { ...message };
  normalizedMessage.isChatThread = true;
  normalizedMessage.to = chatThreadId;
  normalizedMessage.groupId =
    normalizedMessage.chatThread?.parentId ||
    normalizedMessage.chatThread?.groupId ||
    normalizedMessage.groupId ||
    '';
  return normalizedMessage;
};

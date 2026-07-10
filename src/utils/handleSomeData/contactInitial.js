export const normalizeContactInitial = (displayName, pinyinInitials) => {
  const firstPinyinInitial = String(pinyinInitials || '').trim()[0];
  if (firstPinyinInitial && /^[a-z]$/i.test(firstPinyinInitial)) {
    return firstPinyinInitial.toLowerCase();
  }

  const firstDisplayChar = String(displayName || '').trim()[0];
  if (firstDisplayChar && /^[a-z]$/i.test(firstDisplayChar)) {
    return firstDisplayChar.toLowerCase();
  }

  return ' ';
};

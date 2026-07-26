const DEFAULT_TRANSLATION_TARGET_LANGUAGE = 'zh-CN';
const SDK_TEXT_MESSAGE_TYPE = 'text';
const DEMO_TEXT_MESSAGE_TYPE = 'txt';

function canTranslateMessage(msgBody) {
  return !!(
    msgBody &&
    msgBody.type === DEMO_TEXT_MESSAGE_TYPE &&
    !msgBody.isRecall &&
    typeof msgBody.msg === 'string' &&
    msgBody.msg.trim()
  );
}

function buildTranslateMessageParams(
  msgBody,
  targetLanguage = DEFAULT_TRANSLATION_TARGET_LANGUAGE,
) {
  return {
    message: {
      type: SDK_TEXT_MESSAGE_TYPE,
      body: {
        content: String(msgBody?.msg || '').trim(),
      },
    },
    targetLanguages: [targetLanguage],
  };
}

function getTranslationResults(result) {
  return Array.isArray(result?.translations) ? result.translations : [];
}

function getPrimaryTranslationText(
  result,
  targetLanguage = DEFAULT_TRANSLATION_TARGET_LANGUAGE,
) {
  const translations = getTranslationResults(result);
  const matchedTranslation =
    translations.find((translation) => translation?.to === targetLanguage) ||
    translations[0];
  return typeof matchedTranslation?.text === 'string'
    ? matchedTranslation.text
    : '';
}

module.exports = {
  DEFAULT_TRANSLATION_TARGET_LANGUAGE,
  buildTranslateMessageParams,
  canTranslateMessage,
  getPrimaryTranslationText,
  getTranslationResults,
};

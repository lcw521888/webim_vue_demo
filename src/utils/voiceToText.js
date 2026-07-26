const AUDIO_MESSAGE_TYPE = 'audio';
const SUPPORTED_AUDIO_FORMATS = ['amr', 'mp3', 'pcm'];

function canConvertVoiceToText(msgBody) {
  return !!(
    msgBody &&
    msgBody.type === AUDIO_MESSAGE_TYPE &&
    !msgBody.isRecall &&
    typeof msgBody.url === 'string' &&
    msgBody.url.trim()
  );
}

function normalizeAudioFormat(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase().replace(/^\./, '');
  return SUPPORTED_AUDIO_FORMATS.includes(normalized) ? normalized : '';
}

function getFormatFromPath(value) {
  if (typeof value !== 'string') return '';
  const cleanValue = value.split('#')[0].split('?')[0];
  const match = cleanValue.match(/\.([a-z0-9]+)$/i);
  return normalizeAudioFormat(match?.[1] || '');
}

function getAudioFormat(msgBody) {
  return (
    normalizeAudioFormat(msgBody?.filetype) ||
    getFormatFromPath(msgBody?.filename) ||
    getFormatFromPath(msgBody?.url)
  );
}

function buildVoiceToTextParams(msgBody) {
  const messageBody = {
    ...msgBody,
    type: AUDIO_MESSAGE_TYPE,
    url: String(msgBody?.url || '').trim(),
  };
  const format = getAudioFormat(msgBody);
  return {
    messageBody,
    audioParams: format ? { format } : undefined,
  };
}

function getVoiceToTextResultText(result) {
  return typeof result?.data?.text === 'string' ? result.data.text : '';
}

module.exports = {
  buildVoiceToTextParams,
  canConvertVoiceToText,
  getAudioFormat,
  getVoiceToTextResultText,
};

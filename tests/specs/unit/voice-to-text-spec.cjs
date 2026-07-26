const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildVoiceToTextParams,
  canConvertVoiceToText,
  getVoiceToTextResultText,
} = require('../../../src/utils/voiceToText');

const repoRoot = path.resolve(__dirname, '../../..');

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

test('voice-to-text only allows audio messages with a server url', () => {
  assert.equal(
    canConvertVoiceToText({ type: 'audio', url: 'https://example.com/a.amr' }),
    true,
  );
  assert.equal(canConvertVoiceToText({ type: 'audio', url: '' }), false);
  assert.equal(
    canConvertVoiceToText({ type: 'audio', url: 'https://example.com/a.amr', isRecall: true }),
    false,
  );
  assert.equal(canConvertVoiceToText({ type: 'txt', url: 'https://example.com/a.amr' }), false);
});

test('voice-to-text builds SDK4 voiceMessageToText params with detected audio format', () => {
  assert.deepEqual(
    buildVoiceToTextParams({
      type: 'audio',
      url: 'https://example.com/chatfiles/voice.amr?token=abc',
      filetype: '.amr',
    }),
    {
      messageBody: {
        type: 'audio',
        url: 'https://example.com/chatfiles/voice.amr?token=abc',
        filetype: '.amr',
      },
      audioParams: {
        format: 'amr',
      },
    },
  );

  assert.deepEqual(
    buildVoiceToTextParams({
      type: 'audio',
      url: 'https://example.com/chatfiles/voice.mp3',
    }).audioParams,
    { format: 'mp3' },
  );
});

test('voice-to-text reads SDK4 returned text without fabricating values', () => {
  assert.equal(getVoiceToTextResultText({ data: { text: '你好' } }), '你好');
  assert.equal(getVoiceToTextResultText({ data: { text: '' } }), '');
  assert.equal(getVoiceToTextResultText({}), '');
});

test('voice-to-text UI calls SDK4 real API and surfaces failures', () => {
  const content = read(
    'src/views/Chat/components/Message/components/ChatMessageListItem/index.vue',
  );

  assert.match(content, /EMClient\.voiceMessageToText/);
  assert.match(content, /voiceMessageToTextApi\(messageBody, audioParams\)/);
  assert.match(content, /console\.error\('\[Voice To Text\] voiceMessageToText failed'/);
  assert.doesNotMatch(content, /mock|fake success|模拟成功|兜底成功/i);
});

test('voice-to-text documentation is synced', () => {
  assert.match(read('cases_list.md'), /语音转文字/);
  assert.match(read('.codex/prompts/superpowers.md'), /语音转文字/);
});

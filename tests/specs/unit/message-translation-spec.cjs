const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_TRANSLATION_TARGET_LANGUAGE,
  buildTranslateMessageParams,
  canTranslateMessage,
  getPrimaryTranslationText,
  getTranslationResults,
} = require('../../../src/utils/messageTranslation');

const repoRoot = path.resolve(__dirname, '../../..');

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

test('message translation only allows non-empty text messages', () => {
  assert.equal(canTranslateMessage({ type: 'txt', msg: 'hello' }), true);
  assert.equal(canTranslateMessage({ type: 'txt', msg: '  ' }), false);
  assert.equal(canTranslateMessage({ type: 'img', msg: 'hello' }), false);
  assert.equal(canTranslateMessage({ type: 'txt', msg: 'hello', isRecall: true }), false);
});

test('message translation builds SDK translateMessage params', () => {
  assert.deepEqual(buildTranslateMessageParams({ type: 'txt', msg: ' hello ' }), {
    message: {
      type: 'text',
      body: {
        content: 'hello',
      },
    },
    targetLanguages: [DEFAULT_TRANSLATION_TARGET_LANGUAGE],
  });
});

test('message translation reads returned translations without fabricating values', () => {
  const result = {
    translations: [
      { to: 'en', text: 'hello' },
      { to: 'zh-CN', text: '你好' },
    ],
  };

  assert.deepEqual(getTranslationResults(result), result.translations);
  assert.equal(getPrimaryTranslationText(result), '你好');
  assert.equal(getPrimaryTranslationText({ translations: [] }), '');
});

test('message translation UI calls real SDK API and surfaces failures', () => {
  const content = read(
    'src/views/Chat/components/Message/components/ChatMessageListItem/index.vue',
  );

  assert.match(content, /<el-dropdown-item[\s\S]*翻译[\s\S]*<\/el-dropdown-item>/);
  assert.match(content, /EMClient\.translateMessage/);
  assert.match(content, /EMClient\.chatManager\?\.translateMessage/);
  assert.match(content, /translateMessageApi\(params\)/);
  assert.match(content, /console\.error\('\[Message Translation\] translateMessage failed'/);
  assert.doesNotMatch(content, /mock|fake success|模拟成功|兜底成功/i);
});

test('message translation documentation is synced', () => {
  const casesList = read('cases_list.md');
  const superpowers = read('.codex/prompts/superpowers.md');

  assert.match(casesList, /文本消息翻译/);
  assert.match(superpowers, /文本消息翻译/);
});

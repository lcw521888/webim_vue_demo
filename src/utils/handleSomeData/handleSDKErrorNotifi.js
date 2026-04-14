/* 构建error弹出 */
import { ERROR_MAP_DESCRIPTION } from '@/constant';
import { ElMessage } from 'element-plus';

const BLOCKED_USER_TEXT =
  ERROR_MAP_DESCRIPTION[603]?.blocked ?? '对方已将您加入黑名单！';

function normalizeErrorCode(code) {
  if (code === null || code === undefined || code === '') return code;
  if (typeof code === 'number' && Number.isFinite(code)) return code;
  const s = String(code).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return code;
}

/** 合并 error 上可能出现的字段，供识别「被拉黑」等（避免 type/desc 缺失时既不提示又显示 none） */
function flattenErrorToSearchableString(error) {
  if (!error || typeof error !== 'object') return '';
  const parts = [
    error.message,
    error.msg,
    error.reason,
    typeof error.stack === 'string' ? error.stack : '',
  ];
  const data = error.data;
  if (typeof data === 'string') {
    parts.push(data);
  } else if (data != null && typeof data === 'object') {
    parts.push(
      data.error,
      data.error_description,
      data.message,
      data.desc,
    );
    try {
      parts.push(JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }
  try {
    parts.push(JSON.stringify(error));
  } catch {
    /* ignore */
  }
  return parts.filter((p) => p != null && String(p).trim() !== '').join(' ');
}

/**
 * 根据全文判断是否为「被拉黑 / 黑名单」类错误（单聊优先展示 BLOCKED_USER_TEXT）
 * @returns {'blocked' | 'blacklist' | null}
 */
function resolveBlacklistHintFromText(blob) {
  const raw = String(blob ?? '');
  if (!raw.trim()) return null;
  const t = raw.toLowerCase();

  const isGroupBlacklist =
    t.includes('blacklist') &&
    (t.includes('group') ||
      t.includes('chatgroup') ||
      t.includes('chat room') ||
      t.includes('chatroom'));
  if (isGroupBlacklist) return 'blacklist';

  if (
    t.includes('blocked') ||
    t.includes('blacklist') ||
    t.includes('black_list') ||
    t.includes('in blacklist') ||
    t.includes('in_blacklist') ||
    raw.includes('拉黑')
  ) {
    return 'blocked';
  }
  return null;
}

function isUnusableUserMessage(text) {
  const s = String(text ?? '').trim();
  if (!s) return true;
  return /^(none|null|undefined)$/i.test(s);
}

/**
 * 603：服务端/ SDK 的第二个字段有时是 blocked，有时是整句英文，导致 ERROR_MAP 精确匹配失败。
 */
function resolve603FriendlyMessage(descStr) {
  const m603 = ERROR_MAP_DESCRIPTION[603];
  if (!m603) return BLOCKED_USER_TEXT;
  const raw = String(descStr ?? '').trim();
  if (!raw || raw === 'none') return m603.blocked;

  if (m603[raw]) return m603[raw];
  const lower = raw.toLowerCase();

  if (m603[lower]) return m603[lower];

  if (lower === 'already' || lower.includes('already join')) {
    return m603.already;
  }

  if (lower.includes('blacklist')) {
    if (
      lower.includes('group') ||
      lower.includes('chatgroup') ||
      lower.includes('chat room') ||
      lower.includes('chatroom')
    ) {
      return m603.blacklist;
    }
    return m603.blocked;
  }

  if (
    lower === 'blocked' ||
    lower.includes('blocked') ||
    lower.includes('block list') ||
    lower.includes('in the blacklist') ||
    lower.includes('you are in') ||
    raw.includes('拉黑')
  ) {
    return m603.blocked;
  }

  return m603.blocked;
}

/**
 * 发送消息失败时统一从 error 上取 type / message / data；全文识别拉黑，避免出现 none / 不提示
 */
export function notifySdkSendError(error) {
  const collected = flattenErrorToSearchableString(error);
  const hint = resolveBlacklistHintFromText(collected);
  if (hint) {
    handleSDKErrorNotifi(603, hint);
    return;
  }

  if (!error || typeof error !== 'object') {
    handleSDKErrorNotifi(0, 'none');
    return;
  }

  const code = normalizeErrorCode(error.type ?? error.code);
  let desc = error.message;

  const data = error.data;
  if (data != null) {
    if (typeof data === 'object') {
      desc =
        data.error ??
        data.error_description ??
        data.message ??
        desc;
    } else if (typeof data === 'string') {
      try {
        const j = JSON.parse(data);
        desc = j.error ?? j.error_description ?? desc ?? data;
      } catch {
        desc = desc || data;
      }
    }
  }

  handleSDKErrorNotifi(code, desc ?? 'none', error);
}

function finalizeDisplayMessage(message, codeNum, errorDescStr, extraBlacklistHint) {
  if (!isUnusableUserMessage(message)) {
    return String(message).trim();
  }

  if (extraBlacklistHint === 'blacklist') {
    return ERROR_MAP_DESCRIPTION[603]?.blacklist ?? BLOCKED_USER_TEXT;
  }
  if (extraBlacklistHint === 'blocked') {
    return BLOCKED_USER_TEXT;
  }

  if (codeNum === 603) {
    return resolve603FriendlyMessage(errorDescStr);
  }

  const hint = resolveBlacklistHintFromText(errorDescStr);
  if (hint === 'blacklist') {
    return ERROR_MAP_DESCRIPTION[603]?.blacklist ?? BLOCKED_USER_TEXT;
  }
  if (hint === 'blocked') {
    return BLOCKED_USER_TEXT;
  }

  const map = ERROR_MAP_DESCRIPTION[codeNum];
  if (map?.none) return map.none;
  if (errorDescStr === 'none' || isUnusableUserMessage(errorDescStr)) {
    return ERROR_MAP_DESCRIPTION[0]?.none ?? '操作失败，请稍后重试';
  }
  return String(errorDescStr).trim() || '操作失败，请稍后重试';
}

export default function handleSDKErrorNotifi(code, errorDesc = '', sourceError) {
  const codeNum = normalizeErrorCode(code);
  const extraBlacklistHint = sourceError
    ? resolveBlacklistHintFromText(flattenErrorToSearchableString(sourceError))
    : null;

  if (codeNum === 508) {
    errorDesc = 'moderation';
  }
  if (codeNum === 507) {
    errorDesc = 'muted';
  }

  let errorDescStr;
  if (typeof errorDesc === 'object' && errorDesc !== null) {
    try {
      errorDescStr = JSON.stringify(errorDesc);
    } catch {
      errorDescStr = String(errorDesc);
    }
  } else if (errorDesc === null || errorDesc === undefined) {
    errorDescStr = '';
  } else {
    errorDescStr = String(errorDesc);
  }

  const map = ERROR_MAP_DESCRIPTION[codeNum];
  let message = map && map[errorDescStr];

  if (!message && codeNum === 603) {
    message = resolve603FriendlyMessage(errorDescStr);
  }

  if (!message && map) {
    const lower = errorDescStr.toLowerCase();
    message = map[lower];
  }

  if (!message && errorDescStr === 'none' && map && map.none) {
    message = map.none;
  }

  if (!message) {
    message = errorDescStr;
  }

  message = finalizeDisplayMessage(
    message,
    codeNum,
    errorDescStr,
    extraBlacklistHint,
  );

  try {
    ElMessage({
      title: 'Easemob SDK Error',
      message,
      type: 'error',
      center: true,
    });
  } catch (e) {
    console.error('[handleSDKErrorNotifi] ElMessage 失败:', e, message);
  }
}

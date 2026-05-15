import { ElMessage } from 'element-plus';

function normalizeRuntimeMessage(error, fallbackMessage = '操作失败，请稍后重试') {
  if (!error) return fallbackMessage;
  if (typeof error === 'string') return error || fallbackMessage;
  const message =
    error.message ||
    error.msg ||
    error.reason ||
    error.error_description ||
    error.error;
  return String(message || fallbackMessage).trim() || fallbackMessage;
}

export function notifyRuntimeError(error, fallbackMessage) {
  const message = normalizeRuntimeMessage(error, fallbackMessage);
  try {
    ElMessage({
      message,
      type: 'error',
      center: true,
    });
  } catch (notifyError) {
    console.error('[notifyRuntimeError] ElMessage 失败:', notifyError, message);
  }
}

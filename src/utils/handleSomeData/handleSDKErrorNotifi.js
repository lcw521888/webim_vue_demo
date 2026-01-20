/* 构建error弹出 */
import { ERROR_MAP_DESCRIPTION } from '@/constant';
import { ElMessage } from 'element-plus';

export default function (code, errorDesc = '') {
  //针对触发Moderation的消息做特别处理
  if (code === 508) {
    errorDesc = 'moderation';
  }
  if (code === 507) {
    errorDesc = 'muted';
  }
  
  // 确保errorDesc是字符串，如果是对象则转换为JSON字符串
  let errorDescStr = errorDesc;
  if (typeof errorDesc === 'object' && errorDesc !== null) {
    try {
      errorDescStr = JSON.stringify(errorDesc);
    } catch (e) {
      errorDescStr = String(errorDesc);
    }
  } else if (errorDesc === null || errorDesc === undefined) {
    errorDescStr = '未知错误';
  } else {
    errorDescStr = String(errorDesc);
  }
  
  const message = 
    (ERROR_MAP_DESCRIPTION[code] && ERROR_MAP_DESCRIPTION[code][errorDescStr]) ||
    errorDescStr;

  ElMessage({
    title: 'Easemob SDK Error',
    message: message,
    type: 'error',
    center: true,
  });
}

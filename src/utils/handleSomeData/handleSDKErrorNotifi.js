/* 构建error弹出 */
import { ERROR_MAP_DESCRIPTION } from '@/constant';
import { ElMessage } from 'element-plus';
import router from '@/router';

export default function (code, errorDesc = '') {
  //针对触发Moderation的消息做特别处理
  if (code === 508) {
    errorDesc = 'moderation';
  }
  if (code === 507) {
    errorDesc = 'muted';
  }
  
  // 处理未授权错误（401）
  if (code === 401 || errorDesc.includes('401') || errorDesc.includes('Unauthorized')) {
    ElMessage({
      title: '登录过期',
      message: '登录已过期或未授权，请重新登录',
      type: 'error',
      center: true,
    });
    // 清除本地存储的登录信息
    localStorage.removeItem('EASEIM_loginUser');
    // 跳转到登录页面
    router.push('/login');
    return;
  }
  
  // 特殊处理corrupt access token错误
  if (code === 17 && errorDesc.includes('corrupt access token')) {
    ElMessage({
      title: '登录过期',
      message: '登录令牌已损坏或过期，请重新登录',
      type: 'error',
      center: true,
    });
    // 清除本地存储的登录信息
    localStorage.removeItem('EASEIM_loginUser');
    // 跳转到登录页面
    router.push('/login');
    return;
  }
  
  const message = 
    (ERROR_MAP_DESCRIPTION[code] && ERROR_MAP_DESCRIPTION[code][errorDesc]) ||
    errorDesc;

  ElMessage({
    title: 'Easemob SDK Error',
    message: message,
    type: 'error',
    center: true,
  });
}

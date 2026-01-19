<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { mountAllEMListener } from '@/IM/listener';
import { EMClient } from '@/IM';
import ring from '@/assets/ring.mp3';
import { ElMessage } from 'element-plus';
// 导入调试工具
import { enableEMClientDebug } from '@/utils/debugSDK';
// 导入全局错误处理程序
import '@/utils/globalErrorHandler';
// 导入播放铃声钩子
import { usePlayRing } from '@/hooks';
// 导入事件发射器
import eventEmitter from '@/utils/eventEmitter';

// 启用EMClient调试
enableEMClientDebug();

/* 【重要】挂载IM相关监听回调。 */
mountAllEMListener();

/* 重新登陆 */
//读取本地EASEIM_loginUser
const EASEIM_loginUser = window.localStorage.getItem('EASEIM_loginUser');
const loginUserFromStorage = JSON.parse(EASEIM_loginUser) || {};

const handleRelogin = async () => {
  try {
    await EMClient.open({
      username: loginUserFromStorage.user,
      accessToken: loginUserFromStorage.accessToken,
    });
  } catch (error) {
    // 忽略"You are already logged in"错误
    if (error.message !== 'You are already logged in') {
      ElMessage({
        type: 'error',
        center: true,
        message: error.message,
      });
    } else {
      console.log('用户已登录，忽略重复登录错误');
    }
  }
};

if (loginUserFromStorage?.user && loginUserFromStorage?.accessToken) {
  handleRelogin();
}

// 初始化播放铃声功能
const { isOpenPlayRing, playRing } = usePlayRing();

// 监听新消息事件，播放提示音
const handleNewMessage = (message) => {
  // 只有当消息不是自己发送的时候，才播放铃声
  if (message.from !== EMClient.user && isOpenPlayRing.value) {
    playRing();
  }
};

// 添加事件监听器
onMounted(() => {
  eventEmitter.on('newMessage', handleNewMessage);
});

// 移除事件监听器
onUnmounted(() => {
  eventEmitter.off('newMessage', handleNewMessage);
});
</script>
<template>
  <router-view v-slot="{ Component }">
    <transition
      name="slide-fade"
      mode="out-in"
      :duration="{ enter: 500, leave: 300 }"
    >
      <component :is="Component" />
    </transition>
  </router-view>
  <!-- 铃声标签 -->
  <audio id="ring" :src="ring" controls hidden></audio>
</template>

<style type="scss">
@import './styles/reset/reset.css';
@import './styles/iconfont/iconfont.css';

/* .slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0.3;
}

.slide-fade-enter-to,
.slide-fade-leave-from {
  opacity: 1;
} */
</style>

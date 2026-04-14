<template>
  <input
    ref="uploadFiles"
    type="file"
    style="display: none"
    @change="sendFilesMessages"
    single
  />
</template>

<script setup>
import { ref, toRefs } from 'vue';
import { EMClient } from '@/IM';
import { MESSAGE_TYPE, CHAT_TYPE } from '@/IM/constant';
import { notifySdkSendError } from '@/utils/handleSomeData';
import { useUserInfoExt } from '@/hooks';
import store from '@/store';
import { ElMessage } from 'element-plus';
const props = defineProps({
  chatType: {
    type: String,
    default: CHAT_TYPE.SINGLE,
    required: true,
  },
  targetId: {
    type: String,
    default: '',
    required: true,
  },
});
const { chatType, targetId } = toRefs(props);
const emit = defineEmits(['onStartLoading', 'onLoadending']);
//选择文件
const uploadFiles = ref(null);
const openChooseFiles = () => {
  uploadFiles.value.click();
};
//发送文件
const { setUserInfoExt } = useUserInfoExt();
const sendFilesMessages = async () => {
  //验证targetId是否有效
  if (!targetId.value || targetId.value === '') {
    console.error('发送文件消息失败: 缺少目标ID');
    ElMessage.error('发送文件消息失败: 请先选择聊天对象');
    return;
  }

  const commonFile = uploadFiles.value.files[0];
  if (!commonFile) {
    return;
  }

  // 增加文件大小检查，避免发送过大文件触发服务器413错误
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  if (commonFile.size > MAX_FILE_SIZE) {
    ElMessage.error('文件大小不能超过100MB');
    if (uploadFiles.value) {
      uploadFiles.value.value = null;
    }
    return;
  }

  const file = {
    data: commonFile, // file 对象。
    filename: commonFile.name, //文件名称。
    filetype: commonFile.type, //文件类型。
    size: commonFile.size,
  };

  const msgOptions = {
    type: MESSAGE_TYPE.FILE,
    from: EMClient.user,
    to: targetId.value,
    chatType: chatType.value,
    file: file,
    onFileUploadError: (error) => {
      console.error('文件上传失败:', error);
      if (
        error?.type === 413 ||
        error?.data?.error === 'Request Entity Too Large'
      ) {
        ElMessage.error('文件大小超过服务器限制');
      } else {
        notifySdkSendError(error);
      }
      emit('onLoadending');
    },
    onFileUploadProgress: (e) => {
      // 图片文件上传进度。
      console.log('上传进度:', e);
      emit('onStartLoading');
    },
    onFileUploadComplete: () => {
      // 上传成功。
      emit('onLoadending');
    },
  };
  //在消息体内携带该用户的昵称头像信息
  setUserInfoExt(msgOptions);
  try {
    const msg = EMClient.Message.create(msgOptions);
    const { message } = await EMClient.send(msg);
    console.log('message', message);
    store.dispatch('senedShowTypeMessage', { ...message });
    } catch (error) {
      notifySdkSendError(error);
    } finally {
    if (uploadFiles.value) {
      uploadFiles.value.value = null;
    }
  }
};

defineExpose({
  openChooseFiles,
});
</script>

<style lang="scss" scoped></style>

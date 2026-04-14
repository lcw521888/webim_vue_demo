<script setup>
import { toRefs, computed } from 'vue';
import { onLineStatus } from '@/constant';

/* props */
const props = defineProps({
  userStatus: {
    type: Object,
    required: true,
    default: () => ({}),
  },
});
const { userStatus } = toRefs(props);
/* 单聊用户在线状态：优先展示对方发布的 presence（ext/description），再回退到设备在线数 */
const userInfoStatus = computed(() => {
  const statusObj = {
    ext: '',
    style: '',
    label: '',
    onlineDeviceCount: 0,
    deviceType: '',
    showDevicePrefix: true,
  };
  const onlineStatus = [];
  const offlineStatus = [];
  if (
    userStatus.value &&
    userStatus.value.statusDetails &&
    userStatus.value.statusDetails.length > 0
  ) {
    userStatus.value.statusDetails.map((i) => {
      if (i.status === 0) {
        return offlineStatus.push(i);
      }
      if (i.status === 1) {
        return onlineStatus.push(i);
      }
    });
  }
  const ext = userStatus.value?.ext || '';
  statusObj.ext = ext;
  statusObj.onlineDeviceCount = onlineStatus.length;
  if (onlineStatus.length === 1) {
    statusObj.deviceType = onlineStatus[0].device.split('_')[0];
  }

  const preset = ext && onLineStatus[ext];
  if (preset) {
    statusObj.style = preset.style;
    statusObj.label = preset.label;
    statusObj.showDevicePrefix = ext === 'Online';
    return statusObj;
  }
  if (ext) {
    statusObj.style = onLineStatus.Online.style;
    statusObj.label = ext;
    statusObj.showDevicePrefix = onlineStatus.length > 0;
    return statusObj;
  }

  if (onlineStatus.length > 0) {
    statusObj.style = onLineStatus.Online.style;
    statusObj.label = onLineStatus.Online.label;
    return statusObj;
  }
  if (offlineStatus.length > 0 && onlineStatus.length === 0) {
    statusObj.style = onLineStatus.Offline.style;
    statusObj.label = onLineStatus.Offline.label;
    statusObj.showDevicePrefix = false;
  }

  return statusObj;
});
</script>
<template>
  <div class="user_status_box">
    <span class="status_icon" :style="userInfoStatus.style"></span>
    <span class="os_type">{{
      !userInfoStatus.showDevicePrefix
        ? userInfoStatus.label
        : userInfoStatus.onlineDeviceCount > 1
          ? `多设备${userInfoStatus.label}`
          : `${(userInfoStatus.deviceType || '').toUpperCase()}${userInfoStatus.label}`
    }}</span>
  </div>
</template>

<style lang="scss" scoped>
.user_status_box {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  width: 100px;
  height: 100%;
  font-size: 7px;

  .status_icon {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin: 0 3px;
  }
}
</style>

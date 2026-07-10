<script setup>
import { computed } from 'vue';
import ConversationDndSwitch from '@/components/ConversationDndSwitch';
import { useGetUserMapInfo } from '@/hooks';
import {
  Bell,
  Delete,
  EditPen,
  List,
  User,
  UserFilled,
} from '@element-plus/icons-vue';

const props = defineProps({
  userId: {
    type: String,
    required: true,
  },
  isInBlackList: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'setRemark',
  'addBlackList',
  'removeBlackList',
  'openBlackList',
  'clearMessages',
  'deleteContact',
]);

const { getContactsNickNameById, getUserDisplayAvatarById } = useGetUserMapInfo();
const displayName = computed(() => getContactsNickNameById(props.userId));
const avatarUrl = computed(() => getUserDisplayAvatarById(props.userId));
</script>

<template>
  <div class="single_chat_details">
    <div class="single_chat_profile">
      <el-avatar class="single_chat_avatar" :src="avatarUrl" shape="square">
        {{ displayName || userId }}
      </el-avatar>
      <div class="single_chat_user_id">用户ID: {{ userId }}</div>
    </div>

    <div class="single_chat_action_list">
      <div class="single_chat_action_item" @click="emit('setRemark')">
        <el-icon class="single_chat_action_icon"><User /></el-icon>
        <span class="single_chat_action_label">备注</span>
        <el-icon class="single_chat_action_more"><EditPen /></el-icon>
      </div>
      <div class="single_chat_action_item">
        <el-icon class="single_chat_action_icon"><Bell /></el-icon>
        <ConversationDndSwitch
          class="single_chat_dnd_switch"
          label="消息免打扰"
          :conversation-id="userId"
          conversation-type="singleChat"
        />
      </div>
      <div
        class="single_chat_action_item"
        @click="
          isInBlackList ? emit('removeBlackList') : emit('addBlackList')
        "
      >
        <el-icon class="single_chat_action_icon"><UserFilled /></el-icon>
        <span class="single_chat_action_label">{{
          isInBlackList ? '移出黑名单' : '加入黑名单'
        }}</span>
        <el-switch :model-value="isInBlackList" />
      </div>
      <div class="single_chat_action_item" @click="emit('openBlackList')">
        <el-icon class="single_chat_action_icon"><List /></el-icon>
        <span class="single_chat_action_label">黑名单列表</span>
        <el-icon class="single_chat_action_more"><EditPen /></el-icon>
      </div>
      <div class="single_chat_action_item" @click="emit('clearMessages')">
        <el-icon class="single_chat_action_icon"><Delete /></el-icon>
        <span class="single_chat_action_label">清空聊天记录</span>
      </div>
      <div
        class="single_chat_action_item danger"
        @click="emit('deleteContact')"
      >
        <el-icon class="single_chat_action_icon"><UserFilled /></el-icon>
        <span class="single_chat_action_label">删除联系人</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.single_chat_details {
  height: 100%;
  background: #f7f8fa;
  color: #111;
}

.single_chat_profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 34px 24px 24px;
  background: #fff;
}

.single_chat_avatar {
  width: 116px;
  height: 116px;
  border-radius: 6px;
  font-size: 44px;
  background: #2ea8f7;
}

.single_chat_user_id {
  margin-top: 18px;
  font-size: 14px;
  color: #9aa1aa;
}

.single_chat_action_list {
  background: #fff;
}

.single_chat_action_item {
  display: flex;
  align-items: center;
  min-height: 68px;
  padding: 0 24px;
  cursor: pointer;
  border-bottom: 1px solid #e5e7eb;
}

.single_chat_action_icon {
  width: 34px;
  margin-right: 12px;
  font-size: 22px;
  color: #3f4750;
}

.single_chat_action_label {
  flex: 1;
  font-size: 17px;
  font-weight: 600;
}

.single_chat_action_more {
  font-size: 20px;
  color: #3f4750;
}

.single_chat_dnd_switch {
  flex: 1;
}

.single_chat_dnd_switch :deep(.conversation_dnd_label) {
  font-size: 17px;
  font-weight: 600;
  color: #111;
}

.danger {
  margin-top: 10px;
  color: #ff1744;
}
</style>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { ElMessage } from 'element-plus';
import { getConversationPushRemindType } from '@/utils/conversationPushSettings';

const props = defineProps({
  conversationId: {
    type: String,
    required: true,
  },
  conversationType: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: '消息免打扰',
  },
  showLabel: {
    type: Boolean,
    default: true,
  },
});

const store = useStore();
const loading = ref(false);
const enabled = ref(false);
const currentSettingRaw = ref(null);

const conversation = computed(() => ({
  conversationId: props.conversationId,
  conversationType: props.conversationType,
}));

const refreshDndSetting = async () => {
  if (!props.conversationId || !props.conversationType) return;
  loading.value = true;
  try {
    const result = await store.dispatch(
      'getConversationPushSetting',
      conversation.value,
    );
    currentSettingRaw.value = result;
    enabled.value = getConversationPushRemindType(result) === 'NONE';
  } catch (error) {
    console.error('[Conversation DND] get setting failed', {
      conversation: conversation.value,
      error,
    });
    ElMessage.error(error?.message || '获取消息免打扰设置失败');
  } finally {
    loading.value = false;
  }
};

const changeDndSetting = async (nextEnabled) => {
  if (!props.conversationId || !props.conversationType) return;
  loading.value = true;
  try {
    if (nextEnabled) {
      await store.dispatch('setConversationPushSetting', {
        conversation: conversation.value,
        remindType: 'NONE',
      });
    } else {
      await store.dispatch('clearConversationPushSetting', conversation.value);
    }
    enabled.value = nextEnabled;
    ElMessage.success(nextEnabled ? '消息免打扰已开启' : '消息免打扰已关闭');
    await refreshDndSetting();
  } catch (error) {
    console.error('[Conversation DND] set setting failed', {
      conversation: conversation.value,
      nextEnabled,
      currentSettingRaw: currentSettingRaw.value,
      error,
    });
    ElMessage.error(error?.message || '消息免打扰设置失败');
  } finally {
    loading.value = false;
  }
};

onMounted(refreshDndSetting);

watch(
  () => [props.conversationId, props.conversationType],
  refreshDndSetting,
);
</script>

<template>
  <div class="conversation_dnd_row">
    <span v-if="showLabel" class="conversation_dnd_label">{{ label }}</span>
    <el-switch
      :model-value="enabled"
      :loading="loading"
      @change="changeDndSetting"
    />
  </div>
</template>

<style lang="scss" scoped>
.conversation_dnd_row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 40px;
}

.conversation_dnd_label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}
</style>

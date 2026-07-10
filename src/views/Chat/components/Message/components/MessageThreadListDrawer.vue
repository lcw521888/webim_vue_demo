<script setup>
import { ref, toRefs, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { ElMessage } from 'element-plus';
import { CHAT_TYPE } from '@/IM/constant';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  groupId: {
    type: String,
    default: '',
    required: true,
  },
});

const emit = defineEmits(['update:modelValue']);
const { modelValue, groupId } = toRefs(props);
const router = useRouter();
const store = useStore();

const loading = ref(false);
const threads = ref([]);
const cursor = ref('');
const hasMore = ref(false);
const loadError = ref('');
const pageSize = 20;

const getThreadId = (thread) =>
  thread?.chatThreadId || thread?.id || thread?.threadId || '';

const getThreadName = (thread) =>
  thread?.name || thread?.chatThreadName || thread?.threadName || getThreadId(thread);

const normalizeThreadListResponse = (response) => {
  const entities =
    response?.entities ||
    response?.data?.entities ||
    response?.data?.list ||
    response?.list ||
    [];
  return {
    list: Array.isArray(entities) ? entities : [],
    cursor: response?.cursor || response?.data?.cursor || '',
  };
};

const loadThreads = async (loadMore = false) => {
  if (!groupId.value) return;
  if (loading.value) return;
  loading.value = true;
  try {
    loadError.value = '';
    const response = await store.dispatch('fetchMessageThreads', {
      parentId: groupId.value,
      cursor: loadMore ? cursor.value : '',
      pageSize,
    });
    const result = normalizeThreadListResponse(response);
    threads.value = loadMore ? [...threads.value, ...result.list] : result.list;
    cursor.value = result.cursor;
    hasMore.value = !!result.cursor;
  } catch (error) {
    loadError.value = error?.message || '获取群组子区列表失败';
    console.error('[Thread] getChatThreads UI failed', {
      parentId: groupId.value,
      cursor: loadMore ? cursor.value : '',
      pageSize,
      error,
    });
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
};

const closeDrawer = () => {
  emit('update:modelValue', false);
};

const openThread = (thread) => {
  const threadId = getThreadId(thread);
  if (!threadId) {
    ElMessage.error('话题数据缺少 chatThreadId');
    return;
  }
  closeDrawer();
  router.push({
    path: '/chat/conversation/message',
    query: {
      id: threadId,
      chatType: CHAT_TYPE.GROUP,
      isChatThread: 'true',
      groupId: groupId.value,
      threadName: getThreadName(thread),
    },
  });
};

watch(
  () => modelValue.value,
  (visible) => {
    if (visible) {
      loadThreads(false);
    }
  },
);

defineExpose({
  loadThreads,
});
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    class="message_thread_list_drawer"
    direction="rtl"
    size="320px"
    :destroy-on-close="true"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="message_thread_list_header">
        <span>群组子区列表</span>
        <el-button size="small" :loading="loading" @click="loadThreads(false)">
          刷新
        </el-button>
      </div>
    </template>
    <div class="message_thread_list_content">
      <el-scrollbar height="calc(100vh - 150px)">
        <div v-if="loadError" class="thread_list_error">
          服务端返回：{{ loadError }}
        </div>
        <el-empty
          v-else-if="!loading && threads.length === 0"
          description="暂无子区"
        />
        <div
          v-for="thread in threads"
          :key="getThreadId(thread)"
          class="thread_list_item"
          @click="openThread(thread)"
        >
          <div class="thread_name">{{ getThreadName(thread) }}</div>
          <div class="thread_meta">
            <span>{{ getThreadId(thread) }}</span>
            <span v-if="thread.messageCount || thread.msgCount">
              {{ thread.messageCount || thread.msgCount }} 条
            </span>
          </div>
        </div>
        <div v-if="hasMore" class="thread_load_more">
          <el-button link :loading="loading" @click="loadThreads(true)">
            加载更多
          </el-button>
        </div>
      </el-scrollbar>
    </div>
  </el-drawer>
</template>

<style lang="scss" scoped>
.message_thread_list_header {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.message_thread_list_content {
  padding: 0 20px 16px;
}

.thread_list_error {
  padding: 12px;
  border: 1px solid #ffd6d6;
  border-radius: 6px;
  background: #fff2f2;
  color: #f56c6c;
  font-size: 13px;
  line-height: 18px;
  word-break: break-word;
}

.thread_list_item {
  padding: 12px 4px;
  border-bottom: 1px solid #eeeeee;
  cursor: pointer;
}

.thread_list_item:hover {
  background: #f7f7f7;
}

.thread_name {
  color: #333333;
  font-size: 14px;
  line-height: 20px;
}

.thread_meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
  color: #999999;
  font-size: 12px;
  line-height: 18px;
}

.thread_load_more {
  padding: 12px 0;
  text-align: center;
}
</style>

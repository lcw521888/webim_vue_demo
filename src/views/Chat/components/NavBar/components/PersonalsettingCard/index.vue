<script setup>
import { ref, watch, computed } from 'vue';
import { usePlayRing, useSetEMLogConfig } from '@/hooks';
import { RefreshRight } from '@element-plus/icons-vue';
import store from '@/store';

const dialogVisible = ref(false);
const { isOpenPlayRing } = usePlayRing();
const { isOpenedEMLog, donwLoadEMLog } = useSetEMLogConfig();
const presencePageNum = ref(0);
const presencePageSize = 50;
const loadingSubscribedPresence = ref(false);
const loadingBlackList = ref(false);
const subscribedPresenceList = computed(
  () => store.getters.getSubscribedPresenceList,
);
const friendBlackList = computed(() => store.state.Contacts.friendBlackList || []);

const refreshSubscribedPresenceList = async () => {
  loadingSubscribedPresence.value = true;
  try {
    await store.dispatch('fetchSubscribedPresenceList', {
      pageNum: presencePageNum.value,
      pageSize: presencePageSize,
    });
  } finally {
    loadingSubscribedPresence.value = false;
  }
};

const refreshBlackList = async () => {
  loadingBlackList.value = true;
  try {
    await store.dispatch('fetchBlackList');
  } finally {
    loadingBlackList.value = false;
  }
};

watch(dialogVisible, (visible) => {
  if (visible) {
    refreshSubscribedPresenceList();
    refreshBlackList();
  }
});
defineExpose({
  dialogVisible,
});
</script>

<template>
  <el-dialog
    custom-class="personal_setting_card"
    v-model="dialogVisible"
    width="366px"
    title="个人设置"
    :show-close="true"
    :destroy-on-close="true"
  >
    <div class="setting_main">
      <div class="setting_main_item">
        <el-tooltip
          class="item"
          effect="dark"
          content="开启后可在收到消息时，播放消息提示音。"
          placement="top"
        >
          <span>新消息提示音</span>
        </el-tooltip>

        <el-switch
          v-model="isOpenPlayRing"
          active-text="开启"
          inactive-text="关闭"
        />
      </div>
      <div class="setting_main_item">
        <el-tooltip
          class="item"
          effect="dark"
          content="开启SDK日志后，会在控制台输出SDK日志,并可下载SDK缓存日志。"
          placement="top"
        >
          <span>开启SDK日志</span></el-tooltip
        >
        <el-switch
          v-model="isOpenedEMLog"
          active-text="开启"
          inactive-text="关闭"
        />
      </div>
      <div class="setting_main_item" v-if="isOpenedEMLog">
        <el-button
          class="download_log"
          type="primary"
          plain
          @click="donwLoadEMLog"
          >下载SDK缓存日志</el-button
        >
      </div>
      <div class="setting_main_item">
        <el-tooltip
          class="item"
          effect="dark"
          content="当前按文档推荐使用服务端会话列表初始化，并通过消息回调更新缓存。"
          placement="top"
        >
          <span>会话列表来源</span>
        </el-tooltip>
        <span>服务端获取</span>
      </div>
      <div class="presence_section">
        <div class="presence_section_header">
          <span>在线状态订阅列表</span>
          <el-button
            link
            type="primary"
            :icon="RefreshRight"
            :loading="loadingSubscribedPresence"
            @click="refreshSubscribedPresenceList"
          >
            刷新
          </el-button>
        </div>
        <el-scrollbar max-height="220px">
          <div
            v-if="subscribedPresenceList.length > 0"
            class="presence_list"
          >
            <div
              v-for="item in subscribedPresenceList"
              :key="item.userId || item.uid || item"
              class="presence_list_item"
            >
              {{ item.userId || item.uid || item }}
            </div>
          </div>
          <el-empty
            v-else
            :image-size="60"
            description="暂无已订阅用户"
          />
        </el-scrollbar>
      </div>
      <div class="presence_section">
        <div class="presence_section_header">
          <span>黑名单列表</span>
          <el-button
            link
            type="primary"
            :icon="RefreshRight"
            :loading="loadingBlackList"
            @click="refreshBlackList"
          >
            刷新
          </el-button>
        </div>
        <el-scrollbar max-height="220px">
          <div v-if="friendBlackList.length > 0" class="presence_list">
            <div
              v-for="item in friendBlackList"
              :key="item"
              class="presence_list_item"
            >
              {{ item }}
            </div>
          </div>
          <el-empty
            v-else
            :image-size="60"
            description="暂无黑名单用户"
          />
        </el-scrollbar>
      </div>
      <!-- <div>
                <span>新消息系统推送</span>
                <el-switch v-model="" active-text="开启" inactive-text="关闭" />
            </div> -->
    </div>
  </el-dialog>
</template>

<style lang="scss" scoped>
.setting_main {
  width: 100%;
  height: 100%;

  .setting_main_item {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .presence_section {
    margin-top: 18px;
    border-top: 1px solid #f0f0f0;
    padding-top: 14px;

    .presence_section_header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
      font-weight: 500;
    }

    .presence_list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .presence_list_item {
      padding: 8px 10px;
      border-radius: 8px;
      background: #f7f8fa;
      font-size: 13px;
      color: #333;
      word-break: break-all;
    }
  }
}
</style>

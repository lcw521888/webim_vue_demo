<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { EMClient } from '@/IM';
import { CHAT_TYPE } from '@/IM/constant';
import router from '@/router';
import SearchInput from '@/components/SearchInput';
import Welcome from '@/components/Welcome';
import {
  CHATROOM_EVENT_OPERATIONS,
  createChatroomEventHandler,
  logChatroomActionResult,
} from '@/utils/chatroomEvents';

/** 列表与已加入列表的 id 可能为 string / number，严格 === 会导致「加入/进入」状态不更新 */
function normalizeChatroomId(id) {
  if (id == null || id === '') return '';
  return String(id);
}

const store = useStore();
const route = useRoute();

const chatroomList = ref([]);
const joinedChatroomList = ref([]);
const joinedChatroomDetailsMap = ref(new Map());
const loading = ref(false);
const joiningRoomIds = ref(new Set());
const searchKeyword = ref('');

const CHATROOM_TYPE = {
  ALL: '1',
  JOINED: '2',
};

const activeName = ref(CHATROOM_TYPE.ALL);
const joinRoomExt = ref('webim_vue_demo');

const checkLoginStatus = () => {
  if (!EMClient.user) {
    ElMessage.error('用户未登录，请先登录');
    router.push('/login');
    return false;
  }
  return true;
};

// 设置聊天室事件监听器，只记录真实 SDK 事件
const setupChatroomEventHandler = () => {
  if (chatroomEventHandler) {
    EMClient.removeEventHandler('CHATROOM');
  }

  chatroomEventHandler = EMClient.addEventHandler(
    'CHATROOM',
    createChatroomEventHandler('ChatroomIndex', (e) => {
      switch (e.operation) {
        case CHATROOM_EVENT_OPERATIONS.MEMBER_PRESENCE:
        case CHATROOM_EVENT_OPERATIONS.MEMBER_ABSENCE:
          break;
        case CHATROOM_EVENT_OPERATIONS.DESTROY:
          ElMessage.warning('聊天室已解散');
          break;
        case CHATROOM_EVENT_OPERATIONS.REMOVE_MEMBER:
          ElMessage.warning('你已被移出聊天室');
          break;
        case CHATROOM_EVENT_OPERATIONS.UNBLOCK_MEMBER:
          ElMessage.info('你已被移出聊天室黑名单');
          break;
        case CHATROOM_EVENT_OPERATIONS.UPDATE_INFO:
          ElMessage.info('聊天室信息已更新');
          break;
        case CHATROOM_EVENT_OPERATIONS.MUTE_ALL_MEMBERS:
          ElMessage.warning('聊天室已开启全员禁言');
          break;
        case CHATROOM_EVENT_OPERATIONS.UNMUTE_ALL_MEMBERS:
          ElMessage.success('聊天室已解除全员禁言');
          break;
        case CHATROOM_EVENT_OPERATIONS.ADD_USER_TO_ALLOWLIST:
          ElMessage.success('你已被添加到聊天室白名单');
          break;
        case CHATROOM_EVENT_OPERATIONS.REMOVE_ALLOWLIST_MEMBER:
          ElMessage.warning('你已被移出聊天室白名单');
          break;
        case CHATROOM_EVENT_OPERATIONS.UPDATE_ANNOUNCEMENT:
          ElMessage.info('聊天室公告已更新');
          break;
        case CHATROOM_EVENT_OPERATIONS.DELETE_ANNOUNCEMENT:
          ElMessage.info('聊天室公告已删除');
          break;
        case CHATROOM_EVENT_OPERATIONS.MUTE_MEMBER:
          ElMessage.warning('你已被禁言');
          break;
        case CHATROOM_EVENT_OPERATIONS.UNMUTE_MEMBER:
          ElMessage.success('你已被解除禁言');
          break;
        case CHATROOM_EVENT_OPERATIONS.SET_ADMIN:
          ElMessage.success('你已被设置为管理员');
          break;
        case CHATROOM_EVENT_OPERATIONS.REMOVE_ADMIN:
          ElMessage.warning('你已被移除管理员');
          break;
        case CHATROOM_EVENT_OPERATIONS.CHANGE_OWNER:
          ElMessage.info('聊天室所有者已变更');
          break;
        case CHATROOM_EVENT_OPERATIONS.UPDATE_CHATROOM_ATTRIBUTES:
          ElMessage.info('聊天室自定义属性已更新');
          break;
        case CHATROOM_EVENT_OPERATIONS.REMOVE_CHATROOM_ATTRIBUTES:
          ElMessage.info('聊天室自定义属性已删除');
          break;
        default:
          break;
      }
    }),
  );
};

const isRoomJoined = (roomId) => {
  const key = normalizeChatroomId(roomId);
  if (!key) return false;
  return joinedChatroomList.value.some(
    (j) => normalizeChatroomId(j.id) === key,
  );
};

const isJoiningRoom = (roomId) => {
  const key = normalizeChatroomId(roomId);
  if (!key) return false;
  return joiningRoomIds.value.has(key);
};

const setJoiningRoom = (roomId, joining) => {
  const key = normalizeChatroomId(roomId);
  if (!key) return;
  const nextJoiningRoomIds = new Set(joiningRoomIds.value);
  if (joining) {
    nextJoiningRoomIds.add(key);
  } else {
    nextJoiningRoomIds.delete(key);
  }
  joiningRoomIds.value = nextJoiningRoomIds;
};

const getJoinedChatroomMemberCount = (roomId) => {
  const key = normalizeChatroomId(roomId);
  if (!key) return null;
  const detail = joinedChatroomDetailsMap.value.get(key);
  const rawCount = detail?.affiliations_count ?? detail?.memberCount;
  if (rawCount == null || rawCount === '') return null;
  const memberCount = Number(rawCount);
  return Number.isFinite(memberCount) ? memberCount : null;
};

const getAllChatroomMemberCount = (item) => {
  const rawCount = item?.affiliations_count ?? item?.memberCount;
  if (rawCount == null || rawCount === '') return null;
  const count = Number(rawCount);
  return Number.isFinite(count) ? count : null;
};

const getChatroomDescription = (item, roomId) => {
  const key = normalizeChatroomId(roomId || item?.id);
  if (!key) return item?.description || item?.desc || '';
  const detail = joinedChatroomDetailsMap.value.get(key);
  return detail?.description || item?.description || item?.desc || '';
};

const getChatrooms = async () => {
  if (!checkLoginStatus()) return;
  const GET_CHAT_ROOMS_METHOD = 'getChatRooms';
  const chatRoomListParams = {
    pagenum: 1,
    pagesize: 1000,
  };
  loading.value = true;
  try {
    const res = await EMClient.getChatRooms(chatRoomListParams);
    console.log(
      `获取聊天室列表成功:`,
      `\n调用方法: ${GET_CHAT_ROOMS_METHOD}`,
      `\n方法入参:`,
      chatRoomListParams,
      `\n原始返回数据:`,
      res,
      `\n返回的聊天室数据:`,
      res.data,
      `\n聊天室总数:`,
      (res.data || []).length,
      `\n当前用户:`,
      EMClient.user,
      `\n第一个聊天室的数据结构:`,
      res.data && res.data.length > 0 ? JSON.stringify(res.data[0], null, 2) : '无数据',
    );
    if (res.data && res.data.length > 0) {
      console.log(`第一个所有聊天室的原始数据:`, JSON.stringify(res.data[0], null, 2));
    }

    chatroomList.value = Array.isArray(res.data) ? res.data : [];
    console.log(`所有聊天室列表处理完成:`, JSON.stringify(chatroomList.value, null, 2));
  } catch (error) {
    console.error(
      `获取聊天室列表失败:`,
      `\n调用方法: ${GET_CHAT_ROOMS_METHOD}`,
      `\n方法入参:`,
      chatRoomListParams,
      `\n当前用户:`,
      EMClient.user,
      `\n错误类型:`,
      error.type,
      `\n错误消息:`,
      error.message,
      `\n完整错误信息:`,
      error,
    );
    ElMessage.error(error?.message || '获取聊天室列表失败');
  } finally {
    loading.value = false;
  }
};

const getJoinedChatrooms = async () => {
  if (!checkLoginStatus()) return;
  const chatRoomParams = {
    pageNum: 1,
    pageSize: 100,
  };
  const GET_JOINED_CHAT_ROOMS_METHOD = 'getJoinedChatRooms';
  loading.value = true;
  try {
    console.log(`获取当前用户${EMClient.user}加入的聊天室列表`);
    const res = await EMClient.getJoinedChatRooms(chatRoomParams);
    console.log(
      `获取已加入聊天室列表成功:`,
      res,
      `\n调用方法: ${GET_JOINED_CHAT_ROOMS_METHOD}`,
      `\n方法入参:`,
      chatRoomParams,
    );
    if (res.data && res.data.length > 0) {
      console.log(`第一个已加入聊天室的原始数据:`, JSON.stringify(res.data[0], null, 2));
    }

    joinedChatroomList.value = Array.isArray(res.data) ? res.data : [];
    joinedChatroomDetailsMap.value = new Map();

    await Promise.all(
      joinedChatroomList.value.map(async (room) => {
        const roomId = normalizeChatroomId(room.id);
        if (!roomId) return;
        try {
          const detailRes = await EMClient.getChatRoomDetails({
            chatRoomId: roomId,
          });
          const detail = Array.isArray(detailRes?.data)
            ? detailRes.data[0] || {}
            : detailRes?.data || {};
          joinedChatroomDetailsMap.value.set(roomId, detail);
          console.log(
            `已加入聊天室详情成员数刷新成功:`,
            `\n来源接口: getChatRoomDetails`,
            `\n聊天室ID:`,
            roomId,
            `\n当前成员数:`,
            detail?.affiliations_count ?? 0,
            `\n详情返回值:`,
            detailRes,
          );
        } catch (error) {
          console.error(
            `已加入聊天室详情成员数刷新失败:`,
            `\n来源接口: getChatRoomDetails`,
            `\n聊天室ID:`,
            roomId,
            `\n完整错误信息:`,
            error,
          );
        }
      }),
    );

    console.log(`已加入聊天室列表处理完成:`, JSON.stringify(joinedChatroomList.value, null, 2));
  } catch (error) {
    console.error(
      `获取已加入聊天室列表失败:`,
      `\n调用方法: ${GET_JOINED_CHAT_ROOMS_METHOD}`,
      `\n方法入参:`,
      chatRoomParams,
      `\n当前用户:`,
      EMClient.user,
      `\n完整错误信息:`,
      error,
    );
    ElMessage.error(error?.message || '获取已加入聊天室列表失败');
  } finally {
    loading.value = false;
  }
};

const refreshChatroomListsFromServer = async () => {
  await Promise.all([getChatrooms(), getJoinedChatrooms()]);
};

const joinChatroom = async (roomId) => {
  if (!checkLoginStatus()) return;
  if (isJoiningRoom(roomId)) {
    console.warn(
      `[ChatroomUI] 忽略重复加入请求:`,
      `\n调用方法: joinChatRoom`,
      `\n目标聊天室ID:`,
      roomId,
      `\n当前用户:`,
      EMClient.user,
    );
    return;
  }
  const JOIN_CHAT_ROOM_METHOD = 'joinChatRoom';
  const joinChatRoomParams = {
    roomId: roomId,
    ext: joinRoomExt.value,
    leaveOtherRooms: false,
  };
  setJoiningRoom(roomId, true);
  try {
    console.log(
      `开始加入聊天室:`,
      `\n调用方法: ${JOIN_CHAT_ROOM_METHOD}`,
      `\n方法入参:`,
      joinChatRoomParams,
      `\n当前用户:`,
      EMClient.user,
      `\n目标聊天室ID:`,
      roomId,
    );
    const res = await EMClient.joinChatRoom(joinChatRoomParams);

    logChatroomActionResult(
      'ChatroomIndex',
      JOIN_CHAT_ROOM_METHOD,
      joinChatRoomParams,
      res,
      {
        from: EMClient.user,
      },
    );
    ElMessage.success('加入聊天室成功');
    console.log(
      `加入聊天室成功:`,
      `\n调用方法: ${JOIN_CHAT_ROOM_METHOD}`,
      `\n方法入参:`,
      joinChatRoomParams,
      `\n返回结果:`,
      res,
      `\n成功加入的聊天室ID:`,
      roomId,
      `\n当前连接状态:`,
      EMClient.connectionState || '未知',
    );
    await refreshChatroomListsFromServer();
  } catch (error) {
    console.error(
      `加入聊天室失败:`,
      `\n调用方法: ${JOIN_CHAT_ROOM_METHOD}`,
      `\n方法入参:`,
      joinChatRoomParams,
      `\n目标聊天室ID:`,
      roomId,
      `\n当前用户:`,
      EMClient.user,
      `\n完整错误信息:`,
      error,
      `\n错误类型:`,
      error.type,
      `\n错误数据:`,
      error.data,
      `\n错误消息:`,
      error.message,
    );

    ElMessage.error(error?.message || '加入聊天室失败');
  } finally {
    setJoiningRoom(roomId, false);
  }
};

const leaveChatroom = async (roomId) => {
  if (!checkLoginStatus()) return;
  const LEAVE_CHAT_ROOM_METHOD = 'leaveChatRoom';
  const leaveChatRoomParams = { roomId };
  try {
    await ElMessageBox.confirm('确定要退出该聊天室吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    const res = await EMClient.leaveChatRoom(leaveChatRoomParams);
    logChatroomActionResult(
      'ChatroomIndex',
      LEAVE_CHAT_ROOM_METHOD,
      leaveChatRoomParams,
      res,
      {
        from: EMClient.user,
      },
    );
    ElMessage.success('退出聊天室成功');
    console.log(
      `退出聊天室成功:`,
      `\n调用方法: ${LEAVE_CHAT_ROOM_METHOD}`,
      `\n方法入参:`,
      leaveChatRoomParams,
      `\n接口返回结果:`,
      res,
      `\n已退出聊天室ID:`,
      roomId,
    );
    await refreshChatroomListsFromServer();
  } catch (error) {
    if (error !== 'cancel') {
      console.error(
        `退出聊天室失败:`,
        `\n调用方法: ${LEAVE_CHAT_ROOM_METHOD}`,
        `\n方法入参:`,
        leaveChatRoomParams,
        `\n目标聊天室ID:`,
        roomId,
        `\n当前用户:`,
        EMClient.user,
        `\n错误类型:`,
        error.type,
        `\n错误数据:`,
        error.data,
        `\n错误消息:`,
        error.message,
        `\n完整错误信息:`,
        error,
      );
      ElMessage.error(error?.message || '退出聊天室失败');
    }
  }
};

const destroyChatroom = async (roomId) => {
  if (!checkLoginStatus()) return;
  const DESTROY_CHAT_ROOM_METHOD = 'destroyChatRoom';
  const destroyChatRoomParams = { chatRoomId: roomId };
  try {
    await ElMessageBox.confirm(
      '确定要解散该聊天室吗？此操作不可恢复！',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );

    console.log(
      `用户确认解散聊天室，开始调用接口:`,
      `\n调用方法: ${DESTROY_CHAT_ROOM_METHOD}`,
      `\n方法入参:`,
      destroyChatRoomParams,
      `\n待解散聊天室ID:`,
      roomId,
    );

    const res = await EMClient.destroyChatRoom(destroyChatRoomParams);
    logChatroomActionResult(
      'ChatroomIndex',
      DESTROY_CHAT_ROOM_METHOD,
      destroyChatRoomParams,
      res,
      {
        from: EMClient.user,
      },
    );
    console.log(
      `解散聊天室成功:`,
      `\n调用方法: ${DESTROY_CHAT_ROOM_METHOD}`,
      `\n方法入参:`,
      destroyChatRoomParams,
      `\n接口返回结果:`,
      res,
      `\n已解散聊天室ID:`,
      roomId,
    );
    ElMessage.success('解散聊天室成功');
  } catch (error) {
    if (error !== 'cancel') {
      console.error(
        `解散聊天室失败:`,
        `\n调用方法: ${DESTROY_CHAT_ROOM_METHOD}`,
        `\n方法入参:`,
        destroyChatRoomParams,
        `\n目标聊天室ID:`,
        roomId,
        `\n当前用户:`,
        EMClient.user,
        `\n错误类型:`,
        error.type,
        `\n错误数据:`,
        error.data,
        `\n错误消息:`,
        error.message,
        `\n完整错误信息:`,
        error,
      );
      ElMessage.error(error?.message || '解散聊天室失败');
    }
  }
};

const toChatroomMessage = (roomId) => {
  router.push({
    path: '/chat/chatroom/message',
    query: {
      id: roomId,
      chatType: CHAT_TYPE.CHATROOM,
    },
  });
};

const toChatroomDetails = async (roomId) => {
  await getChatrooms();
  router.push({
    path: '/chat/chatroom/details',
    query: {
      roomId,
      refreshAt: Date.now(),
    },
  });
};

const filteredChatroomList = computed(() => {
  if (!searchKeyword.value) return chatroomList.value;
  return chatroomList.value.filter(
    (item) =>
      item.name?.includes(searchKeyword.value) ||
      item.affiliations?.includes(searchKeyword.value),
  );
});

const filteredJoinedChatroomList = computed(() => {
  if (!searchKeyword.value) return joinedChatroomList.value;
  return joinedChatroomList.value.filter(
    (item) =>
      item.name?.includes(searchKeyword.value) ||
      item.affiliations?.includes(searchKeyword.value),
  );
});

const networkStatus = computed(() => {
  return store.state.networkStatus;
});

let chatroomEventHandler = null;

watch(
  () => route.fullPath,
  (path, prevPath) => {
    const base = path.split('?')[0];
    const listRoot = /\/chat\/chatroom\/?$/.test(base);
    if (prevPath?.includes('/chatroom/details') && listRoot) {
      void getChatrooms();
      void getJoinedChatrooms();
    }
  },
);

onMounted(() => {
  getChatrooms();
  getJoinedChatrooms();
  setupChatroomEventHandler();
});

onUnmounted(() => {
  if (chatroomEventHandler) {
    EMClient.removeEventHandler('CHATROOM');
  }
});
</script>

<template>
  <el-container style="height: 100%">
    <el-aside class="chatroom_box">
      <SearchInput
        :searchType="'chatroom'"
        :searchData="[]"
        v-model="searchKeyword"
      />
      <el-scrollbar class="chatroom_collapse" tag="div" :always="false">
        <div class="offline_hint" v-if="!networkStatus">
          <span class="plaint_icon">!</span>
          网络不给力，请检查网络设置。
        </div>

        <div class="action_buttons">
          <el-button size="small" @click="refreshChatroomListsFromServer">
            刷新列表
          </el-button>
        </div>

        <el-collapse v-model="activeName" accordion>
          <el-collapse-item
            :title="`所有聊天室 ( ${chatroomList.length} )`"
            :name="CHATROOM_TYPE.ALL"
          >
            <template v-if="filteredChatroomList.length > 0">
              <div
                v-for="item in filteredChatroomList"
                :key="item.id"
                class="chatroom_item"
              >
                <div class="item_left">
                  <el-avatar :size="40" :src="item.avatar || ''">
                    {{ item.name?.charAt(0) }}
                  </el-avatar>
                </div>
                <div class="item_main">
                  <div class="name">{{ item.name }}</div>
                  <div class="desc">{{ getChatroomDescription(item) || '暂无描述' }}</div>
                  <div class="info">
                    <span>成员: {{ getAllChatroomMemberCount(item) ?? '--' }}</span>
                  </div>
                </div>
                <div class="item_right">
                  <el-button
                    v-if="!isRoomJoined(item.id)"
                    type="primary"
                    size="small"
                    :loading="isJoiningRoom(item.id)"
                    :disabled="isJoiningRoom(item.id)"
                    @click="joinChatroom(item.id)"
                  >
                    加入
                  </el-button>
                  <el-button
                    v-else
                    type="success"
                    size="small"
                    @click="toChatroomMessage(item.id)"
                  >
                    进入
                  </el-button>
                  <el-button size="small" @click="toChatroomDetails(item.id)">
                    详情
                  </el-button>
                </div>
              </div>
            </template>
            <template v-else>
              <el-empty description="暂无聊天室..." />
            </template>
          </el-collapse-item>

          <el-collapse-item
            :title="`已加入 ( ${joinedChatroomList.length} )`"
            :name="CHATROOM_TYPE.JOINED"
          >
            <template v-if="filteredJoinedChatroomList.length > 0">
              <div
                v-for="item in filteredJoinedChatroomList"
                :key="item.id"
                class="chatroom_item"
              >
                <div class="item_left">
                  <el-avatar :size="40" :src="item.avatar || ''">
                    {{ item.name?.charAt(0) }}
                  </el-avatar>
                </div>
                <div class="item_main">
                  <div class="name">{{ item.name }}</div>
                  <div class="desc">{{ getChatroomDescription(item) || '暂无描述' }}</div>
                  <div class="info">
                    <span>成员: {{ getJoinedChatroomMemberCount(item.id) ?? '--' }}</span>
                  </div>
                </div>
                <div class="item_right">
                  <el-button
                    type="primary"
                    size="small"
                    @click="toChatroomMessage(item.id)"
                  >
                    进入
                  </el-button>
                  <el-button
                    type="danger"
                    size="small"
                    @click="leaveChatroom(item.id)"
                  >
                    退出
                  </el-button>
                  <el-button
                    v-if="item.owner === EMClient.user"
                    type="warning"
                    size="small"
                    @click="destroyChatroom(item.id)"
                  >
                    解散
                  </el-button>
                  <el-button size="small" @click="toChatroomDetails(item.id)">
                    详情
                  </el-button>
                </div>
              </div>
            </template>
            <template v-else>
              <el-empty description="暂未加入任何聊天室..." />
            </template>
          </el-collapse-item>
        </el-collapse>
      </el-scrollbar>
    </el-aside>
    <el-main ref class="chatroom_infors_main_box">
      <router-view></router-view>
      <Welcome />
    </el-main>
  </el-container>
</template>

<style lang="scss" scoped>
.chatroom_box {
  position: relative;
  background: #cfdbf171;
  min-width: 324px;
  user-select: none;

  .chatroom_collapse {
    height: calc(100% - 60px);
    overflow: auto;
  }
}

.action_buttons {
  display: flex;
  gap: 10px;
  padding: 10px;
}

:deep(.el-collapse-item__header) {
  padding: 0 8px;
  font-family: 'PingFang SC';
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  line-height: 24px;
  letter-spacing: 0.342857px;
  color: #333333;
}

:deep(.el-collapse-item__content) {
  padding: 0;
}

.chatroom_item {
  position: relative;
  width: 100%;
  min-height: 80px;
  padding: 10px 8px;
  background: #fff;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;

  &:hover {
    background: #f5f5f5;
  }

  .item_left {
    margin-right: 10px;
  }

  .item_main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .name {
      font-weight: 500;
      font-size: 14px;
      line-height: 20px;
      color: #333333;
    }

    .desc {
      font-size: 12px;
      color: #999;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 150px;
    }

    .info {
      font-size: 11px;
      color: #666;
      display: flex;
      gap: 10px;
    }
  }

  .item_right {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
}

.chatroom_infors_main_box {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0;
}

.offline_hint {
  width: 100%;
  height: 30px;
  text-align: center;
  line-height: 30px;
  color: #f35f81;
  background: #fce7e8;
  font-size: 7px;

  .plaint_icon {
    display: inline-block;
    width: 15px;
    height: 15px;
    color: #e5e5e5;
    text-align: center;
    line-height: 15px;
    font-size: 7px;
    font-weight: bold;
    background: #e6686e;
    border-radius: 50%;
  }
}
</style>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { ElMessage, ElMessageBox } from 'element-plus';
import { EMClient } from '@/IM';
import { CHAT_TYPE } from '@/IM/constant';
import router from '@/router';
import SearchInput from '@/components/SearchInput';
import Welcome from '@/components/Welcome';

const store = useStore();

const chatroomList = ref([]);
const joinedChatroomList = ref([]);
const loading = ref(false);
const searchKeyword = ref('');

const CHATROOM_TYPE = {
  ALL: '1',
  JOINED: '2',
};

const activeName = ref(CHATROOM_TYPE.ALL);

const checkLoginStatus = () => {
  if (!EMClient.user) {
    ElMessage.error('用户未登录，请先登录');
    router.push('/login');
    return false;
  }
  return true;
};

const getChatrooms = async () => {
  if (!checkLoginStatus()) return;
  
  loading.value = true;
  try {
    const res = await EMClient.getChatRooms({
      pagenum: 1,
      pagesize: 100,
    });
    chatroomList.value = res.data || [];
  } catch (error) {
    console.error('获取聊天室列表失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('获取聊天室列表失败');
    }
  } finally {
    loading.value = false;
  }
};

const getJoinedChatrooms = async () => {
  if (!checkLoginStatus()) return;
  
  loading.value = true;
  try {
    console.log('开始获取已加入聊天室列表，当前用户:', EMClient.user);
    const res = await EMClient.getJoinedChatRooms({
      pageNum: 1,
      pageSize: 100,
    });
    console.log('获取已加入聊天室列表成功:', res);
    joinedChatroomList.value = res.data || [];
  } catch (error) {
    console.error('获取已加入聊天室列表失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('获取已加入聊天室列表失败');
    }
  } finally {
    loading.value = false;
  }
};

const joinChatroom = async (roomId) => {
  if (!checkLoginStatus()) return;
  
  try {
    await EMClient.joinChatRoom({
      roomId: roomId,
      ext: '',
      leaveOtherRooms: false,
    });
    ElMessage.success('加入聊天室成功');
    getJoinedChatrooms();
  } catch (error) {
    console.error('加入聊天室失败 - 完整错误信息:', error);
    console.error('错误类型:', error.type);
    console.error('错误数据:', error.data);
    console.error('错误消息:', error.message);
    
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else if (error.type === 17 || error.data?.includes('group_authorization')) {
      ElMessage.error('您没有权限加入该聊天室');
    } else if (error.data?.includes('forbidden_op')) {
      ElMessage.error('操作被禁止，您可能已被禁言或限制');
    } else {
      const errorMsg = error.data || error.message || '加入聊天室失败';
      ElMessage.error(`加入聊天室失败: ${errorMsg}`);
    }
  }
};

const leaveChatroom = async (roomId) => {
  if (!checkLoginStatus()) return;
  
  try {
    await ElMessageBox.confirm('确定要退出该聊天室吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await EMClient.leaveChatRoom({ roomId });
    ElMessage.success('退出聊天室成功');
    getJoinedChatrooms();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('退出聊天室失败', error);
      if (error.type === 52 || error.message?.includes('authenticate')) {
        ElMessage.error('认证失败，请重新登录');
      } else if (error.type === 17 || error.data?.includes('group_authorization')) {
        ElMessage.error('您没有权限退出该聊天室');
      } else {
        ElMessage.error('退出聊天室失败');
      }
    }
  }
};

const destroyChatroom = async (roomId) => {
  if (!checkLoginStatus()) return;
  
  try {
    await ElMessageBox.confirm('确定要解散该聊天室吗？此操作不可恢复！', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await EMClient.destroyChatRoom({ chatRoomId: roomId });
    ElMessage.success('解散聊天室成功');
    getChatrooms();
    getJoinedChatrooms();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('解散聊天室失败', error);
      if (error.type === 52 || error.message?.includes('authenticate')) {
        ElMessage.error('认证失败，请重新登录');
      } else if (error.type === 17 || error.data?.includes('group_authorization')) {
        ElMessage.error('您没有权限解散该聊天室');
      } else {
        ElMessage.error('解散聊天室失败');
      }
    }
  }
};

const toChatroomMessage = (roomId) => {
  router.push({
    path: '/chat/chatroom/message',
    query: { 
      id: roomId,
      chatType: CHAT_TYPE.CHATROOM 
    },
  });
};

const toChatroomDetails = (roomId) => {
  router.push({
    path: '/chat/chatroom/details',
    query: { roomId },
  });
};

const showCreateDialog = ref(false);
const createForm = ref({
  name: '',
  description: '',
  maxusers: 200,
  members: [],
});

const createChatroom = async () => {
  if (!checkLoginStatus()) return;
  
  try {
    const options = {
      name: createForm.value.name,
      description: createForm.value.description,
      maxusers: createForm.value.maxusers,
      members: createForm.value.members,
    };
    await EMClient.createChatRoom(options);
    ElMessage.success('创建聊天室成功');
    showCreateDialog.value = false;
    createForm.value = {
      name: '',
      description: '',
      maxusers: 200,
      members: [],
    };
    getChatrooms();
  } catch (error) {
    console.error('创建聊天室失败 - 完整错误信息:', error);
    console.error('错误类型:', error.type);
    console.error('错误数据:', error.data);
    console.error('错误消息:', error.message);
    
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else if (error.type === 17 || error.data?.includes('group_authorization')) {
      ElMessage.error('您没有创建聊天室的权限');
    } else if (error.data?.includes('forbidden_op')) {
      ElMessage.error('操作被禁止，您可能已被禁言或限制');
    } else {
      const errorMsg = error.data || error.message || '创建聊天室失败';
      ElMessage.error(`创建聊天室失败: ${errorMsg}`);
    }
  }
};

const filteredChatroomList = computed(() => {
  if (!searchKeyword.value) return chatroomList.value;
  return chatroomList.value.filter((item) =>
    item.name?.includes(searchKeyword.value) || item.affiliations?.includes(searchKeyword.value)
  );
});

const filteredJoinedChatroomList = computed(() => {
  if (!searchKeyword.value) return joinedChatroomList.value;
  return joinedChatroomList.value.filter((item) =>
    item.name?.includes(searchKeyword.value) || item.affiliations?.includes(searchKeyword.value)
  );
});

const networkStatus = computed(() => {
  return store.state.networkStatus;
});

let chatroomEventHandler = null;

onMounted(() => {
  getChatrooms();
  getJoinedChatrooms();

  chatroomEventHandler = EMClient.addEventHandler('CHATROOM', {
    onChatroomEvent: (e) => {
      console.log('===== 聊天室事件 =====');
      console.log('事件类型:', e.operation);
      console.log('完整事件数据:', e);
      console.log('===================');
      
      switch (e.operation) {
        case 'memberPresence':
          console.log('成员加入事件 - 用户:', e.from, '扩展信息:', e.ext, '当前人数:', e?.memberCount);
          ElMessage.info(`有成员加入聊天室，当前人数：${e?.memberCount || 0}`);
          getChatrooms();
          break;
        case 'memberAbsence':
          console.log('成员离开事件 - 用户:', e.from, '当前人数:', e?.memberCount);
          ElMessage.info(`有成员离开聊天室，当前人数：${e?.memberCount || 0}`);
          getChatrooms();
          break;
        case 'destroy':
          console.log('聊天室解散事件 - 聊天室ID:', e.chatRoomId);
          ElMessage.warning('聊天室已解散');
          getChatrooms();
          getJoinedChatrooms();
          break;
        case 'removeMember':
          console.log('成员被移出事件 - 被移出用户:', e.from, '操作者:', e.to);
          ElMessage.warning('你已被移出聊天室');
          getJoinedChatrooms();
          break;
        case 'updateInfo':
          console.log('聊天室信息更新事件 - 聊天室ID:', e.chatRoomId);
          ElMessage.info('聊天室信息已更新');
          getChatrooms();
          break;
        case 'muteAllMembers':
          console.log('全员禁言事件 - 操作者:', e.from, '聊天室ID:', e.chatRoomId);
          ElMessage.warning('聊天室已开启全员禁言');
          break;
        case 'unmuteAllMembers':
          console.log('解除全员禁言事件 - 操作者:', e.from, '聊天室ID:', e.chatRoomId);
          ElMessage.success('聊天室已解除全员禁言');
          break;
        case 'addUserToAllowlist':
          console.log('添加到白名单事件 - 用户:', e.from, '聊天室ID:', e.chatRoomId);
          ElMessage.success('你已被添加到聊天室白名单');
          break;
        case 'removeAllowlistMember':
          console.log('移出白名单事件 - 用户:', e.from, '聊天室ID:', e.chatRoomId);
          ElMessage.warning('你已被移出聊天室白名单');
          break;
        case 'updateAnnouncement':
          console.log('更新公告事件 - 聊天室ID:', e.chatRoomId, '公告内容:', e.announcement);
          ElMessage.info('聊天室公告已更新');
          break;
        case 'deleteAnnouncement':
          console.log('删除公告事件 - 聊天室ID:', e.chatRoomId);
          ElMessage.info('聊天室公告已删除');
          break;
        case 'muteMember':
          console.log('禁言成员事件 - 被禁言用户:', e.from, '操作者:', e.to);
          ElMessage.warning('你已被禁言');
          break;
        case 'unmuteMember':
          console.log('解除禁言事件 - 用户:', e.from, '操作者:', e.to);
          ElMessage.success('你已被解除禁言');
          break;
        case 'setAdmin':
          console.log('设置管理员事件 - 新管理员:', e.from, '操作者:', e.to);
          ElMessage.success('你已被设置为管理员');
          break;
        case 'removeAdmin':
          console.log('移除管理员事件 - 被移除管理员:', e.from, '操作者:', e.to);
          ElMessage.warning('你已被移除管理员');
          break;
        case 'changeOwner':
          console.log('变更所有者事件 - 新所有者:', e.from, '旧所有者:', e.to, '聊天室ID:', e.chatRoomId);
          ElMessage.info('聊天室所有者已变更');
          break;
        case 'updateChatRoomAttributes':
          console.log('更新自定义属性事件 - 聊天室ID:', e.chatRoomId, '属性:', e.attributes);
          ElMessage.info('聊天室自定义属性已更新');
          break;
        case 'removeChatRoomAttributes':
          console.log('删除自定义属性事件 - 聊天室ID:', e.chatRoomId, '属性键:', e.attributeKeys);
          ElMessage.info('聊天室自定义属性已删除');
          break;
        default:
          console.log('未知聊天室事件:', e.operation, e);
          break;
      }
    },
  });
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
          <el-button type="primary" size="small" @click="showCreateDialog = true">
            创建聊天室
          </el-button>
          <el-button size="small" @click="getChatrooms">
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
                  <div class="desc">{{ item.description || '暂无描述' }}</div>
                  <div class="info">
                    <span>成员: {{ item.affiliations_count || 0 }}</span>
                    <span>最大: {{ item.maxusers }}</span>
                  </div>
                </div>
                <div class="item_right">
                  <el-button
                    v-if="!joinedChatroomList.find(j => j.id === item.id)"
                    type="primary"
                    size="small"
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
                  <el-button
                    size="small"
                    @click="toChatroomDetails(item.id)"
                  >
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
                  <div class="desc">{{ item.description || '暂无描述' }}</div>
                  <div class="info">
                    <span>成员: {{ item.affiliations_count || 0 }}</span>
                    <span>最大: {{ item.maxusers }}</span>
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
                  <el-button
                    size="small"
                    @click="toChatroomDetails(item.id)"
                  >
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

  <el-dialog
    v-model="showCreateDialog"
    title="创建聊天室"
    width="500px"
  >
    <el-form :model="createForm" label-width="100px">
      <el-form-item label="聊天室名称">
        <el-input v-model="createForm.name" placeholder="请输入聊天室名称" />
      </el-form-item>
      <el-form-item label="聊天室描述">
        <el-input
          v-model="createForm.description"
          type="textarea"
          placeholder="请输入聊天室描述"
        />
      </el-form-item>
      <el-form-item label="最大成员数">
        <el-input-number
          v-model="createForm.maxusers"
          :min="1"
          :max="5000"
        />
      </el-form-item>
      <el-form-item label="初始成员">
        <el-input
          v-model="createForm.members"
          placeholder="请输入成员用户名，用逗号分隔"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createChatroom">创建</el-button>
      </span>
    </template>
  </el-dialog>
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

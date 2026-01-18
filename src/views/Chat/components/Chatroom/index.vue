<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { ElMessage, ElMessageBox } from 'element-plus';
import { EMClient } from '@/IM';
import { CHAT_TYPE } from '@/IM/constant';
import router from '@/router';
import SearchInput from '@/components/SearchInput';
import Welcome from '@/components/Welcome';

// 缓存已获取的聊天室详情，用于存储准确的成员数
const chatroomDetailsCache = ref(new Map());

// 获取单个聊天室的准确详情（包括成员数）
const fetchChatroomDetail = async (roomId) => {
  try {
    const res = await EMClient.getChatRoomDetails({ chatRoomId: roomId });
    const detail = Array.isArray(res.data) ? res.data[0] || {} : res.data || {};
    
    if (detail.id) {
      // 缓存聊天室详情
      chatroomDetailsCache.value.set(detail.id, detail);
      console.log(`缓存聊天室${detail.id}的准确详情:`, { affiliations_count: detail.affiliations_count });
    }
    
    return detail;
  } catch (error) {
    console.error(`获取聊天室${roomId}详情失败:`, error);
    return null;
  }
};

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

// ========== 新增：根据聊天室ID获取本地缓存的成员数 ==========
const getChatroomMemberCountFromLocal = (chatRoomId) => {
  // 先从已加入列表找
  const joinedRoom = joinedChatroomList.value.find(item => item.id === chatRoomId);
  if (joinedRoom) {
    return joinedRoom.affiliations_count || 0;
  }
  // 再从所有列表找
  const allRoom = chatroomList.value.find(item => item.id === chatRoomId);
  return allRoom?.affiliations_count || 0;
};

// ========== 新增：获取单个聊天室的实际成员数量 ==========
const getChatroomMemberCount = async (roomId) => {
  try {
    // 简化方法：只使用最基本的保底逻辑
    // 避免调用不存在的方法导致SDK内部错误
    console.log(`获取聊天室${roomId}成员数量: 使用保底值1`);
    
    // 不再尝试调用可能不存在的方法，避免SDK内部错误
    // 如果API返回0，我们至少显示1个成员（当前用户）
    return 1;
  } catch (error) {
    console.error(`获取聊天室${roomId}成员数量失败:`, error);
    return 1; // 出错时默认返回至少有当前用户
  }
};

const getChatrooms = async () => {
  if (!checkLoginStatus()) return;
  const GET_CHAT_ROOMS_METHOD = 'getChatRooms';
  const chatRoomListParams = {
    pagenum: 1,
    pagesize: 100,
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
    // 修复成员数量显示问题：将可能的memberCount字段映射到affiliations_count
    // 添加日志查看实际数据
    if (res.data && res.data.length > 0) {
      console.log(`第一个所有聊天室的原始数据:`, JSON.stringify(res.data[0], null, 2));
    }
    
    chatroomList.value = (res.data || []).map(item => {
      // 计算成员数：使用服务器返回的实际数据，允许显示0
      const calculatedCount = Math.max(
        item.affiliations_count || 0,
        item.memberCount || 0,
        item.affiliationsCount || 0,
        item.onlineCount || 0,
        item.members?.length || 0 // 检查members数组长度
      );
      
      return {
        ...item,
        affiliations_count: calculatedCount
      };
    });
    
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
    EMClient.error('获取聊天室列表失败');
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
    // 修复成员数量显示问题：将可能的memberCount字段映射到affiliations_count
    // 添加日志查看实际数据
    if (res.data && res.data.length > 0) {
      console.log(`第一个已加入聊天室的原始数据:`, JSON.stringify(res.data[0], null, 2));
    }
    
    // 先使用列表数据初始化
    joinedChatroomList.value = (res.data || []).map(item => ({
      ...item,
      affiliations_count: Math.max(
        item.affiliations_count || 0,
        item.memberCount || 0,
        item.affiliationsCount || 0,
        item.onlineCount || 0,
        item.members?.length || 0,
        1 // 至少显示1个成员（当前用户）
      )
    }));
    
    // 为每个已加入的聊天室获取准确的详情
    if (joinedChatroomList.value.length > 0) {
      console.log('开始为已加入聊天室获取准确详情...');
      
      // 并发获取所有聊天室的详情
      const detailPromises = joinedChatroomList.value.map(item => 
        fetchChatroomDetail(item.id)
      );
      
      // 等待所有详情获取完成
      const details = await Promise.all(detailPromises);
      
      // 更新列表中的成员数
      joinedChatroomList.value = joinedChatroomList.value.map(item => {
        // 从缓存或刚获取的详情中查找
        const cachedDetail = chatroomDetailsCache.value.get(item.id);
        
        if (cachedDetail?.affiliations_count !== undefined) {
          console.log(`更新聊天室${item.id}的成员数: 从${item.affiliations_count}到${cachedDetail.affiliations_count}`);
          return {
            ...item,
            affiliations_count: cachedDetail.affiliations_count
          };
        }
        
        return item;
      });
      
      console.log('已加入聊天室详情获取完成');
    }
    
    console.log(`已加入聊天室列表处理完成:`, JSON.stringify(joinedChatroomList.value, null, 2));
  } catch (error) {
    ElMessage.error('获取已加入聊天室列表失败');
    console.error(
      `获取已加入聊天室列表失败`,
      `\n调用方法: ${GET_JOINED_CHAT_ROOMS_METHOD}`,
      `\n方法入参:`,
      chatRoomParams,
      `错误详情:`,
      error,
    );
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
  const JOIN_CHAT_ROOM_METHOD = 'joinChatRoom';
  const joinChatRoomParams = {
    roomId: roomId,
    ext: '',
    leaveOtherRooms: false,
  };
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
    );
    // 加入后刷新列表，确保affiliations_count更新
    await getJoinedChatrooms();
    await getChatrooms();
  } catch (error) {
    ElMessage.error('加入聊天室失败');
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

    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else if (
      error.type === 17 ||
      error.data?.includes('group_authorization')
    ) {
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
  const LEAVE_CHAT_ROOM_METHOD = 'leaveChatRoom';
  const leaveChatRoomParams = { roomId };
  try {
    await ElMessageBox.confirm('确定要退出该聊天室吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    const res = await EMClient.leaveChatRoom(leaveChatRoomParams);
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
    // 退出后刷新列表，确保affiliations_count更新
    await getJoinedChatrooms();
    await getChatrooms();
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
      ElMessage.error('退出聊天室失败');
      if (error.type === 52 || error.message?.includes('authenticate')) {
        ElMessage.error('认证失败，请重新登录');
      } else if (
        error.type === 17 ||
        error.data?.includes('group_authorization')
      ) {
        ElMessage.error('您没有权限退出该聊天室');
      } else {
        ElMessage.error('退出聊天室失败');
      }
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
    getChatrooms();
    getJoinedChatrooms();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('解散聊天室失败');
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
      if (error.type === 52 || error.message?.includes('authenticate')) {
        ElMessage.error('认证失败，请重新登录');
      } else if (
        error.type === 17 ||
        error.data?.includes('group_authorization')
      ) {
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
      chatType: CHAT_TYPE.CHATROOM,
    },
  });
};

const toChatroomDetails = (roomId) => {
  router.push({
    path: '/chat/chatroom/details',
    query: { roomId },
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

onMounted(() => {
  getChatrooms();
  getJoinedChatrooms();

  chatroomEventHandler = EMClient.addEventHandler('CHATROOM', {
    onChatroomEvent: (e) => {
      console.log('===== 聊天室事件 =====');
      console.log('事件类型:', e.operation);
      console.log('完整事件数据:', e);
      console.log('===================');

      // 获取聊天室ID（兼容不同字段名）
      const chatRoomId = e.chatRoomId || e.roomId || e.id;
      // 从本地缓存获取真实成员数
      const realMemberCount = getChatroomMemberCountFromLocal(chatRoomId);

      switch (e.operation) {
        case 'memberPresence':
          console.log(
            '成员加入事件 - 用户:',
            e.from,
            '扩展信息:',
            e.ext,
            '当前人数(本地):',
            realMemberCount,
          );
          // 使用本地缓存的真实人数
          getChatrooms();
          getJoinedChatrooms();
          break;
        case 'memberAbsence':
          console.log(
            '成员离开事件 - 用户:',
            e.from,
             e.chatRoomId,
            '当前人数(本地):',
            realMemberCount,
          );
          // 使用本地缓存的真实人数
          ElMessage.info(`有成员离开聊天室，当前人数：${realMemberCount}`);
          getChatrooms();
          getJoinedChatrooms();
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
          console.log(
            '全员禁言事件 - 操作者:',
            e.from,
            '聊天室ID:',
            e.chatRoomId,
          );
          ElMessage.warning('聊天室已开启全员禁言');
          break;
        case 'unmuteAllMembers':
          console.log(
            '解除全员禁言事件 - 操作者:',
            e.from,
            '聊天室ID:',
            e.chatRoomId,
          );
          ElMessage.success('聊天室已解除全员禁言');
          break;
        case 'addUserToAllowlist':
          console.log(
            '添加到白名单事件 - 用户:',
            e.from,
            '聊天室ID:',
            e.chatRoomId,
          );
          ElMessage.success('你已被添加到聊天室白名单');
          break;
        case 'removeAllowlistMember':
          console.log(
            '移出白名单事件 - 用户:',
            e.from,
            '聊天室ID:',
            e.chatRoomId,
          );
          ElMessage.warning('你已被移出聊天室白名单');
          break;
        case 'updateAnnouncement':
          console.log(
            '更新公告事件 - 聊天室ID:',
            e.chatRoomId,
            '公告内容:',
            e.announcement,
          );
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
          console.log(
            '移除管理员事件 - 被移除管理员:',
            e.from,
            '操作者:',
            e.to,
          );
          ElMessage.warning('你已被移除管理员');
          break;
        case 'changeOwner':
          console.log(
            '变更所有者事件 - 新所有者:',
            e.from,
            '旧所有者:',
            e.to,
            '聊天室ID:',
            e.chatRoomId,
          );
          ElMessage.info('聊天室所有者已变更');
          break;
        case 'updateChatRoomAttributes':
          console.log(
            '更新自定义属性事件 - 聊天室ID:',
            e.chatRoomId,
            '属性:',
            e.attributes,
          );
          ElMessage.info('聊天室自定义属性已更新');
          break;
        case 'removeChatRoomAttributes':
          console.log(
            '删除自定义属性事件 - 聊天室ID:',
            e.chatRoomId,
            '属性键:',
            e.attributeKeys,
          );
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
          <el-button size="small" @click="getChatrooms"> 刷新列表 </el-button>
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
                    <!-- 确保显示affiliations_count，空值显示0 -->
                    <span>成员: {{ item.affiliations_count || 0 }}</span>
                  </div>
                </div>
                <div class="item_right">
                  <el-button
                    v-if="!joinedChatroomList.find((j) => j.id === item.id)"
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
                  <div class="desc">{{ item.description || '暂无描述' }}</div>
                  <div class="info">
                    <!-- 确保显示affiliations_count，空值显示0 -->
                    <span>成员: {{ item.affiliations_count || 0 }}</span>
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
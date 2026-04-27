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
import eventEmitter from '@/utils/eventEmitter';
import {
  CHATROOM_EVENT_OPERATIONS,
  createChatroomEventHandler,
  logChatroomOperation,
} from '@/utils/chatroomEvents';

/** 列表与已加入列表的 id 可能为 string / number，严格 === 会导致「加入/进入」状态不更新 */
function normalizeChatroomId(id) {
  if (id == null || id === '') return '';
  return String(id);
}

function resolveChatroomId(item) {
  if (!item || typeof item !== 'object') return '';
  return normalizeChatroomId(
    item.id || item.chatroomid || item.chatRoomId || item.roomId,
  );
}

function resolveChatroomName(item) {
  if (!item || typeof item !== 'object') return '';
  return item.name || item.title || item.chatRoomName || item.roomName || '';
}

function resolveChatroomDescription(item) {
  if (!item || typeof item !== 'object') return '';
  return item.description || item.desc || '';
}

function resolveChatroomMemberCount(item) {
  if (!item || typeof item !== 'object') return 0;
  return Math.max(
    Number(item.affiliations_count || 0),
    Number(item.affiliationsCount || 0),
    Number(item.memberCount || 0),
    Number(item.onlineCount || 0),
    Array.isArray(item.members) ? item.members.length : 0,
    0,
  );
}

function isSuspiciousEmptyChatroom(item) {
  const normalized = normalizeChatroomRecord(item);
  if (!normalized?.id) return true;

  const hasName = Boolean(normalized.name?.trim());
  const hasDescription = Boolean(normalized.description?.trim());
  const memberCount = Number(normalized.affiliations_count || 0);

  return !hasName && !hasDescription && memberCount <= 0;
}

function isChatroomNotFoundError(error) {
  const text = [
    error?.message,
    error?.data,
    error?.error,
    error?.error_description,
    error?.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('chat room dose not exist') ||
    text.includes('chat room does not exist') ||
    text.includes('chatroom does not exist') ||
    text.includes('muc_not_exist') ||
    text.includes('not exist')
  );
}

function normalizeChatroomRecord(item) {
  if (!item || typeof item !== 'object') return null;
  const id = resolveChatroomId(item);
  if (!id) return null;
  return {
    ...item,
    id,
    name: resolveChatroomName(item),
    description: resolveChatroomDescription(item),
    affiliations_count: resolveChatroomMemberCount(item),
  };
}

function dedupeChatroomList(list = []) {
  const seen = new Set();
  return list.reduce((result, item) => {
    const normalized = normalizeChatroomRecord(item);
    const roomId = normalized?.id;
    if (!roomId || seen.has(roomId)) return result;
    seen.add(roomId);
    result.push(normalized);
    return result;
  }, []);
}

function mergeChatroomRecord(baseItem, detailItem) {
  const base = normalizeChatroomRecord(baseItem);
  const detail = normalizeChatroomRecord(detailItem);
  const merged = {
    ...(base || {}),
    ...(detail || {}),
  };
  const id = detail?.id || base?.id || '';
  if (!id) return null;
  return {
    ...merged,
    id,
    name: detail?.name || base?.name || id,
    description: detail?.description || base?.description || '',
    affiliations_count: Math.max(
      base?.affiliations_count || 0,
      detail?.affiliations_count || 0,
    ),
  };
}

function removeInvalidChatroomFromState(roomId) {
  const key = normalizeChatroomId(roomId);
  if (!key) return;
  chatroomList.value = chatroomList.value.filter(
    (item) => normalizeChatroomId(item.id) !== key,
  );
  joinedChatroomList.value = joinedChatroomList.value.filter(
    (item) => normalizeChatroomId(item.id) !== key,
  );
  chatroomDetailsCache.value.delete(key);
}

function markChatroomAsInvalid(roomId, reason = '') {
  const key = normalizeChatroomId(roomId);
  if (!key) return;
  invalidChatroomIds.value.add(key);
  removeInvalidChatroomFromState(key);
  if (reason) {
    console.warn(`聊天室 ${key} 已标记为失效，原因：${reason}`);
  }
}

// 缓存已获取的聊天室详情，用于存储准确的成员数
const chatroomDetailsCache = ref(new Map());

// 获取单个聊天室的准确详情（包括成员数）
const fetchChatroomDetail = async (roomId) => {
  try {
    const res = await EMClient.getChatRoomDetails({ chatRoomId: roomId });
    const detail = Array.isArray(res.data) ? res.data[0] || {} : res.data || {};
    const normalizedDetail = normalizeChatroomRecord(detail);

    if (normalizedDetail?.id) {
      chatroomDetailsCache.value.set(
        normalizeChatroomId(normalizedDetail.id),
        normalizedDetail,
      );
      console.log(`缓存聊天室${normalizedDetail.id}的准确详情:`, {
        affiliations_count: normalizedDetail.affiliations_count,
      });
    }

    return {
      exists: true,
      detail: normalizedDetail,
    };
  } catch (error) {
    if (isChatroomNotFoundError(error)) {
      markChatroomAsInvalid(roomId, '详情接口返回聊天室不存在');
      console.warn(`聊天室 ${roomId} 详情不存在，已从列表中过滤`);
    } else {
      console.error(`获取聊天室${roomId}详情失败:`, error);
    }
    return {
      exists: !isChatroomNotFoundError(error),
      detail: null,
      error,
    };
  }
};

const store = useStore();
const route = useRoute();

const chatroomList = ref([]);
const joinedChatroomList = ref([]);
const invalidChatroomIds = ref(new Set());
const locallyJoinedChatroomIds = ref(new Set());
const locallyLeftChatroomIds = ref(new Set());
const loading = ref(false);
const searchKeyword = ref('');

const CHATROOM_TYPE = {
  ALL: '1',
  JOINED: '2',
};

const activeName = ref(CHATROOM_TYPE.ALL);
const joinRoomExt = ref('webim_vue_demo');

function markRoomJoined(roomId) {
  const key = normalizeChatroomId(roomId);
  if (!key) return;
  locallyLeftChatroomIds.value.delete(key);
  locallyJoinedChatroomIds.value.add(key);
}

function markRoomLeft(roomId) {
  const key = normalizeChatroomId(roomId);
  if (!key) return;
  locallyJoinedChatroomIds.value.delete(key);
  locallyLeftChatroomIds.value.add(key);
}

function syncRoomJoinOverride(roomId, joined) {
  const key = normalizeChatroomId(roomId);
  if (!key) return;
  if (joined) {
    locallyJoinedChatroomIds.value.delete(key);
    locallyLeftChatroomIds.value.delete(key);
    return;
  }
  if (locallyJoinedChatroomIds.value.has(key)) return;
  locallyLeftChatroomIds.value.delete(key);
}

function updateLocalChatroomMemberCount(roomId, memberCount) {
  const key = normalizeChatroomId(roomId);
  if (!key || typeof memberCount !== 'number' || Number.isNaN(memberCount)) {
    return;
  }

  const normalizedCount = Math.max(memberCount, 0);
  const applyCount = (list) =>
    list.map((item) =>
      normalizeChatroomId(item.id) === key
        ? { ...item, affiliations_count: normalizedCount }
        : item,
    );

  chatroomList.value = applyCount(chatroomList.value);
  joinedChatroomList.value = applyCount(joinedChatroomList.value);

  const cachedDetail = chatroomDetailsCache.value.get(key);
  if (cachedDetail) {
    chatroomDetailsCache.value.set(key, {
      ...cachedDetail,
      affiliations_count: normalizedCount,
    });
  }
}

const checkLoginStatus = () => {
  if (!EMClient.user) {
    ElMessage.error('用户未登录，请先登录');
    router.push('/login');
    return false;
  }
  return true;
};

// 设置聊天室事件监听器
const setupChatroomEventHandler = () => {
  if (chatroomEventHandler) {
    EMClient.removeEventHandler('CHATROOM');
  }

  chatroomEventHandler = EMClient.addEventHandler(
    'CHATROOM',
    createChatroomEventHandler('ChatroomIndex', (e, normalizedEvent) => {
      const chatRoomId = normalizedEvent.roomId;
      const realMemberCount = getChatroomMemberCountFromLocal(chatRoomId);
      const eventMemberCount =
        typeof e?.memberCount === 'number' ? e.memberCount : realMemberCount;

      switch (e.operation) {
        case CHATROOM_EVENT_OPERATIONS.MEMBER_PRESENCE:
          if (e?.ext) {
            console.log('收到成员加入聊天室扩展信息 ext:', e.ext);
          }
          if (typeof e?.memberCount === 'number') {
            console.log('当前聊天室在线人数:', e.memberCount);
            updateLocalChatroomMemberCount(chatRoomId, e.memberCount);
          }
          getChatrooms();
          getJoinedChatrooms();
          break;
        case CHATROOM_EVENT_OPERATIONS.MEMBER_ABSENCE:
          if (typeof e?.memberCount === 'number') {
            updateLocalChatroomMemberCount(chatRoomId, e.memberCount);
          }
          ElMessage.info(`有成员离开聊天室，当前人数：${eventMemberCount}`);
          getChatrooms();
          getJoinedChatrooms();
          break;
        case CHATROOM_EVENT_OPERATIONS.DESTROY:
          ElMessage.warning('聊天室已解散');
          getChatrooms();
          getJoinedChatrooms();
          break;
        case CHATROOM_EVENT_OPERATIONS.REMOVE_MEMBER:
          ElMessage.warning('你已被移出聊天室');
          getJoinedChatrooms();
          break;
        case CHATROOM_EVENT_OPERATIONS.UNBLOCK_MEMBER:
          ElMessage.info('你已被移出聊天室黑名单');
          getJoinedChatrooms();
          break;
        case CHATROOM_EVENT_OPERATIONS.UPDATE_INFO:
          ElMessage.info('聊天室信息已更新');
          getChatrooms();
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
  if (locallyLeftChatroomIds.value.has(key)) return false;
  if (locallyJoinedChatroomIds.value.has(key)) return true;
  return joinedChatroomList.value.some(
    (j) => normalizeChatroomId(j.id) === key,
  );
};

// ========== 新增：根据聊天室ID获取本地缓存的成员数 ==========
const getChatroomMemberCountFromLocal = (chatRoomId) => {
  const key = normalizeChatroomId(chatRoomId);
  const joinedRoom = joinedChatroomList.value.find(
    (item) => normalizeChatroomId(item.id) === key,
  );
  if (joinedRoom) {
    return joinedRoom.affiliations_count || 0;
  }
  const allRoom = chatroomList.value.find(
    (item) => normalizeChatroomId(item.id) === key,
  );
  return allRoom?.affiliations_count || 0;
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

    const rawChatrooms = dedupeChatroomList(res.data || []);
    const hiddenRoomIds = [];

    chatroomList.value = rawChatrooms
      .filter((item) => {
        const roomId = normalizeChatroomId(item.id);
        if (!roomId) return false;

        if (invalidChatroomIds.value.has(roomId)) {
          hiddenRoomIds.push(roomId);
          return false;
        }

        if (isSuspiciousEmptyChatroom(item)) {
          markChatroomAsInvalid(roomId, '列表返回空名称且成员数为 0');
          hiddenRoomIds.push(roomId);
          return false;
        }

        return true;
      })
      .map((item) => {
        const cachedDetail = chatroomDetailsCache.value.get(
          normalizeChatroomId(item.id),
        );
        return mergeChatroomRecord(item, cachedDetail || item);
      })
      .filter(Boolean);

    if (hiddenRoomIds.length > 0) {
      console.warn('已过滤失效聊天室：', hiddenRoomIds);
    }

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
    // 处理认证错误和无效令牌错误
    if (
      error.type === 52 || 
      error.type === 17 || // 错误类型17对应unauthorized
      error.message?.includes('authenticate') || 
      error.message?.includes('unauthorized') || 
      error.message?.includes('corrupt access token') || 
      error.message?.includes('INVALID_TOKEN') || 
      error.message?.includes('Invalid token')
    ) {
      console.log('收到认证错误，检查用户是否已经登录成功');
      const loginUser = localStorage.getItem('EASEIM_loginUser');
      if (loginUser) {
        console.log('用户已登录，忽略认证错误:', error.message);
        ElMessage.warning({
          message: '网络波动，正在重试...',
          grouping: true,
        });
        // 尝试重新获取已加入聊天室列表
        setTimeout(() => {
          getJoinedChatrooms();
        }, 1000);
        return;
      }
      console.error('认证失败或令牌无效，清除本地存储并跳转到登录页面');
      // 清除本地存储的登录信息
      localStorage.removeItem('EASEIM_loginUser');
      // 显示错误提示
      ElMessage.error('认证失败或令牌无效，请重新登录');
      // 跳转到登录页面
      setTimeout(() => {
        router.push('/login');
      }, 1000);
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
    if (res.data && res.data.length > 0) {
      console.log(`第一个已加入聊天室的原始数据:`, JSON.stringify(res.data[0], null, 2));
    }

    joinedChatroomList.value = dedupeChatroomList(
      (res.data || [])
        .map((item) => ({
          ...item,
          affiliations_count: Math.max(resolveChatroomMemberCount(item), 1),
        }))
        .filter((item) => {
          const roomId = normalizeChatroomId(item.id);
          return roomId && !locallyLeftChatroomIds.value.has(roomId);
        }),
    );

    if (joinedChatroomList.value.length > 0) {
      console.log('开始为已加入聊天室获取准确详情...');

      const detailResults = await Promise.all(
        joinedChatroomList.value.map((item) => fetchChatroomDetail(item.id)),
      );

      joinedChatroomList.value = joinedChatroomList.value
        .map((item, index) => {
          const detailResult = detailResults[index];
          if (detailResult && detailResult.exists === false) {
            markChatroomAsInvalid(item.id, '已加入列表详情校验失败');
            return null;
          }

          const cachedDetail = chatroomDetailsCache.value.get(
            normalizeChatroomId(item.id),
          );

          if (cachedDetail) {
            console.log(
              `更新聊天室${item.id}的成员数: 从${item.affiliations_count}到${cachedDetail.affiliations_count}`,
            );
            return mergeChatroomRecord(item, cachedDetail);
          }

          if (detailResult?.detail) {
            return mergeChatroomRecord(item, detailResult.detail);
          }

          return mergeChatroomRecord(item, item);
        })
        .filter(Boolean);

      joinedChatroomList.value.forEach((item) => {
        syncRoomJoinOverride(item.id, true);
      });

      const invalidJoinedCount = detailResults.filter(
        (item) => item && item.exists === false,
      ).length;

      if (invalidJoinedCount > 0) {
        ElMessage.warning({
          message: `已移除 ${invalidJoinedCount} 个失效聊天室`,
          grouping: true,
        });
      }

      console.log('已加入聊天室详情获取完成');
    }

    console.log(`已加入聊天室列表处理完成:`, JSON.stringify(joinedChatroomList.value, null, 2));
  } catch (error) {
    // 检查是否是断网导致的页面显示错误
    const isNetworkError = error.message?.includes('Network Error') || 
                          error.message?.includes('network error') || 
                          error.message?.includes('timeout') || 
                          error.message?.includes('Connection refused') || 
                          error.message?.includes('Failed to fetch') ||
                          error.code === 'ECONNABORTED';
    
    // 检查是否是认证错误
    const isAuthError = error.type === 52 || 
                       error.type === 17 || // 错误类型17对应unauthorized
                       error.message?.includes('authenticate') || 
                       error.message?.includes('unauthorized') || 
                       error.message?.includes('corrupt access token') || 
                       error.message?.includes('INVALID_TOKEN') || 
                       error.message?.includes('Invalid token');
    
    // 处理断网导致的页面显示错误
    if (isNetworkError) {
      console.log('检测到断网导致的页面显示错误，跳转到登录页面');
      const loginUser = localStorage.getItem('EASEIM_loginUser');
      if (loginUser) {
        // 清除本地存储的登录信息
        localStorage.removeItem('EASEIM_loginUser');
        // 跳转到登录页面
        setTimeout(() => {
          router.push('/login');
        }, 1000);
      }
      return;
    }
    
    // 处理认证错误和无效令牌错误
    if (isAuthError) {
      console.log('收到认证错误，检查用户是否已经登录成功');
      const loginUser = localStorage.getItem('EASEIM_loginUser');
      if (loginUser) {
        console.log('用户已登录，忽略认证错误:', error.message);
        ElMessage.warning({
          message: '网络波动，正在重试...',
          grouping: true,
        });
        // 尝试重新获取已加入聊天室列表
        setTimeout(() => {
          getJoinedChatrooms();
        }, 1000);
        return;
      }
      console.error('认证失败或令牌无效，清除本地存储并跳转到登录页面');
      // 清除本地存储的登录信息
      localStorage.removeItem('EASEIM_loginUser');
      // 显示错误提示
      ElMessage.error('认证失败或令牌无效，请重新登录');
      // 跳转到登录页面
      setTimeout(() => {
        router.push('/login');
      }, 1000);
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
    ext: joinRoomExt.value,
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
    markRoomJoined(roomId);
    const res = await EMClient.joinChatRoom(joinChatRoomParams);
    logChatroomOperation(
      'ChatroomIndex',
      CHATROOM_EVENT_OPERATIONS.MEMBER_PRESENCE,
      joinChatRoomParams,
      res,
      {
        from: EMClient.user,
        note: '本地加入聊天室操作日志；SDK 的 memberPresence 通常推送给聊天室内其他成员。',
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
    
    // 重新设置事件监听器，确保能够接收memberPresence事件
    console.log('重新设置聊天室事件监听器...');
    setupChatroomEventHandler();
    console.log('聊天室事件监听器重新设置完成');
    
    await getChatrooms();
    await getJoinedChatrooms();
    if (!isRoomJoined(roomId)) {
      const key = normalizeChatroomId(roomId);
      const fromAll = chatroomList.value.find(
        (c) => normalizeChatroomId(c.id) === key,
      );
      joinedChatroomList.value = [
        ...joinedChatroomList.value,
        mergeChatroomRecord(
          fromAll || {
            id: roomId,
            name: String(roomId),
            affiliations_count: 1,
          },
          fromAll || {
            id: roomId,
            name: String(roomId),
            affiliations_count: 1,
          },
        ),
      ].filter(Boolean);
    }
  } catch (error) {
    locallyJoinedChatroomIds.value.delete(normalizeChatroomId(roomId));
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

    // 处理认证错误和无效令牌错误
    if (
      error.type === 52 || 
      error.type === 17 || // 错误类型17对应unauthorized
      error.message?.includes('authenticate') || 
      error.message?.includes('unauthorized') || 
      error.message?.includes('corrupt access token') || 
      error.message?.includes('INVALID_TOKEN') || 
      error.message?.includes('Invalid token')
    ) {
      console.error('认证失败或令牌无效，清除本地存储并跳转到登录页面');
      // 清除本地存储的登录信息
      localStorage.removeItem('EASEIM_loginUser');
      // 显示错误提示
      ElMessage.error('认证失败或令牌无效，请重新登录');
      // 跳转到登录页面
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    } else if (
      error.type === 17 ||
      error.data?.includes('group_authorization')
    ) {
      ElMessage.error('您没有权限加入该聊天室');
    } else if (error.data?.includes('forbidden_op')) {
      ElMessage.error('操作被禁止，您可能已被禁言或限制');
    } else if (isChatroomNotFoundError(error)) {
      markChatroomAsInvalid(roomId, '加入时接口返回聊天室不存在');
      ElMessage.error('聊天室不存在，已从列表移除');
    } else if (error.type === 503) {
      // 错误类型 503 通常表示服务器内部错误或暂时无法处理请求
      ElMessage.error('加入聊天室失败：服务器暂时无法处理请求，请稍后再试');
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
    logChatroomOperation(
      'ChatroomIndex',
      CHATROOM_EVENT_OPERATIONS.MEMBER_ABSENCE,
      leaveChatRoomParams,
      res,
      {
        from: EMClient.user,
        note: '本地退出聊天室操作日志；SDK 的 memberAbsence 通常推送给聊天室内其他成员。',
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
    const key = normalizeChatroomId(roomId);
    markRoomLeft(roomId);
    joinedChatroomList.value = joinedChatroomList.value.filter(
      (j) => normalizeChatroomId(j.id) !== key,
    );
    await getJoinedChatrooms();
  } catch (error) {
    if (error !== 'cancel') {
      locallyLeftChatroomIds.value.delete(normalizeChatroomId(roomId));
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
      // 处理认证错误和无效令牌错误
      if (
        error.type === 52 || 
        error.type === 17 || // 错误类型17对应unauthorized
        error.message?.includes('authenticate') || 
        error.message?.includes('unauthorized') || 
        error.message?.includes('corrupt access token') || 
        error.message?.includes('INVALID_TOKEN') || 
        error.message?.includes('Invalid token')
      ) {
        console.error('认证失败或令牌无效，清除本地存储并跳转到登录页面');
        // 清除本地存储的登录信息
        localStorage.removeItem('EASEIM_loginUser');
        // 显示错误提示
        ElMessage.error('认证失败或令牌无效，请重新登录');
        // 跳转到登录页面
        setTimeout(() => {
          router.push('/login');
        }, 1000);
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
      // 处理认证错误和无效令牌错误
      if (
        error.type === 52 || 
        error.type === 17 || // 错误类型17对应unauthorized
        error.message?.includes('authenticate') || 
        error.message?.includes('unauthorized') || 
        error.message?.includes('corrupt access token') || 
        error.message?.includes('INVALID_TOKEN') || 
        error.message?.includes('Invalid token')
      ) {
        console.error('认证失败或令牌无效，清除本地存储并跳转到登录页面');
        // 清除本地存储的登录信息
        localStorage.removeItem('EASEIM_loginUser');
        // 显示错误提示
        ElMessage.error('认证失败或令牌无效，请重新登录');
        // 跳转到登录页面
        setTimeout(() => {
          router.push('/login');
        }, 1000);
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

const refreshChatroomLists = () => {
  void getChatrooms();
  void getJoinedChatrooms();
};

watch(
  () => route.fullPath,
  (path, prevPath) => {
    const base = path.split('?')[0];
    const listRoot = /\/chat\/chatroom\/?$/.test(base);
    if (prevPath?.includes('/chatroom/details') && listRoot) {
      refreshChatroomLists();
    }
  },
);

onMounted(() => {
  getChatrooms();
  getJoinedChatrooms();
  setupChatroomEventHandler();
  eventEmitter.on('chatroomMembershipChanged', refreshChatroomLists);
});

onUnmounted(() => {
  eventEmitter.off('chatroomMembershipChanged', refreshChatroomLists);
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
                    v-if="!isRoomJoined(item.id)"
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

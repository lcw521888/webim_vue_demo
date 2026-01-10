<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { EMClient } from '@/IM';

const route = useRoute();
const router = useRouter();

const activeTab = ref('members');
const loading = ref(false);
const chatRoomId = ref(route.query.roomId);

const members = ref([]);
const blocklist = ref([]);
const allowlist = ref([]);
const mutelist = ref([]);
const admins = ref([]);
const isMuteAll = ref(false);
const muteInput = ref('');

const blocklistInput = ref('');
const allowlistInput = ref('');
const adminInput = ref('');

const isOwner = computed(() => {
  return chatRoomId.value && chatroomDetails.value?.owner === EMClient.user;
});

// 定义聊天室详情响应式变量
const chatroomDetails = ref({});

const checkLoginStatus = () => {
  if (!EMClient.user) {
    ElMessage.error('用户未登录，请先登录');
    router.push('/login');
    return false;
  }
  return true;
};
//获取聊天室成员
const getChatRoomMembers = async () => {
  if (!checkLoginStatus()) return;
  
  if (!chatRoomId.value) {
    console.error('chatRoomId 不存在:', chatRoomId.value);
    return;
  }
  const LIST_CHAT_ROOM_MEMBERS_METHOD = 'listChatRoomMembers';
  const memberListParams = {
    chatRoomId: chatRoomId.value,
    pageNum: 1,
    pageSize: 50
  };
  loading.value = true;
  try {
    // 先获取聊天室详情和管理员列表
    await Promise.all([getChatroomDetails(), getChatRoomAdmin()]);
    
    console.log(
      `开始获取聊天室成员:`,
      `\n调用方法: ${LIST_CHAT_ROOM_MEMBERS_METHOD}`,
      `\n方法入参:`, memberListParams,
      `\n目标聊天室ID:`, chatRoomId.value,
      `\n当前用户:`, EMClient.user
    );
    const res = await EMClient.listChatRoomMembers(memberListParams);
    console.log(
      `获取聊天室成员成功:`,
      `\n调用方法: ${LIST_CHAT_ROOM_MEMBERS_METHOD}`,
      `\n方法入参:`, memberListParams,
      `\n原始返回数据:`, res,
      `\n返回数据 data 字段:`, res.data,
      `\ndata 字段类型:`, typeof res.data,
      `\ndata 字段是否为数组:`, Array.isArray(res.data)
    );
    
    // 获取所有者ID和管理员列表
    const ownerId = chatroomDetails.value?.owner;
    const adminIds = admins.value.map(admin => admin.userId);
    
    members.value = (res.data || []).map(item => {
      console.log('处理成员项:', item);
      const userId = item.member || item.owner;
      // 确定用户角色
      let role = 'member'; // 默认是普通成员
      if (userId === ownerId) {
        role = 'owner'; // 所有者
      } else if (adminIds.includes(userId)) {
        role = 'admin'; // 管理员
      }
      
      return {
        ...item,
        userId,
        role // 添加角色信息
      };
    });
    
    ElMessage.success('获取聊天室成员成功');
    console.log(
      `聊天室成员列表处理完成:`,
      `\n调用方法: ${LIST_CHAT_ROOM_MEMBERS_METHOD}`,
      `\n处理后的成员列表:`, members.value,
      `\n成员总数:`, members.value.length
    );

  } catch (error) {
    ElMessage.error('获取聊天室成员失败');
    console.error(
      `获取聊天室成员失败:`,
      `\n调用方法: ${LIST_CHAT_ROOM_MEMBERS_METHOD}`,
      `\n方法入参:`, memberListParams,
      `\n目标聊天室ID:`, chatRoomId.value,
      `\n当前用户:`, EMClient.user,
      `\n错误类型:`, error.type,
      `\n错误消息:`, error.message,
      `\n完整错误信息:`, error
    );
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('获取聊天室成员失败');
    }
  } finally {
    loading.value = false;
  }
};

const getChatRoomBlocklist = async () => {
  if (!checkLoginStatus()) return;
  if (!chatRoomId.value) return;
  const GET_CHAT_ROOM_BLOCKLIST_METHOD = 'getChatRoomBlocklist';
  const targetRoomId = chatRoomId.value;
  loading.value = true;
  try {
     console.log(
      `开始获取聊天室黑名单:`,
      `\n调用方法: ${GET_CHAT_ROOM_BLOCKLIST_METHOD}`,
      `\n目标聊天室ID:`, targetRoomId,
      `\n当前操作用户:`, EMClient.user
    );
    const res = await EMClient.getChatRoomBlocklist({ chatRoomId: chatRoomId.value });
    console.log(
      `获取聊天室黑名单成功:`,
      `\n调用方法: ${GET_CHAT_ROOM_BLOCKLIST_METHOD}`,
      `\n方法入参:`, blocklistParams,
      `\n原始返回数据:`, res,
      `\n返回数据 data 字段:`, res.data,
      `\ndata 字段类型:`, typeof res.data,
      `\ndata 字段是否为数组:`, Array.isArray(res.data)
    );
    
    if (Array.isArray(res.data)) {
      blocklist.value = res.data.map(userId => {
        console.log('处理黑名单项:', userId);
        EMClient.success(`用户 ${userId} 已被成功添加到黑名单`);
        return { userId };
      });
    } else {
      console.warn('res.data 不是数组，使用空数组');
      blocklist.value = [];
    }
    console.log('处理后的黑名单列表:', blocklist.value);
  } catch (error) {
    console.error(
      EMClient.error(`获取聊天室黑名单失败: 用户 ${userId} 未成功添加到黑名单`),
      `\n调用方法: ${GET_CHAT_ROOM_BLOCKLIST_METHOD}`,
      `\n目标聊天室ID:`, targetRoomId,
      `\n当前用户:`, EMClient.user,
      `\n错误类型:`, error.type,
      `\n错误消息:`, error.message,
      `\n完整错误信息:`, error
    );
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('获取聊天室黑名单失败');
    }
    blocklist.value = [];
  } finally {
    loading.value = false;
  }
};

const getChatRoomAllowlist = async () => {
  if (!checkLoginStatus()) return;
  if (!chatRoomId.value) return;
  loading.value = true;
  try {
    console.log('开始获取聊天室白名单，chatRoomId:', chatRoomId.value);
    const res = await EMClient.getChatRoomAllowlist({ chatRoomId: chatRoomId.value });
    console.log('获取聊天室白名单成功 - 原始数据:', res);

    
    if (Array.isArray(res.data)) {
      allowlist.value = res.data.map(userId => {
        console.log('处理白名单项:', userId);
        return { userId };
      });
    } else {
      console.warn('res.data 不是数组，使用空数组');
      allowlist.value = [];
    }
    console.log('处理后的白名单列表:', allowlist.value);
  } catch (error) {
    console.error('获取聊天室白名单失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('获取聊天室白名单失败');
    }
    allowlist.value = [];
  } finally {
    loading.value = false;
  }
};

const getChatRoomMutelist = async () => {
  if (!checkLoginStatus()) return;
  if (!chatRoomId.value) return;
  loading.value = true;
  try {
    console.log('开始获取聊天室禁言列表，chatRoomId:', chatRoomId.value);
    const res = await EMClient.getChatRoomMutelist({ chatRoomId: chatRoomId.value });
    console.log('获取聊天室禁言列表成功 - 原始数据:', res);
    
    // 获取单独禁言的用户列表
    let 单独禁言用户列表 = [];
    if (Array.isArray(res.data)) {
      单独禁言用户列表 = res.data.map(item => ({
        userId: item.user || item.userId,
        expire: item.expire,
        type: 'single' // 标记为单独禁言
      }));
    }
    
    // 如果开启了全员禁言，将所有普通成员添加到禁言列表中
    if (isMuteAll.value && members.value.length > 0) {
      console.log('全员禁言开启，将所有普通成员添加到禁言列表中');
      
      // 获取管理员列表
      const adminList = admins.value.map(admin => admin.userId);
      
      // 获取所有者ID
      const ownerId = chatroomDetails.value?.owner;
      
      // 将成员列表中的普通成员（非管理员、非所有者）添加到禁言列表
      const 全员禁言用户列表 = members.value
        .filter(member => member.userId !== ownerId && !adminList.includes(member.userId))
        .map(member => ({
          userId: member.userId,
          expire: -1, // 表示全员禁言状态，没有具体的过期时间
          type: 'all' // 标记为全员禁言
        }));
      
      // 合并单独禁言和全员禁言的用户列表，去重（优先保留单独禁言的记录）
      const 合并后的禁言列表 = [...单独禁言用户列表];
      const 单独禁言用户ID集合 = new Set(单独禁言用户列表.map(user => user.userId));
      
      全员禁言用户列表.forEach(user => {
        if (!单独禁言用户ID集合.has(user.userId)) {
          合并后的禁言列表.push(user);
        }
      });
      
      mutelist.value = 合并后的禁言列表;
    } else {
      // 如果没有开启全员禁言或成员列表为空，只显示单独禁言的用户
      mutelist.value = 单独禁言用户列表;
    }
    
    console.log('处理后的禁言列表:', mutelist.value);
  } catch (error) {
    console.error('获取聊天室禁言列表失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('获取聊天室禁言列表失败');
    }
    mutelist.value = [];
  } finally {
    loading.value = false;
  }
};

const getChatRoomAdmin = async () => {
  if (!checkLoginStatus()) return;
  if (!chatRoomId.value) return;
  loading.value = true;
  try {
    console.log('开始获取聊天室管理员，chatRoomId:', chatRoomId.value);
    const res = await EMClient.getChatRoomAdmin({ chatRoomId: chatRoomId.value });
    console.log('获取聊天室管理员成功 - 原始数据:', res);
    console.log('获取聊天室管理员成功 - res.data:', res.data);
    console.log('获取聊天室管理员成功 - res.data 类型:', typeof res.data);
    console.log('获取聊天室管理员成功 - res.data 是否为数组:', Array.isArray(res.data));
    admins.value = (res.data || []).map(userId => ({ userId }));
    console.log('处理后的管理员列表:', admins.value);
  } catch (error) {
    console.error('获取聊天室管理员失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('获取聊天室管理员失败');
    }
  } finally {
    loading.value = false;
  }
};

const handleTabChange = (tab) => {
  switch (tab) {
    case 'members':
      getChatRoomMembers();
      break;
    case 'blocklist':
      getChatRoomBlocklist();
      break;
    case 'allowlist':
      getChatRoomAllowlist();
      break;
    case 'mutelist':
      getChatRoomMutelist();
      break;
    case 'admins':
      getChatRoomAdmin();
      break;
  }
};

const addToBlocklist = async (username) => {
  if (!checkLoginStatus()) return;
  
  if (!username || !username.trim()) {
    ElMessage.warning('请输入用户ID');
    return;
  }
  if (!chatRoomId.value) {
    ElMessage.error('聊天室ID不存在');
    return;
  }
  const trimmedUsername = username.trim();
  console.log('添加到黑名单 - chatRoomId:', chatRoomId.value, 'username:', trimmedUsername);
  try {
    await EMClient.blockChatRoomMember({ 
      chatRoomId: chatRoomId.value, 
      username: trimmedUsername 
    });
    ElMessage.success('添加到黑名单成功');
    blocklistInput.value = '';
    getChatRoomBlocklist();
  } catch (error) {
    console.error('添加到黑名单失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error(`添加到黑名单失败: ${error.message || '未知错误'}`);
    }
  }
};

const removeFromBlocklist = async (username) => {
  if (!checkLoginStatus()) return;
  
  try {
    await EMClient.unblockChatRoomMember({ 
      chatRoomId: chatRoomId.value, 
      username 
    });
    ElMessage.success('从黑名单移除成功');
    getChatRoomBlocklist();
  } catch (error) {
    console.error('从黑名单移除失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('从黑名单移除失败');
    }
  }
};

const addToAllowlist = async (username) => {
  if (!checkLoginStatus()) return;
  
  if (!username || !username.trim()) {
    ElMessage.warning('请输入用户ID');
    return;
  }
  if (!chatRoomId.value) {
    ElMessage.error('聊天室ID不存在');
    return;
  }
  const trimmedUsername = username.trim();
  console.log('添加到白名单 - chatRoomId:', chatRoomId.value, 'users:', [trimmedUsername]);
  try {
    await EMClient.addUsersToChatRoomAllowlist({ 
      chatRoomId: chatRoomId.value, 
      users: [trimmedUsername] 
    });
    ElMessage.success('添加到白名单成功');
    allowlistInput.value = '';
    getChatRoomAllowlist();
  } catch (error) {
    console.error('添加到白名单失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error(`添加到白名单失败: ${error.message || '未知错误'}`);
    }
  }
};

const removeFromAllowlist = async (username) => {
  if (!checkLoginStatus()) return;
  
  try {
    await EMClient.removeUserFromChatRoomAllowlist({ 
      chatRoomId: chatRoomId.value, 
      username 
    });
    ElMessage.success('从白名单移除成功');
    getChatRoomAllowlist();
  } catch (error) {
    console.error('从白名单移除失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('从白名单移除失败');
    }
  }
};

const muteMember = async (username, duration = -1000) => {
  if (!checkLoginStatus()) return;
  
  if (!username || !username.trim()) {
    ElMessage.warning('请输入用户ID');
    return;
  }
  const trimmedUsername = username.trim();
  try {
    await EMClient.muteChatRoomMember({ 
      chatRoomId: chatRoomId.value, 
      username: trimmedUsername,
      muteDuration: duration 
    });
    ElMessage.success('禁言成功');
    muteInput.value = '';
    getChatRoomMutelist();
  } catch (error) {
    console.error('禁言失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else if (error.type === 702) {
      if (error.message?.includes('are not members of this group')) {
        ElMessage.error(`用户 ${trimmedUsername} 不是聊天室成员，无法禁言`);
      } else {
        ElMessage.error('禁言失败：参数错误');
      }
    } else {
      ElMessage.error('禁言失败');
    }
  }
};

const unmuteMember = async (username) => {
  try {
    await EMClient.unmuteChatRoomMember({ 
      chatRoomId: chatRoomId.value, 
      username 
    });
    ElMessage.success('解除禁言成功');
    getChatRoomMutelist();
  } catch (error) {
    console.error('解除禁言失败', error);
    ElMessage.error('解除禁言失败');
  }
};

const muteAllMembers = async () => {
  if (!isOwner.value) {
    ElMessage.error('只有聊天室所有者才能执行全员禁言操作');
    return;
  }
  
  try {
    await EMClient.disableSendChatRoomMsg({ chatRoomId: chatRoomId.value });
    isMuteAll.value = true;
    ElMessage.success('全员禁言成功');
    
    // 先获取最新的成员列表和管理员列表，然后再更新禁言列表
    await Promise.all([getChatRoomMembers(), getChatRoomAdmin()]);
    getChatRoomMutelist();
  } catch (error) {
    console.error('全员禁言失败', error);
    ElMessage.error('全员禁言失败');
  }
};

const unmuteAllMembers = async () => {
  if (!isOwner.value) {
    ElMessage.error('只有聊天室所有者才能执行取消全员禁言操作');
    return;
  }
  
  try {
    await EMClient.enableSendChatRoomMsg({ chatRoomId: chatRoomId.value });
    isMuteAll.value = false;
    ElMessage.success('取消全员禁言成功');
    getChatRoomMutelist();
  } catch (error) {
    console.error('取消全员禁言失败', error);
    ElMessage.error('取消全员禁言失败');
  }
};

const setAdmin = async (username) => {
  if (!username || !username.trim()) {
    ElMessage.warning('请输入用户ID');
    return;
  }
  if (!chatRoomId.value) {
    ElMessage.error('聊天室ID不存在');
    return;
  }
  const trimmedUsername = username.trim();
  
  try {
    const res = await EMClient.getChatRoomDetails({ chatRoomId: chatRoomId.value });
    const owner = res.data?.[0]?.owner;
    console.log('聊天室所有者:', owner);
    
    if (trimmedUsername === owner) {
      ElMessage.warning('该用户是聊天室所有者，无需设置为管理员');
      adminInput.value = '';
      return;
    }
  } catch (error) {
    console.error('获取聊天室详情失败', error);
  }
  
  console.log('设置管理员 - chatRoomId:', chatRoomId.value, 'username:', trimmedUsername);
  try {
    await EMClient.setChatRoomAdmin({ 
      chatRoomId: chatRoomId.value, 
      username: trimmedUsername 
    });
    ElMessage.success('设置管理员成功');
    adminInput.value = '';
    // 更新管理员列表和成员列表中的角色信息
    await getChatRoomAdmin();
    await getChatRoomMembers();
  } catch (error) {
    console.error('设置管理员失败', error);
    ElMessage.error(`设置管理员失败: ${error.message || '未知错误'}`);
  }
};

const removeAdmin = async (username) => {
  try {
    await EMClient.removeChatRoomAdmin({ 
      chatRoomId: chatRoomId.value, 
      username 
    });
    ElMessage.success('移除管理员成功');
    // 更新管理员列表和成员列表中的角色信息
    await getChatRoomAdmin();
    await getChatRoomMembers();
  } catch (error) {
    console.error('移除管理员失败', error);
    ElMessage.error('移除管理员失败');
  }
};

const removeMember = async (username) => {
  try {
    await ElMessageBox.confirm(`确定要将 ${username} 移出聊天室吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    const REMOVE_CHAT_ROOM_MEMBER_METHOD = 'removeChatRoomMember';
    const removeMemberParams = { 
      chatRoomId: chatRoomId.value, 
      username 
    };
    const res = await EMClient.removeChatRoomMember(removeMemberParams);
    console.log(
      `移出聊天室成员成功:`,
      `\n调用方法: ${REMOVE_CHAT_ROOM_MEMBER_METHOD}`,
      `\n方法入参:`, removeMemberParams,
      `\n接口返回结果:`, res,
      `\n已移出成员:`, username,
      `\n操作聊天室ID:`, chatRoomId.value,
      `\n后续操作: 重新获取聊天室成员列表`
    );
    ElMessage.success('移出聊天室成功');
    getChatRoomMembers();
  } catch (error) {
    if (error !== 'cancel') {
      const REMOVE_CHAT_ROOM_MEMBER_METHOD = 'removeChatRoomMember';
      const removeMemberParams = { 
        chatRoomId: chatRoomId.value, 
        username 
      };
      console.error(
        `移出聊天室成员失败:`,
        `\n调用方法: ${REMOVE_CHAT_ROOM_MEMBER_METHOD}`,
        `\n方法入参:`, removeMemberParams,
        `\n待移出成员:`, username,
        `\n操作聊天室ID:`, chatRoomId.value,
        `\n操作执行用户:`, EMClient.user,
        `\n错误类型:`, error.type,
        `\n错误消息:`, error.message,
        `\n完整错误信息:`, error
      );
      ElMessage.error('移出聊天室失败');
    }
  }
};

let chatroomEventHandler;

const getChatroomDetails = async () => {
  if (!checkLoginStatus()) return;
  if (!chatRoomId.value) return;
  try {
    console.log('开始获取聊天室详情，chatRoomId:', chatRoomId.value);
    const res = await EMClient.getChatRoomDetails({ chatRoomId: chatRoomId.value });
    const chatroomDetail = Array.isArray(res.data) ? res.data[0] || {} : res.data || {};
    chatroomDetails.value = chatroomDetail; // 保存聊天室详情，包括所有者信息
    isMuteAll.value = chatroomDetail.mute === true; // 同步全员禁言状态
    console.log('更新全员禁言状态为:', isMuteAll.value);
    console.log('聊天室所有者:', chatroomDetail.owner);
  } catch (error) {
    console.error('获取聊天室详情失败', error);
  }
};

onMounted(() => {
  getChatRoomMembers();
  getChatroomDetails();
  
  // 添加聊天室事件监听器
  chatroomEventHandler = EMClient.addEventHandler('CHATROOM_MEMBER_MANAGEMENT', {
    onChatroomEvent: (e) => {
      console.log(`【聊天室事件】:`, e);
      if (e.id === chatRoomId.value) {
        switch (e.operation) {
          case 'unmuteAllMembers':
            isMuteAll.value = false;
            getChatRoomMutelist();
            break;
          case 'muteAllMembers':
            isMuteAll.value = true;
            getChatRoomMutelist();
            break;
          case 'setAdmin':
            console.log('收到设置管理员事件，更新管理员列表');
            getChatRoomAdmin();
            break;
          case 'removeAdmin':
            getChatRoomAdmin();
            break;
          case 'muteMember':
            getChatRoomMutelist();
            break;
          case 'unmuteMember':
            getChatRoomMutelist();
            break;
        }
      }
    }
  });
});

onUnmounted(() => {
  // 在组件卸载时移除事件监听器
  if (chatroomEventHandler) {
    EMClient.removeEventHandler('CHATROOM_MEMBER_MANAGEMENT');
  }
});

// 监听路由参数变化
watch(
  () => route.query.roomId,
  (newRoomId, oldRoomId) => {
    if (newRoomId && newRoomId !== oldRoomId) {
      chatRoomId.value = newRoomId;
      // 重新初始化数据
      getChatRoomMembers();
      getChatroomDetails();
      
      // 重新注册事件监听器
      if (chatroomEventHandler) {
        EMClient.removeEventHandler('CHATROOM_MEMBER_MANAGEMENT');
      }
      chatroomEventHandler = EMClient.addEventHandler('CHATROOM_MEMBER_MANAGEMENT', {
        onChatroomEvent: (e) => {
          console.log(`【聊天室事件】:`, e);
          if (e.id === chatRoomId.value) {
            switch (e.operation) {
              case 'unmuteAllMembers':
                isMuteAll.value = false;
                getChatRoomMutelist();
                break;
              case 'muteAllMembers':
                isMuteAll.value = true;
                getChatRoomMutelist();
                break;
              case 'setAdmin':
                console.log('收到设置管理员事件，更新管理员列表');
                getChatRoomAdmin();
                break;
              case 'removeAdmin':
                getChatRoomAdmin();
                break;
              case 'muteMember':
                getChatRoomMutelist();
                break;
              case 'unmuteMember':
                getChatRoomMutelist();
                break;
            }
          }
        }
      });
    }
  }
);
</script>

<template>
  <div class="chatroom_member_management">
    <el-page-header @back="() => router.back()" title="返回聊天室详情">
      <template #content>
        <span class="text-large font-600 mr-3"> 聊天室成员管理 </span>
      </template>
    </el-page-header>

    <el-card class="management_card" v-loading="loading">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="成员列表" name="members">
          <el-table :data="members" stripe>
            <el-table-column prop="userId" label="用户ID" width="200" />
            <el-table-column prop="role" label="角色" width="150">
              <template #default="{ row }">
                <el-tag v-if="row.role === 'owner'" type="danger">所有者</el-tag>
                <el-tag v-else-if="row.role === 'admin'" type="warning">管理员</el-tag>
                <el-tag v-else type="info">成员</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作">
              <template #default="{ row }">
                <el-button 
                  v-if="row.role !== 'owner' && row.role !== 'admin'" 
                  type="danger" 
                  size="small" 
                  @click="removeMember(row.userId)"
                >
                  移出聊天室
                </el-button>
                <el-button 
                  v-if="row.role === 'owner' || row.role === 'admin'" 
                  type="primary" 
                  size="small" 
                  @click="setAdmin(row.userId)"
                  :disabled="row.role === 'admin'"
                >
                  {{ row.role === 'admin' ? '已是管理员' : '设为管理员' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="黑名单" name="blocklist">
          <div class="toolbar">
            <el-input
              v-model="blocklistInput"
              placeholder="请输入用户ID"
              style="width: 200px; margin-right: 10px;"
              clearable
            />
            <el-button type="primary" @click="addToBlocklist(blocklistInput)">添加到黑名单</el-button>
          </div>
          <el-table :data="blocklist" stripe>
            <el-table-column prop="userId" label="用户ID" />
            <el-table-column label="操作">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="removeFromBlocklist(row.userId)">
                  移出黑名单
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="白名单" name="allowlist">
          <div class="toolbar">
            <el-input
              v-model="allowlistInput"
              placeholder="请输入用户ID"
              style="width: 200px; margin-right: 10px;"
              clearable
            />
            <el-button type="primary" @click="addToAllowlist(allowlistInput)">添加到白名单</el-button>
          </div>
          <el-table :data="allowlist" stripe>
            <el-table-column prop="userId" label="用户ID" />
            <el-table-column label="操作">
              <template #default="{ row }">
                <el-button type="danger" size="small" @click="removeFromAllowlist(row.userId)">
                  移出白名单
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="禁言列表" name="mutelist">
          <div class="toolbar">
            <el-input
              v-model="muteInput"
              placeholder="请输入用户ID"
              style="width: 200px; margin-right: 10px;"
              clearable
            />
            <el-button type="primary" @click="muteMember(muteInput)">禁言用户</el-button>
            <el-button 
              type="warning" 
              @click="muteAllMembers"
              :disabled="!isOwner"
            >
              全员禁言
            </el-button>
            <el-button 
              type="success" 
              @click="unmuteAllMembers"
              :disabled="!isOwner"
            >
              取消全员禁言
            </el-button>
          </div>
          
          <el-alert
            v-if="isMuteAll"
            title="当前已开启全员禁言"
            type="warning"
            :closable="false"
            style="margin-bottom: 20px;"
          >
            全员禁言状态下，所有普通成员将被禁止发言（管理员和所有者不受影响）。
            禁言列表仅显示被单独禁言的用户，全员禁言不会自动将所有用户添加到禁言列表中。
          </el-alert>
          
          <el-alert
            v-else-if="mutelist.length === 0"
            title="当前没有被单独禁言的用户"
            type="info"
            :closable="false"
            style="margin-bottom: 20px;"
          >
            禁言列表仅显示被单独禁言的用户。要禁止所有用户发言，请使用"全员禁言"功能。
          </el-alert>
          
          <el-table :data="mutelist" stripe>
            <el-table-column prop="userId" label="用户ID" />
            <el-table-column label="禁言类型">
              <template #default="{ row }">
                <el-tag v-if="row.type === 'single'" type="warning">单独禁言</el-tag>
                <el-tag v-else-if="row.type === 'all'" type="danger">全员禁言</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="expire" label="禁言时长">
              <template #default="{ row }">
                <template v-if="row.type === 'all'">
                  全员禁言生效中
                </template>
                <template v-else>
                  {{ row.expire === -1 ? '永久' : row.expire + 'ms' }}
                </template>
              </template>
            </el-table-column>
            <el-table-column label="操作">
              <template #default="{ row }">
                <template v-if="row.type === 'single'">
                  <el-button type="primary" size="small" @click="unmuteMember(row.userId)">
                    解除禁言
                  </el-button>
                </template>
                <template v-else-if="row.type === 'all'">
                  <el-button type="info" size="small" disabled>
                    全员禁言统一控制
                  </el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="管理员" name="admins">
          <div class="toolbar">
            <el-input
              v-model="adminInput"
              placeholder="请输入用户ID"
              style="width: 200px; margin-right: 10px;"
              clearable
            />
            <el-button type="primary" @click="setAdmin(adminInput)">添加管理员</el-button>
          </div>
          <el-table :data="admins" stripe>
            <el-table-column prop="userId" label="用户ID" />
            <el-table-column label="操作">
              <template #default="{ row }">
                <el-button type="danger" size="small" @click="removeAdmin(row.userId)">
                  移除管理员
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.chatroom_member_management {
  padding: 20px;
  height: 100%;
  overflow-y: auto;

  .management_card {
    margin-top: 20px;
    min-height: 400px;

    .toolbar {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
    }

    :deep(.el-table) {
      min-height: 300px;
    }
  }
}

/* 将所有输入框改为长方形 */
:deep(.el-input__inner),
:deep(.el-input--textarea .el-textarea__inner) {
  border-radius: 0 !important;
}
</style>

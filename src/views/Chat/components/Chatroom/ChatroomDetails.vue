<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { EMClient } from '@/IM';
import { CHAT_TYPE } from '@/IM/constant';
import { DEFAULT_EASEMOB_REST_URL } from '@/IM/config';

const route = useRoute();
const router = useRouter();

const chatroomDetails = ref({});
const loading = ref(false);
const isOwner = computed(() => {
  return chatroomDetails.value.owner === EMClient.user;
});

const checkLoginStatus = () => {
  if (!EMClient.user) {
    ElMessage.error('用户未登录，请先登录');
    router.push('/login');
    return false;
  }
  return true;
};
//获取聊天室详情
const getChatroomDetails = async () => {
  if (!checkLoginStatus()) return;
  
  const roomId = route.query.roomId;
  if (!roomId) {
    ElMessage.error('聊天室ID不存在');
    return;
  }
  const GET_CHAT_ROOM_DETAILS_METHOD = 'getChatRoomDetails';
  const chatRoomDetailParams = { chatRoomId: roomId };
  loading.value = true;
  try {
    console.log(
      `开始获取聊天室详情:`,
      `\n调用方法: ${GET_CHAT_ROOM_DETAILS_METHOD}`,
      `\n方法入参:`, chatRoomDetailParams,
      `\n当前用户:`, EMClient.user,
      `\n聊天室ID:`, roomId
    );
    const res = await EMClient.getChatRoomDetails(chatRoomDetailParams);
    ElMessage.success('获取聊天室详情成功');
    console.log(
      `获取聊天室详情成功:`,
      `\n调用方法: ${GET_CHAT_ROOM_DETAILS_METHOD}`,
      `\n方法入参:`, chatRoomDetailParams,
      `\n完整返回值:`, res
    );
    // 检查返回数据结构，可能是数组中的第一个元素
    chatroomDetails.value = Array.isArray(res.data) ? res.data[0] || {} : res.data || {};
    getChatRoomAnnouncement();
    getChatRoomAttributes();
  } catch (error) {
    ElMessage.error('获取聊天室详情失败');
    console.error(
      `获取聊天室详情失败:`,
      `\n调用方法: ${GET_CHAT_ROOM_DETAILS_METHOD}`,
      `\n方法入参:`, chatRoomDetailParams,
      `\n聊天室ID:`, roomId,
      `\n错误详情:`, error
    );
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('获取聊天室详情失败');
    }
  } finally {
    loading.value = false;
  }
};

const leaveChatroom = async () => {
  if (!checkLoginStatus()) return;
  
  try {
    await ElMessageBox.confirm('确定要退出该聊天室吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await EMClient.leaveChatRoom({ roomId: route.query.roomId });
    ElMessage.success('退出聊天室成功');
    router.push('/chat/chatroom');
  } catch (error) {
    if (error !== 'cancel') {
      console.error('退出聊天室失败', error);
      if (error.type === 52 || error.message?.includes('authenticate')) {
        ElMessage.error('认证失败，请重新登录');
      } else {
        ElMessage.error('退出聊天室失败');
      }
    }
  }
};
//解散聊天室
const destroyChatroom = async () => {
  if (!checkLoginStatus()) return;
  const DESTROY_CHAT_ROOM_METHOD = 'destroyChatRoom';
  const roomId = route.query.roomId;
  const destroyChatRoomParams = { chatRoomId: roomId };
  try {
    console.log(
      `开始执行解散聊天室操作:`,
      `\n目标聊天室ID:`, roomId,
      `\n当前操作用户:`, EMClient.user
    );
    await ElMessageBox.confirm('确定要解散该聊天室吗？此操作不可恢复！', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    console.log(
      `用户确认解散聊天室，开始调用接口:`,
      `\n调用方法: ${DESTROY_CHAT_ROOM_METHOD}`,
      `\n方法入参:`, destroyChatRoomParams,
      `\n聊天室ID:`, roomId
    );
    const res = await EMClient.destroyChatRoom(destroyChatRoomParams);
    ElMessage.success('解散聊天室成功');
    console.log(
      `解散聊天室成功:`,
      `\n调用方法: ${DESTROY_CHAT_ROOM_METHOD}`,
      `\n方法入参:`, destroyChatRoomParams,
      `\n接口返回结果:`, res,
      `\n已解散的聊天室ID:`, roomId
    );
    router.push('/chat/chatroom');
  } catch (error) {
    ElMessage.error('解散聊天室失败');
    console.error(
      `解散聊天室失败:`,
      `\n调用方法: ${DESTROY_CHAT_ROOM_METHOD}`,
      `\n方法入参:`, destroyChatRoomParams,
      `\n聊天室ID:`, roomId,
      `\n错误详情:`, error
    );
    if (error !== 'cancel') {
      console.error('解散聊天室失败', error);
      if (error.type === 52 || error.message?.includes('authenticate')) {
        ElMessage.error('认证失败，请重新登录');
      } else {
        ElMessage.error('解散聊天室失败');
      }
    }
  }
};

const showEditDialog = ref(false);
const editForm = ref({
  chatRoomName: '',
  description: '',
  maxusers: 200,
});

const openEditDialog = () => {
  editForm.value = {
    chatRoomName: chatroomDetails.value.name || '',
    description: chatroomDetails.value.description || '',
    maxusers: chatroomDetails.value.maxusers || 200,
  };
  showEditDialog.value = true;
};

const modifyChatRoom = async () => {
  if (!checkLoginStatus()) return;
  
  try {
    const options = {
      chatRoomId: route.query.roomId,
      chatRoomName: editForm.value.chatRoomName,
      description: editForm.value.description,
      maxusers: editForm.value.maxusers,
    };
    await EMClient.modifyChatRoom(options);
    ElMessage.success('修改聊天室信息成功');
    showEditDialog.value = false;
    getChatroomDetails();
  } catch (error) {
    console.error('修改聊天室信息失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else if (error.type === 17 || error.data?.includes('group_authorization')) {
      ElMessage.error('您没有权限修改聊天室信息');
    } else {
      ElMessage.error('修改聊天室信息失败');
    }
  }
};

const announcement = ref('');
const showAnnouncementDialog = ref(false);
const announcementForm = ref({
  announcement: '',
});

const getChatRoomAnnouncement = async () => {
  if (!checkLoginStatus()) return;
  
  try {
    const res = await EMClient.fetchChatRoomAnnouncement({ roomId: route.query.roomId });
    console.log('获取聊天室公告成功:', res);
    // 处理不同的数据结构，可能是直接的字符串或包含 announcement 字段的对象
    if (res.data && typeof res.data === 'object') {
      announcement.value = res.data.announcement || '';
    } else {
      announcement.value = res.data || '';
    }
  } catch (error) {
    console.error('获取聊天室公告失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    }
  }
};

const openAnnouncementDialog = () => {
  announcementForm.value.announcement = announcement.value;
  showAnnouncementDialog.value = true;
};

const updateChatRoomAnnouncement = async () => {
  if (!checkLoginStatus()) return;
  
  try {
    await EMClient.updateChatRoomAnnouncement({
      roomId: route.query.roomId,
      announcement: announcementForm.value.announcement,
    });
    ElMessage.success('更新聊天室公告成功');
    showAnnouncementDialog.value = false;
    getChatRoomAnnouncement();
  } catch (error) {
    console.error('更新聊天室公告失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else if (error.type === 17 || error.data?.includes('group_authorization')) {
      ElMessage.error('您没有权限更新聊天室公告');
    } else {
      ElMessage.error('更新聊天室公告失败');
    }
  }
};

const attributes = ref({});
const showAttributeDialog = ref(false);
const attributeForm = ref({
  attributeKey: '',
  attributeValue: '',
  autoDelete: true,
  isForced: false,
});
const showBatchAttributeDialog = ref(false);
const batchAttributeForm = ref({
  attributes: '',
  autoDelete: true,
  isForced: false,
});

const getChatRoomAttributes = async () => {
  if (!checkLoginStatus()) return;
  
  const roomId = route.query.roomId;
  if (!roomId) {
    ElMessage.error('聊天室ID不存在');
    return;
  }
  
  try {
    // 检查EMClient对象是否存在并且getChatRoomAttributes方法可用
    console.log('EMClient对象:', typeof EMClient);
    console.log('getChatRoomAttributes方法:', typeof EMClient.getChatRoomAttributes);
    console.log('开始获取聊天室自定义属性，roomId:', roomId, '当前用户:', EMClient.user, 'REST URL:', DEFAULT_EASEMOB_REST_URL);
    
    // 准备请求参数
    const requestParams = { chatRoomId: roomId };
    console.log('请求参数:', requestParams);
    
    const res = await EMClient.getChatRoomAttributes(requestParams);
    console.log('获取聊天室自定义属性成功:', JSON.stringify(res, null, 2));
    attributes.value = res.data || {};
  } catch (error) {
    console.error('=== 获取聊天室自定义属性失败 ===');
    
    // 使用更可靠的方式记录错误信息，避免循环引用问题
    console.error('原始错误对象:', error);
    
    // 尝试获取所有可能的错误信息
    console.error('错误类型:', typeof error);
    console.error('错误构造函数:', error.constructor ? error.constructor.name : '未知');
    
    try {
      console.error('错误属性列表:', Object.keys(error));
    } catch (e) {
      console.error('获取错误属性列表失败:', e);
    }
    
    // 分别记录错误的各个属性
    console.error('错误type:', error.type);
    console.error('错误message:', error.message);
    console.error('错误errorType:', error.errorType);
    console.error('错误code:', error.code);
    console.error('错误status:', error.status);
    
    // 记录xhr信息
    if (error.xhr) {
      try {
        console.error('xhr状态:', error.xhr.status);
        console.error('xhr readyState:', error.xhr.readyState);
        console.error('xhr responseURL:', error.xhr.responseURL);
        console.error('xhr responseText:', error.xhr.responseText);
        console.error('xhr statusText:', error.xhr.statusText);
      } catch (e) {
        console.error('获取xhr信息失败:', e);
      }
    } else {
      console.error('无xhr信息');
    }
    
    // 记录堆栈信息
    console.error('错误堆栈:', error.stack || '无堆栈信息');
    
    // 根据错误类型显示不同的提示信息
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else if (error.type === 702) {
      ElMessage.error('获取聊天室自定义属性失败，请检查聊天室ID是否正确');
    } else if (error.type === -2 || error.errorType === 'onerror') {
      ElMessage.error('网络请求失败，请检查网络连接或服务器配置');
    } else if (error instanceof TypeError) {
      ElMessage.error('SDK方法调用错误，请检查SDK是否正确初始化');
    } else {
      ElMessage.error('获取聊天室自定义属性失败');
    }
  }
};

const openAttributeDialog = () => {
  attributeForm.value = {
    attributeKey: '',
    attributeValue: '',
    autoDelete: true,
    isForced: false,
  };
  showAttributeDialog.value = true;
};

const setChatRoomAttribute = async () => {
  if (!checkLoginStatus()) return;
  
  if (!attributeForm.value.attributeKey || !attributeForm.value.attributeKey.trim()) {
    ElMessage.warning('请输入属性键');
    return;
  }
  
  try {
    await EMClient.setChatRoomAttribute({
      chatRoomId: route.query.roomId,
      attributeKey: attributeForm.value.attributeKey.trim(),
      attributeValue: attributeForm.value.attributeValue,
      autoDelete: attributeForm.value.autoDelete,
      isForced: attributeForm.value.isForced,
    });
    ElMessage.success('设置聊天室属性成功');
    showAttributeDialog.value = false;
    getChatRoomAttributes();
  } catch (error) {
    console.error('设置聊天室属性失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else {
      ElMessage.error('设置聊天室属性失败');
    }
  }
};

const openBatchAttributeDialog = () => {
  batchAttributeForm.value = {
    attributes: '',
    autoDelete: true,
    isForced: false,
  };
  showBatchAttributeDialog.value = true;
};

const setChatRoomAttributes = async () => {
  if (!checkLoginStatus()) return;
  
  if (!batchAttributeForm.value.attributes || !batchAttributeForm.value.attributes.trim()) {
    ElMessage.warning('请输入属性');
    return;
  }
  
  try {
    const attributesObj = JSON.parse(batchAttributeForm.value.attributes);
    await EMClient.setChatRoomAttributes({
      chatRoomId: route.query.roomId,
      attributes: attributesObj,
      autoDelete: batchAttributeForm.value.autoDelete,
      isForced: batchAttributeForm.value.isForced,
    });
    ElMessage.success('批量设置聊天室属性成功');
    showBatchAttributeDialog.value = false;
    getChatRoomAttributes();
  } catch (error) {
    console.error('批量设置聊天室属性失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else if (error instanceof SyntaxError) {
      ElMessage.error('属性格式错误，请输入有效的JSON格式');
    } else {
      ElMessage.error('批量设置聊天室属性失败');
    }
  }
};

const removeChatRoomAttribute = async (key) => {
  if (!checkLoginStatus()) return;
  
  try {
    await ElMessageBox.confirm(`确定要删除属性 "${key}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await EMClient.removeChatRoomAttribute({
      chatRoomId: route.query.roomId,
      attributeKey: key,
      isForced: false,
    });
    ElMessage.success('删除聊天室属性成功');
    getChatRoomAttributes();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除聊天室属性失败', error);
      if (error.type === 52 || error.message?.includes('authenticate')) {
        ElMessage.error('认证失败，请重新登录');
      } else {
        ElMessage.error('删除聊天室属性失败');
      }
    }
  }
};

let chatroomEventHandler = null;

onMounted(() => {
  getChatroomDetails();
  
  // 添加聊天室事件监听器
  chatroomEventHandler = EMClient.addEventHandler('CHATROOM_DETAILS', {
    onChatroomEvent: (e) => {
      // 确保只更新当前查看的聊天室的成员人数
      if (e.id === route.query.roomId) {
         console.log(
              `===== ChatroomDetails 监听事件 =====`,
              `\n监听时间:`, new Date().toLocaleString(),
              `\n目标聊天室ID:`, route.query.roomId,
              `\n事件触发的聊天室ID:`, e.id,
              `\n监听事件类型:`, e.operation,
              `\n完整事件数据:`, e,
              `===================`
        );
        
        switch (e.operation) {
          case 'memberPresence':
            // 当前聊天室在线人数
             console.log(
                `【聊天室成员上线事件】:`,
                `\n事件类型: memberPresence`,
                `\n触发聊天室ID:`, e.chatRoomId,
                `\n更新前在线人数:`, chatroomDetails.value.affiliations_count ?? '未定义',
                `\n事件返回在线人数:`, e?.memberCount || 0,
                `\n更新后在线人数:`, e?.memberCount || 0
            );
            chatroomDetails.value.affiliations_count = e?.memberCount || 0;
            break;
          case 'memberAbsence':
            // 当前聊天室在线人数
             console.log(
                `【聊天室成员离开事件】:`,
                `\n事件类型: memberAbsence`,
                `\n触发聊天室ID:`, e.chatRoomId,
                `\n更新前在线人数:`, chatroomDetails.value.affiliations_count ?? '未定义',
                `\n事件返回在线人数:`, e?.memberCount || 0,
                `\n更新后在线人数:`, e?.memberCount || 0
            );
            // 更新当前聊天室详情中的成员人数
            chatroomDetails.value.affiliations_count = e?.memberCount || 0;
            break;
          default:
            console.log(
              `【聊天室未知监听事件】:`,
              `\n未处理的事件类型:`, e.operation,
              `\n触发聊天室ID:`, e.chatRoomId,
              `\n完整事件数据:`, e
            );
            break;
        }
      }
    }
  });
});

// 在组件卸载时移除事件监听器
onUnmounted(() => {
  if (chatroomEventHandler) {
    EMClient.removeEventHandler('CHATROOM_DETAILS');
  }
});

// 监听路由参数变化，当roomId改变时重新获取聊天室详情并更新事件监听器
watch(
  () => route.query.roomId,
  (newRoomId, oldRoomId) => {
    if (newRoomId && newRoomId !== oldRoomId) {
      getChatroomDetails();
      
      // 移除旧的事件监听器
      if (chatroomEventHandler) {
        EMClient.removeEventHandler('CHATROOM_DETAILS');
      }
      
      // 重新注册事件监听器
      chatroomEventHandler = EMClient.addEventHandler('CHATROOM_DETAILS', {
        onChatroomEvent: (e) => {
          // 确保只更新当前查看的聊天室的成员人数
          if (e.id === route.query.roomId) {
            console.log(
              `===== ChatroomDetails 监听事件 =====`,
              `\n监听时间:`, new Date().toLocaleString(),
              `\n目标聊天室ID:`, route.query.roomId,
              `\n事件触发的聊天室ID:`, e.id,
              `\n监听事件类型:`, e.operation,
              `\n完整事件数据:`, e,
              `===================`
            );
            
            switch (e.operation) {
              case 'memberPresence':
                // 当前聊天室在线人数
                console.log(
                  `【聊天室成员上线事件】:`,
                  `\n事件类型: memberPresence`,
                  `\n触发聊天室ID:`, e.chatRoomId,
                  `\n更新前在线人数:`, chatroomDetails.value.affiliations_count ?? '未定义',
                  `\n事件返回在线人数:`, e?.memberCount || 0,
                  `\n更新后在线人数:`, e?.memberCount || 0
                );
                chatroomDetails.value.affiliations_count = e?.memberCount || 0;
                break;
              case 'memberAbsence':
                // 当前聊天室在线人数
                console.log(
                  `【聊天室成员离开事件】:`,
                  `\n事件类型: memberAbsence`,
                  `\n触发聊天室ID:`, e.chatRoomId,
                  `\n更新前在线人数:`, chatroomDetails.value.affiliations_count ?? '未定义',
                  `\n事件返回在线人数:`, e?.memberCount || 0,
                  `\n更新后在线人数:`, e?.memberCount || 0
                );
                // 更新当前聊天室详情中的成员人数
                chatroomDetails.value.affiliations_count = e?.memberCount || 0;
                break;
              default:
                console.log(
                  `【聊天室未知监听事件】:`,
                  `\n未处理的事件类型:`, e.operation,
                  `\n触发聊天室ID:`, e.chatRoomId,
                  `\n完整事件数据:`, e
                );
                break;
            }
          }
        }
      });
    }
  },
  { immediate: false }
);
</script>

<template>
  <div class="chatroom_details_container">
    <el-page-header @back="() => router.back()" title="返回聊天室列表">
      <template #content>
        <span class="text-large font-600 mr-3"> 聊天室详情 </span>
      </template>
    </el-page-header>

    <el-card v-loading="loading" class="details_card">
      <template #header>
        <div class="card_header">
          <span>聊天室信息</span>
        </div>
      </template>

      <el-descriptions :column="1" border>
        <el-descriptions-item label="聊天室ID">
          {{ chatroomDetails.id }}
        </el-descriptions-item>
        <el-descriptions-item label="聊天室名称">
          {{ chatroomDetails.name }}
        </el-descriptions-item>
        <el-descriptions-item label="聊天室描述">
          {{ chatroomDetails.description || '暂无描述' }}
        </el-descriptions-item>
        <el-descriptions-item label="聊天室公告">
          {{ announcement || '暂无公告' }}
        </el-descriptions-item>
        <el-descriptions-item label="所有者">
          {{ chatroomDetails.owner }}
        </el-descriptions-item>
        <el-descriptions-item label="最大成员数">
          {{ chatroomDetails.maxusers }}
        </el-descriptions-item>
        <el-descriptions-item label="当前成员数">
          {{ chatroomDetails.affiliations_count || 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ chatroomDetails.created || '未知' }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="action_buttons">
        <el-button type="primary" @click="() => router.push({ path: '/chat/chatroom/message', query: { id: route.query.roomId, chatType: CHAT_TYPE.CHATROOM } })">
          进入聊天室
        </el-button>
        <el-button type="success" @click="() => router.push({ path: '/chat/chatroom/member-management', query: { roomId: route.query.roomId } })">
          成员管理
        </el-button>
        <el-button v-if="isOwner" @click="openEditDialog">
          修改聊天室信息
        </el-button>
        <el-button v-if="isOwner" @click="openAnnouncementDialog">
          更新公告
        </el-button>
        <el-button @click="openAttributeDialog">
          添加自定义属性
        </el-button>
        <el-button @click="openBatchAttributeDialog">
          批量添加属性
        </el-button>
        <el-button @click="leaveChatroom">
          退出聊天室
        </el-button>
        <el-button v-if="isOwner" type="danger" @click="destroyChatroom">
          解散聊天室
        </el-button>
      </div>
    </el-card>

    <el-card v-if="Object.keys(attributes).length > 0" class="attributes_card">
      <template #header>
        <div class="card_header">
          <span>自定义属性</span>
        </div>
      </template>

      <el-table :data="Object.entries(attributes).map(([key, value]) => ({ key, value }))" border>
        <el-table-column prop="key" label="属性键" width="200" />
        <el-table-column prop="value" label="属性值" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" size="small" @click="removeChatRoomAttribute(row.key)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showEditDialog" title="修改聊天室信息" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="聊天室名称">
          <el-input v-model="editForm.chatRoomName" placeholder="请输入聊天室名称" />
        </el-form-item>
        <el-form-item label="聊天室描述">
          <el-input
            v-model="editForm.description"
            type="textarea"
            placeholder="请输入聊天室描述"
          />
        </el-form-item>
        <el-form-item label="最大成员数">
          <el-input-number
            v-model="editForm.maxusers"
            :min="1"
            :max="5000"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showEditDialog = false">取消</el-button>
          <el-button type="primary" @click="modifyChatRoom">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="showAnnouncementDialog" title="更新聊天室公告" width="500px">
      <el-form :model="announcementForm" label-width="100px">
        <el-form-item label="公告内容">
          <el-input
            v-model="announcementForm.announcement"
            type="textarea"
            :rows="4"
            placeholder="请输入公告内容（最多512个字符）"
            maxlength="512"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showAnnouncementDialog = false">取消</el-button>
          <el-button type="primary" @click="updateChatRoomAnnouncement">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="showAttributeDialog" title="添加自定义属性" width="500px">
      <el-form :model="attributeForm" label-width="150px">
        <el-form-item label="属性键">
          <el-input v-model="attributeForm.attributeKey" placeholder="请输入属性键" />
        </el-form-item>
        <el-form-item label="属性值">
          <el-input v-model="attributeForm.attributeValue" placeholder="请输入属性值" />
        </el-form-item>
        <el-form-item label="退出时删除">
          <el-switch v-model="attributeForm.autoDelete" />
        </el-form-item>
        <el-form-item label="强制设置">
          <el-switch v-model="attributeForm.isForced" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showAttributeDialog = false">取消</el-button>
          <el-button type="primary" @click="setChatRoomAttribute">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="showBatchAttributeDialog" title="批量添加自定义属性" width="600px">
      <el-form :model="batchAttributeForm" label-width="150px">
        <el-form-item label="属性（JSON格式）">
          <el-input
            v-model="batchAttributeForm.attributes"
            type="textarea"
            :rows="6"
            placeholder='请输入属性，例如：{"key1":"value1","key2":"value2"}'
            class="square-textarea"
          />
        </el-form-item>
        <el-form-item label="退出时删除">
          <el-switch v-model="batchAttributeForm.autoDelete" />
        </el-form-item>
        <el-form-item label="强制设置">
          <el-switch v-model="batchAttributeForm.isForced" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showBatchAttributeDialog = false">取消</el-button>
          <el-button type="primary" @click="setChatRoomAttributes">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.chatroom_details_container {
  padding: 20px;
  height: 100%;
  overflow-y: auto;

  .details_card,
  .attributes_card {
    margin-top: 20px;

    .card_header {
      font-weight: 600;
      font-size: 16px;
    }

    .action_buttons {
      margin-top: 20px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
  }
}

/* 将所有输入框改为长方形 - 使用更具体的选择器 */
.chatroom_details_container :deep(.el-input__inner),
.chatroom_details_container :deep(.el-input--textarea .el-textarea__inner) {
  border-radius: 0 !important;
  box-sizing: border-box;
}

/* 确保批量添加自定义属性对话框中的textarea为长方形 - 最具体的选择器 */
.chatroom_details_container :deep(.el-dialog[title="批量添加自定义属性"] .el-form-item .el-input.el-input--textarea .el-textarea__inner) {
  border-radius: 0 !important;
  box-sizing: border-box;
  outline: none;
}

/* 直接针对square-textarea类的样式 - 最高优先级 */
.chatroom_details_container :deep(.el-input.square-textarea.el-input--textarea .el-textarea__inner) {
  border-radius: 0 !important;
  box-sizing: border-box;
  outline: none;
}

/* 最直接的选择器，确保覆盖所有其他样式 */
.chatroom_details_container :deep(textarea) {
  border-radius: 0 !important;
  box-sizing: border-box;
  outline: none;
}
</style>

/* 非scoped样式，确保全局覆盖 */
<style lang="scss">
/* 直接针对批量添加自定义属性对话框的textarea */
.el-dialog[title="批量添加自定义属性"] .el-form-item .el-input.el-input--textarea .el-textarea__inner {
  border-radius: 0 !important;
  box-sizing: border-box;
  outline: none;
}

/* 全局覆盖所有Element Plus的textarea样式 */
.el-textarea__inner {
  border-radius: 0 !important;
  box-sizing: border-box;
  outline: none;
}
</style>

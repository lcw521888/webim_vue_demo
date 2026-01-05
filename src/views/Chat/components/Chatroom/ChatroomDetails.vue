<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { EMClient } from '@/IM';
import { CHAT_TYPE } from '@/IM/constant';

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

const getChatroomDetails = async () => {
  if (!checkLoginStatus()) return;
  
  const roomId = route.query.roomId;
  if (!roomId) {
    ElMessage.error('聊天室ID不存在');
    return;
  }

  loading.value = true;
  try {
    console.log('开始获取聊天室详情，roomId:', roomId, '当前用户:', EMClient.user);
    const res = await EMClient.getChatRoomDetails({ chatRoomId: roomId });
    console.log('获取聊天室详情成功:', res);
    chatroomDetails.value = res.data || {};
    getChatRoomAnnouncement();
    getChatRoomAttributes();
  } catch (error) {
    console.error('获取聊天室详情失败', error);
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

const destroyChatroom = async () => {
  if (!checkLoginStatus()) return;
  
  try {
    await ElMessageBox.confirm('确定要解散该聊天室吗？此操作不可恢复！', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await EMClient.destroyChatRoom({ chatRoomId: route.query.roomId });
    ElMessage.success('解散聊天室成功');
    router.push('/chat/chatroom');
  } catch (error) {
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
    announcement.value = res.data || '';
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
  
  try {
    const res = await EMClient.getChatRoomAttributes({ 
      chatRoomId: route.query.roomId
    });
    attributes.value = res.data || {};
  } catch (error) {
    console.error('获取聊天室自定义属性失败', error);
    if (error.type === 52 || error.message?.includes('authenticate')) {
      ElMessage.error('认证失败，请重新登录');
    } else if (error.type === 702) {
      ElMessage.error('获取聊天室自定义属性失败，请检查聊天室ID是否正确');
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

onMounted(() => {
  getChatroomDetails();
});
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
</style>

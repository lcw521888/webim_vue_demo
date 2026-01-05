<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { EMClient } from '@/IM';

const route = useRoute();
const router = useRouter();

const activeTab = ref('members');
const loading = ref(false);
const chatRoomId = route.query.roomId;

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
  return chatRoomId && EMClient.user;
});

const checkLoginStatus = () => {
  if (!EMClient.user) {
    ElMessage.error('用户未登录，请先登录');
    router.push('/login');
    return false;
  }
  return true;
};

const getChatRoomMembers = async () => {
  if (!checkLoginStatus()) return;
  
  if (!chatRoomId) {
    console.error('chatRoomId 不存在:', chatRoomId);
    return;
  }
  
  loading.value = true;
  try {
    console.log('开始获取聊天室成员，chatRoomId:', chatRoomId);
    console.log('当前用户:', EMClient.user);
    const res = await EMClient.listChatRoomMembers({ 
      chatRoomId,
      pageNum: 1,
      pageSize: 50 
    });
    console.log('获取聊天室成员成功 - 原始数据:', res);
    console.log('获取聊天室成员成功 - res.data:', res.data);
    console.log('获取聊天室成员成功 - res.data 类型:', typeof res.data);
    console.log('获取聊天室成员成功 - res.data 是否为数组:', Array.isArray(res.data));
    members.value = (res.data || []).map(item => {
      console.log('处理成员项:', item);
      return {
        ...item,
        userId: item.member || item.owner
      };
    });
    console.log('处理后的成员列表:', members.value);
  } catch (error) {
    console.error('获取聊天室成员失败', error);
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
  if (!chatRoomId) return;
  loading.value = true;
  try {
    console.log('开始获取聊天室黑名单，chatRoomId:', chatRoomId);
    const res = await EMClient.getChatRoomBlocklist({ chatRoomId });
    console.log('获取聊天室黑名单成功 - 原始数据:', res);
    console.log('获取聊天室黑名单成功 - res.data:', res.data);
    console.log('获取聊天室黑名单成功 - res.data 类型:', typeof res.data);
    console.log('获取聊天室黑名单成功 - res.data 是否为数组:', Array.isArray(res.data));
    
    if (Array.isArray(res.data)) {
      blocklist.value = res.data.map(userId => {
        console.log('处理黑名单项:', userId);
        return { userId };
      });
    } else {
      console.warn('res.data 不是数组，使用空数组');
      blocklist.value = [];
    }
    console.log('处理后的黑名单列表:', blocklist.value);
  } catch (error) {
    console.error('获取聊天室黑名单失败', error);
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
  if (!chatRoomId) return;
  loading.value = true;
  try {
    console.log('开始获取聊天室白名单，chatRoomId:', chatRoomId);
    const res = await EMClient.getChatRoomAllowlist({ chatRoomId });
    console.log('获取聊天室白名单成功 - 原始数据:', res);
    console.log('获取聊天室白名单成功 - res.data:', res.data);
    console.log('获取聊天室白名单成功 - res.data 类型:', typeof res.data);
    console.log('获取聊天室白名单成功 - res.data 是否为数组:', Array.isArray(res.data));
    
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
  if (!chatRoomId) return;
  loading.value = true;
  try {
    console.log('开始获取聊天室禁言列表，chatRoomId:', chatRoomId);
    const res = await EMClient.getChatRoomMutelist({ chatRoomId });
    console.log('获取聊天室禁言列表成功 - 原始数据:', res);
    console.log('获取聊天室禁言列表成功 - res.data:', res.data);
    console.log('获取聊天室禁言列表成功 - res.data 类型:', typeof res.data);
    console.log('获取聊天室禁言列表成功 - res.data 是否为数组:', Array.isArray(res.data));
    
    if (Array.isArray(res.data)) {
      mutelist.value = res.data.map(item => {
        console.log('处理禁言项:', item);
        return {
          userId: item.user || item.userId,
          expire: item.expire
        };
      });
    } else {
      console.warn('res.data 不是数组，使用空数组');
      mutelist.value = [];
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

const getChatRoomAdmins = async () => {
  if (!checkLoginStatus()) return;
  if (!chatRoomId) return;
  loading.value = true;
  try {
    console.log('开始获取聊天室管理员，chatRoomId:', chatRoomId);
    const res = await EMClient.getChatRoomAdmin({ chatRoomId });
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
      getChatRoomAdmins();
      break;
  }
};

const addToBlocklist = async (username) => {
  if (!checkLoginStatus()) return;
  
  if (!username || !username.trim()) {
    ElMessage.warning('请输入用户ID');
    return;
  }
  if (!chatRoomId) {
    ElMessage.error('聊天室ID不存在');
    return;
  }
  const trimmedUsername = username.trim();
  console.log('添加到黑名单 - chatRoomId:', chatRoomId, 'username:', trimmedUsername);
  try {
    await EMClient.blockChatRoomMember({ 
      chatRoomId, 
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
      chatRoomId, 
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
  if (!chatRoomId) {
    ElMessage.error('聊天室ID不存在');
    return;
  }
  const trimmedUsername = username.trim();
  console.log('添加到白名单 - chatRoomId:', chatRoomId, 'users:', [trimmedUsername]);
  try {
    await EMClient.addUsersToChatRoomAllowlist({ 
      chatRoomId, 
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
      chatRoomId, 
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
      chatRoomId, 
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
      chatRoomId, 
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
  try {
    await EMClient.disableSendChatRoomMsg({ chatRoomId });
    isMuteAll.value = true;
    ElMessage.success('全员禁言成功');
    getChatRoomMutelist();
  } catch (error) {
    console.error('全员禁言失败', error);
    ElMessage.error('全员禁言失败');
  }
};

const unmuteAllMembers = async () => {
  try {
    await EMClient.enableSendChatRoomMsg({ chatRoomId });
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
  if (!chatRoomId) {
    ElMessage.error('聊天室ID不存在');
    return;
  }
  const trimmedUsername = username.trim();
  
  try {
    const res = await EMClient.getChatRoomDetails({ chatRoomId });
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
  
  console.log('设置管理员 - chatRoomId:', chatRoomId, 'username:', trimmedUsername);
  try {
    await EMClient.setChatRoomAdmin({ 
      chatRoomId, 
      username: trimmedUsername 
    });
    ElMessage.success('设置管理员成功');
    adminInput.value = '';
    getChatRoomAdmins();
  } catch (error) {
    console.error('设置管理员失败', error);
    ElMessage.error(`设置管理员失败: ${error.message || '未知错误'}`);
  }
};

const removeAdmin = async (username) => {
  try {
    await EMClient.removeChatRoomAdmin({ 
      chatRoomId, 
      username 
    });
    ElMessage.success('移除管理员成功');
    getChatRoomAdmins();
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
    await EMClient.removeChatRoomMember({ 
      chatRoomId, 
      username 
    });
    ElMessage.success('移出聊天室成功');
    getChatRoomMembers();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('移出聊天室失败', error);
      ElMessage.error('移出聊天室失败');
    }
  }
};

onMounted(() => {
  getChatRoomMembers();
});
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
            <el-button type="warning" @click="muteAllMembers">全员禁言</el-button>
            <el-button type="success" @click="unmuteAllMembers">取消全员禁言</el-button>
          </div>
          
          <el-alert
            v-if="isMuteAll"
            title="当前已开启全员禁言"
            type="warning"
            :closable="false"
            style="margin-bottom: 20px;"
          />
          
          <el-table :data="mutelist" stripe>
            <el-table-column prop="userId" label="用户ID" />
            <el-table-column prop="expire" label="禁言时长(ms)">
              <template #default="{ row }">
                {{ row.expire === -1 ? '永久' : row.expire + 'ms' }}
              </template>
            </el-table-column>
            <el-table-column label="操作">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="unmuteMember(row.userId)">
                  解除禁言
                </el-button>
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
</style>

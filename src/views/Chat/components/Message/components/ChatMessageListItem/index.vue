<script setup>
import {
  reactive,
  ref,
  computed,
  toRefs,
  nextTick,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';
import { useStore } from 'vuex';
import { useClipboard, usePermission } from '@vueuse/core';
import { ElMessage, ElMessageBox } from 'element-plus';
import { EMClient } from '@/IM';
import { CHAT_TYPE, MESSAGE_TYPE } from '@/IM/constant';
import { CUSTOM_MSG_EVENT_TYPE, MESSAGE_STATUS_TYPE } from '@/constant';
import { useGetUserMapInfo } from '@/hooks';
import BenzAMRRecorder from 'benz-amr-recorder';
import fileSizeFormat from '@/utils/fileSizeFormat';
import dateFormat from '@/utils/dateFormater';
import { CUSTOM_MESSAGE_TYPE } from '@/constant';
import { handleSDKErrorNotifi } from '@/utils/handleSomeData';
/* utils */
import paseLink from '@/utils/paseLink';
/* 默认头像 */
import defaultAvatar from '@/assets/images/avatar/theme2x.png';
import ReportMessage from '../suit/reportMessage.vue';
import messageReadedIcon from '@/assets/messages/read@3x.png';
/* components */
import ModifyMessage from '../suit/modifyMessage.vue';
/* vuex store */
const store = useStore();
/* props */
const props = defineProps({
  messageData: {
    type: [Array, Object],
    default: () => [],
  },
  routeQueryData: {
    type: Object,
    default: () => ({
      id: '',
      chatType: CHAT_TYPE.SINGLE,
    }),
    required: true,
  },
});
const { routeQueryData } = toRefs(props);
/* emits */
const emit = defineEmits([
  'scrollMessageList',
  'reEditMessage',
  'messageQuote',
]);

// 组件挂载状态标志
const isMounted = ref(true);

// 预处理消息数据，添加计算属性到每个消息对象
// 避免在模板中频繁调用函数
const processedMessageData = computed(() => {
  let rawData;
  if (Array.isArray(props.messageData)) {
    rawData = props.messageData;
  } else if (props.messageData && typeof props.messageData === 'object') {
    rawData = [props.messageData];
  } else {
    rawData = [];
  }

  // 过滤掉null/undefined项
  const filtered = rawData.filter((item) => item != null);

  // 优化：避免不必要的对象创建，只在需要时创建新对象
  return filtered.map((msgBody, index) => {
    // 检查消息对象是否已经被处理过
    if (msgBody._isMyself !== undefined) {
      return msgBody;
    }

    // 创建一个新对象，避免修改原始数据
    // 使用Object.assign确保正确复制所有属性
    const processed = Object.assign({}, msgBody);

    // 确保所有必需的属性都存在且有效
    processed.id = processed.id || `temp_${index}_${Date.now()}`;
    processed.from = processed.from || '';
    processed.to = processed.to || '';
    processed.time = processed.time || Date.now();
    processed.type = processed.type || MESSAGE_TYPE.TEXT;
    processed.chatType = processed.chatType || CHAT_TYPE.SINGLE;
    processed.isRecall = processed.isRecall || false;

    // 确保消息内容和扩展属性存在
    processed.msg = processed.msg || '';
    processed.ext = processed.ext || {};
    processed.ext.msgQuote = processed.ext.msgQuote || null;

    // 确保自定义消息属性存在
    if (processed.type === MESSAGE_TYPE.CUSTOM) {
      processed.customEvent = processed.customEvent || '';
      processed.customExts = processed.customExts || {};
    }

    // 确保文件消息属性存在
    if (processed.type === MESSAGE_TYPE.FILE) {
      processed.filename = processed.filename || 'unknown_file';
      processed.file_length = processed.file_length || 0;
      processed.url = processed.url || '';
    }

    // 确保图片消息属性存在
    if (processed.type === MESSAGE_TYPE.IMAGE) {
      processed.thumb = processed.thumb || '';
      processed.url = processed.url || '';
    }

    // 确保音频消息属性存在
    if (processed.type === MESSAGE_TYPE.AUDIO) {
      processed.length = processed.length || 0;
      processed.url = processed.url || '';
    }

    // 确保视频消息属性存在
    if (processed.type === MESSAGE_TYPE.VIDEO) {
      processed.thumb = processed.thumb || '';
      processed.url = processed.url || '';
    }

    // 确保合并消息属性存在
    if (processed.type === MESSAGE_TYPE.COMBINE) {
      processed.title = processed.title || '聊天记录';
      processed.summary = processed.summary || '';
      processed.messageList = processed.messageList || [];
    }

    // 预先计算常用属性
    processed._isMyself = processed.from === loginUserId;

    // 安全计算是否可以撤回消息
    let canRecall = processed._isMyself;
    if (!canRecall && processed.chatType !== CHAT_TYPE.SINGLE && processed.to) {
      // 确保conversationList存在且有对应的会话
      if (
        store.state.conversationList &&
        store.state.conversationList[processed.to]
      ) {
        const conversation = store.state.conversationList[processed.to];
        canRecall = conversation?.isOwner || conversation?.isAdmin;
      }
    }
    processed._canRecall = canRecall;

    // 计算时间显示（但不在此处缓存，因为依赖于前后消息）
    processed._timeShow = null;

    return processed;
  });
});

// 确保messageData始终作为数组处理，并过滤掉null/undefined项
// 使用缓存避免不必要的数组创建
const messageDataArray = computed(() => {
  return processedMessageData.value;
});

// 组件挂载和卸载处理
onMounted(() => {
  isMounted.value = true;
});

/* login hxId */
const loginUserId = EMClient.user;

/* 消息来源是否为自己 */
const isMyself = (msgBody) => {
  return msgBody.from === loginUserId;
};

/* 是否有撤回权限 */
const canRecallMessage = (msgBody) => {
  if (isMyself(msgBody)) return true;
  if (msgBody.chatType === CHAT_TYPE.SINGLE) return false;
  // 安全检查会话列表和会话是否存在
  if (!store.state.conversationList || !msgBody.to) return false;
  const conversation = store.state.conversationList[msgBody.to];
  return conversation?.isOwner || conversation?.isAdmin;
};
/* 获取消息id集合 */
// 使用缓存避免重复获取getter
const messageIdsCollection = computed(() => {
  try {
    // 获取稳定的引用
    const map = store.getters.getMessageIdsCollectionMap;
    // 如果map是稳定的对象，直接返回
    if (map && typeof map === 'object') {
      return map;
    }
  } catch (error) {
    console.error('获取消息ID集合失败:', error);
  }
  return {};
});

/* 获取当前会话的消息id集合 */
// 缓存当前会话ID，避免不必要的计算
const currentSessionId = ref('');
const currentMessageIds = ref(null);

// 监听路由变化，更新当前会话的消息ID集合
watch(
  () => routeQueryData.value.id,
  (newId) => {
    if (newId) {
      currentSessionId.value = newId;
      currentMessageIds.value = messageIdsCollection.value[newId] || null;
    } else {
      currentSessionId.value = '';
      currentMessageIds.value = null;
    }
  },
  { immediate: true },
);

// 监听messageIdsCollection变化，更新当前会话的消息ID集合
watch(
  () => messageIdsCollection.value,
  (newMap) => {
    if (currentSessionId.value) {
      currentMessageIds.value = newMap[currentSessionId.value] || null;
    }
  },
  { deep: true },
);

/* 消息已读未读逻辑 */
//判断消息已读未读状态
const msgReadStatus = (msgBody) => {
  const { id } = msgBody;
  if (currentMessageIds.value && currentMessageIds.value.has(id)) {
    return currentMessageIds.value.get(id)[MESSAGE_STATUS_TYPE.READ_STATUS];
  }
  return false;
};
/* 文本中是否包含link */
const isLink = (msg) => {
  return paseLink(msg).isLink;
};
/* 获取自己的用户信息 */
const loginUserInfo = computed(() => store.state.loginUserInfo);

/* 获取他人的用户信息 */
const { getUserDisplayNameById, getUserDisplayAvatarById } =
  useGetUserMapInfo();
//处理他人头像展示
const handleOtherAvatar = (msgBody) => {
  return getUserDisplayAvatarById(msgBody.from);
};
//处理聊天对方昵称展示
const handleNickName = (msgBody) => {
  const { chatType, id: groupId } = routeQueryData.value;
  const userId = msgBody.from;
  if (chatType === CHAT_TYPE.SINGLE) {
    return getUserDisplayNameById(userId);
  }
  if (chatType === CHAT_TYPE.GROUP) {
    return getUserDisplayNameById(userId, groupId);
  }
};
/* 处理时间显示间隔 */
// 使用缓存避免重复计算
const timeShowCache = ref(new Map());

const handleMsgTimeShow = (time, index) => {
  // 使用时间戳和索引作为缓存键
  const cacheKey = `${time}-${index}`;

  // 如果缓存中存在，直接返回
  if (timeShowCache.value.has(cacheKey)) {
    return timeShowCache.value.get(cacheKey);
  }

  // 计算时间显示
  let result;
  if (index !== 0 && index < messageDataArray.value.length) {
    const lastTime = messageDataArray.value[index - 1].time;
    result = time - lastTime > 50000 ? dateFormat('MM/DD/HH:mm', time) : false;
  } else {
    result = dateFormat('MM/DD/HH:mm', time);
  }

  // 缓存结果
  timeShowCache.value.set(cacheKey, result);
  return result;
};

// 监听messageDataArray变化，清理时间显示缓存
watch(
  () => messageDataArray.value.length,
  () => {
    timeShowCache.value.clear();
  },
);
//音频播放状态
const audioPlayStatus = reactive({
  isPlaying: false, //是否在播放中
  playMsgId: '', //在播放的音频消息id,
});
// 保存所有音频实例，用于组件销毁时清理
const audioInstances = ref([]);

//开始播放
const startplayAudio = (msgBody) => {
  const armRec = new BenzAMRRecorder();
  audioInstances.value.push(armRec);

  const src = msgBody.url;
  audioPlayStatus.playMsgId = msgBody.id;

  //初始化音频源并调用播放
  armRec
    .initWithUrl(src)
    .then(() => {
      if (isMounted.value && !audioPlayStatus.isPlaying) {
        armRec.play();
      }
    })
    .catch((error) => {
      // 处理音频解码失败错误
      console.error('音频解码失败:', error);
      audioPlayStatus.playMsgId = '';
      audioPlayStatus.isPlaying = false;
      ElMessage.error('音频解码失败，请检查音频文件格式');
    });
  //播放开始监听
  if (armRec.onPlay) {
    armRec.onPlay(() => {
      if (isMounted.value) {
        audioPlayStatus.isPlaying = true;
        audioPlayStatus.playMsgId = msgBody.id;
      }
    });
  }
  //播放结束监听
  if (armRec.onStop) {
    armRec.onStop(() => {
      if (isMounted.value) {
        audioPlayStatus.isPlaying = false;
        audioPlayStatus.playMsgId = '';
      }
    });
  }
  // 注意：BenzAMRRecorder不支持onError方法，错误通过Promise的catch处理
};

// 组件销毁时清理所有资源
onUnmounted(() => {
  // 设置组件为未挂载状态
  isMounted.value = false;

  // 停止所有音频播放
  audioInstances.value.forEach((armRec) => {
    if (armRec.stop) {
      armRec.stop();
    }
    // 移除所有音频事件监听器
    if (armRec.offPlay) armRec.offPlay();
    if (armRec.offStop) armRec.offStop();
    if (armRec.offError) armRec.offError();
  });
  audioInstances.value = [];

  // 清理引用消息定时器
  if (quoteMsgTimer.value) {
    clearTimeout(quoteMsgTimer.value);
    quoteMsgTimer.value = null;
  }

  // 清理时间显示缓存
  timeShowCache.value.clear();

  // 清理当前会话ID和消息ID集合
  currentSessionId.value = '';
  currentMessageIds.value = null;

  // 清理其他可能的定时器
  clearTimeout(window.__chatMessageTimer__);

  // 移除所有可能的DOM事件监听器
  const messageBoxes = document.querySelectorAll('.messageList_box');
  messageBoxes.forEach((box) => {
    box.removeEventListener('click', startplayAudio);
    // 移除其他可能的事件监听器
  });
});

//复制文本
// const permissionRead = usePermission('clipboard-read') //请求剪切板读的权限
// const permissionWrite = usePermission('clipboard-write') //请求剪切板写的权限
const { copy, copied, isSupported } = useClipboard(); //copy 复制方法 copied 是否已经复制 isSupported 是否支持剪切板
const copyTextMessages = (msg) => {
  copy(msg);
  if (copied) {
    ElMessage({
      type: 'success',
      message: '成功复制到剪切板',
      center: true,
    });
  }
};
//引用消息
const clickQuoteMsgId = ref('');
const quoteMsgTimer = ref(null);
const clickQuoteMessage = (msgQuote) => {
  const { msgID } = msgQuote;
  nextTick(() => {
    const messageQuery = document.querySelectorAll('.messageList_box');
    const filterQuoteMsg =
      messageQuery.length &&
      Array.from(messageQuery).filter((node) => msgID === node.dataset.mid);
    if (filterQuoteMsg.length) {
      filterQuoteMsg[0].scrollIntoView();
      clickQuoteMsgId.value = msgID;
      // 清理之前的定时器
      if (quoteMsgTimer.value) {
        clearTimeout(quoteMsgTimer.value);
      }
      // 设置新的定时器
      quoteMsgTimer.value = setTimeout(() => {
        clickQuoteMsgId.value = '';
      }, 1000);
    } else {
      ElMessage({
        type: 'error',
        message: '无法定位到原消息',
        center: true,
      });
    }
  });
};

//撤回消息
const recallMessage = async ({ id, to, chatType }) => {
  const options = {
    mid: id,
    to: to,
    chatType: chatType,
  };
  try {
    await store.dispatch('recallMessage', options);
  } catch (error) {
    handleSDKErrorNotifi(error.type, error.message);
  }
};
//编辑消息
const modifyMessageRef = ref(null);
const showModifyMsgModal = (msgBody) => {
  nextTick(() => {
    modifyMessageRef.value.initModifyMessage(msgBody);
  });
};
//删除消息
const deleteMessage = async (msgBody) => {
  try {
    await ElMessageBox.confirm(
      '消息删除是从服务端删除，确认要删除吗？',
      '消息删除',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    await store.dispatch('removeMessage', { ...msgBody });
    ElMessage({
      type: 'success',
      message: '消息已删除',
      center: true,
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage({
        type: 'error',
        message: '删除失败',
        center: true,
      });
    }
  }
};
// 消息举报
const reportMessage = ref(null);
//举报消息
const informOnMessage = (msgBody) => {
  reportMessage.value.alertReportMsgModal(msgBody);
};
//父组件重新编辑方法
const reEdit = (msg) => {
  if (isMounted.value) {
    emit('reEditMessage', msg);
  }
};
//调用父组件引用消息
const onMsgQuote = (msg) => {
  if (isMounted.value) {
    emit('messageQuote', msg);
  }
};
</script>
<template>
  <div>
    <div
      class="messageList_box"
      v-for="(msgBody, index) in messageDataArray"
      :key="msgBody.id || `msg_${index}_${msgBody.time || 0}`"
      :data-mid="msgBody.id"
    >
      <!-- 普通消息气泡 -->
      <template
        v-if="!msgBody.isRecall && msgBody.type !== CUSTOM_MESSAGE_TYPE.INFORM"
      >
        <div
          class="message_box_item"
          :style="{
            flexDirection: msgBody._isMyself ? 'row-reverse' : 'row',
          }"
        >
          <div class="message_item_time">
            {{ handleMsgTimeShow(msgBody.time, index) || '' }}
          </div>
          <div class="message_avatar_container">
            <el-avatar
              class="message_item_avatar"
              :src="
                msgBody._isMyself
                  ? loginUserInfo.avatarurl
                  : handleOtherAvatar(msgBody)
              "
            >
            </el-avatar>
            <span class="message_item_account">{{ msgBody.from }}</span>
          </div>
          <!-- 普通消息内容 -->
          <div class="message_box_card">
            <span v-show="!msgBody._isMyself" class="message_box_nickname">{{
              handleNickName(msgBody)
            }}</span>
            <el-dropdown
              class="message_box_content"
              :class="[
                msgBody._isMyself
                  ? 'message_box_content_mine'
                  : 'message_box_content_other',
                clickQuoteMsgId === msgBody.id && 'quote_msg_avtive',
              ]"
              trigger="contextmenu"
              placement="bottom-end"
            >
              <!-- 将所有消息内容包裹在一个容器中，确保el-dropdown只有一个直接子元素 -->
              <div class="message_content_wrapper">
                <!-- 文本类型消息 -->
                <p
                  style="padding: 10px; line-height: 20px"
                  v-if="msgBody.type === MESSAGE_TYPE.TEXT"
                >
                  <template v-if="!isLink(msgBody.msg)">
                    {{ msgBody.msg }}
                    <!-- 已编辑 -->
                    <sup
                      style="font-size: 7px; color: #707784"
                      v-show="msgBody?.modifiedInfo?.operationCount"
                      >（已编辑）</sup
                    >
                  </template>
                  <template v-else>
                    <span v-html="paseLink(msgBody.msg).msg"> </span
                  ></template>
                </p>
                <!-- 图片类型消息 -->
                <el-image
                  v-if="msgBody.type === MESSAGE_TYPE.IMAGE"
                  style="border-radius: 5px"
                  :src="msgBody.thumb"
                  :preview-src-list="[msgBody.url]"
                  :initial-index="1"
                  fit="cover"
                />
                <!-- 视频类型消息 -->
                <video
                  v-if="msgBody.type === MESSAGE_TYPE.VIDEO"
                  :src="msgBody.url"
                  :poster="msgBody.thumb"
                  style="height: 100%; width: 100%; border-radius: 5px"
                  controls
                ></video>
                <!-- 语音类型消息 -->
                <div
                  :class="[
                    'message_box_content_audio',
                    msgBody._isMyself
                      ? 'message_box_content_audio_mine'
                      : 'message_box_content_audio_other',
                  ]"
                  v-if="msgBody.type === MESSAGE_TYPE.AUDIO"
                  @click="startplayAudio(msgBody)"
                  :style="`width:${msgBody.length * 10}px`"
                >
                  <span class="audio_length_text"> {{ msgBody.length }}′′ </span>
                  <div
                    :class="[
                      msgBody._isMyself
                        ? 'play_audio_icon_mine'
                        : 'play_audio_icon_other',
                      audioPlayStatus.playMsgId === msgBody.id &&
                        'start_play_audio',
                    ]"
                    style="background-size: 100% 100%"
                  ></div>
                </div>
                <div v-if="msgBody.type === MESSAGE_TYPE.LOCAL">
                  <p style="padding: 10px">[暂不支持位置消息展示]</p>
                </div>
                <!-- 文件类型消息 -->
                <div
                  v-if="msgBody.type === MESSAGE_TYPE.FILE"
                  class="message_box_content_file"
                >
                  <div class="file_text_box">
                    <div class="file_name">
                      {{ msgBody.filename }}
                    </div>
                    <div class="file_size">
                      {{ fileSizeFormat(msgBody.file_length) }}
                    </div>
                    <a class="file_download" :href="msgBody.url" download
                      >点击下载</a
                    >
                  </div>
                  <span class="iconfont icon-wenjian"></span>
                </div>
                <!-- 合并消息 -->
                <div
                  v-if="msgBody.type === MESSAGE_TYPE.COMBINE"
                  class="message_box_content_combine"
                >
                  <div class="combine_title">
                    <span class="iconfont icon-hebing"></span>
                    {{ msgBody.title || '聊天记录' }}
                  </div>
                  <div class="combine_summary">
                    {{ msgBody.summary || '' }}
                  </div>
                  <div class="combine_count">
                    共{{ msgBody.messageList?.length || 0 }}条消息
                  </div>
                  <div class="combine_compatible" v-if="msgBody.compatibleText">
                    {{ msgBody.compatibleText }}
                  </div>
                </div>
                <!-- 自定义类型消息 -->
                <div
                  v-if="msgBody.type === MESSAGE_TYPE.CUSTOM"
                  class="message_box_content_custom"
                >
                  <template
                    v-if="
                      msgBody.customEvent &&
                      CUSTOM_MSG_EVENT_TYPE[msgBody.customEvent]
                    "
                  >
                    <div class="user_card">
                      <div class="user_card_main">
                        <!-- 头像 -->
                        <el-avatar
                          shape="circle"
                          :size="50"
                          :src="
                            (msgBody.customExts &&
                              msgBody.customExts.avatarurl) ||
                            msgBody.customExts.avatar ||
                            defaultAvatar
                          "
                          fit="cover"
                        />
                        <!-- 昵称 -->
                        <span class="nickname">{{
                          (msgBody.customExts && msgBody.customExts.nickname) ||
                          msgBody.customExts.uid
                        }}</span>
                      </div>
                      <el-divider
                        style="margin: 5px 0; border-top: 1px solid black"
                      />
                      <p style="font-size: 8px">个人名片</p>
                    </div>
                  </template>
                </div>
              </div>
              <!-- 右键点击弹起更多功能栏 -->
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-if="msgBody.type === MESSAGE_TYPE.TEXT && isSupported"
                    @click="copyTextMessages(msgBody.msg)"
                  >
                    复制
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="msgBody._canRecall"
                    @click="recallMessage(msgBody)"
                  >
                    撤回
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="
                      msgBody.type === MESSAGE_TYPE.TEXT && msgBody._isMyself
                    "
                    @click="showModifyMsgModal(msgBody)"
                  >
                    编辑
                  </el-dropdown-item>
                  <el-dropdown-item @click="onMsgQuote(msgBody)">
                    引用
                  </el-dropdown-item>
                  <el-dropdown-item @click="deleteMessage(msgBody)">
                    删除
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="!msgBody._isMyself"
                    @click="informOnMessage(msgBody)"
                  >
                    举报
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <!-- 引用消息展示框 -->
            <div
              class="message_quote_box"
              v-if="msgBody?.ext?.msgQuote"
              @click="clickQuoteMessage(msgBody.ext.msgQuote)"
            >
              <p>
                {{ msgBody?.ext?.msgQuote?.msgSender }}：{{
                  msgBody?.ext?.msgQuote?.msgPreview
                }}
              </p>
            </div>
          </div>
          <!-- 消息状态展示 -->
          <div class="message_item_status">
            <img
              class="message_item_readed_icon"
              v-if="msgReadStatus(msgBody) && msgBody._isMyself"
              :src="messageReadedIcon"
              title="消息已读"
            />
          </div>
        </div>
      </template>
      <!-- 撤回消息通知 -->
      <template v-if="msgBody.isRecall">
        <div class="recall_style">
          {{
            msgBody._isMyself
              ? '你'
              : `${getUserDisplayNameById(msgBody.from)}`
          }}撤回了一条消息<span
            class="reEdit"
            v-show="msgBody._isMyself && msgBody.type === MESSAGE_TYPE.TEXT"
            @click="reEdit(msgBody.msg)"
            >重新编辑</span
          >
        </div>
      </template>
      <!-- 灰色系统通知 -->
      <template v-if="msgBody.type === CUSTOM_MESSAGE_TYPE.INFORM">
        <div class="inform_style">
          <p>
            {{ msgBody.msg }}
          </p>
        </div>
      </template>
    </div>
    <ReportMessage ref="reportMessage" />
    <ModifyMessage ref="modifyMessageRef" />
  </div>
</template>

<style lang="scss" scoped>
@import './index.scss';
</style>

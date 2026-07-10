import { ElMessage } from 'element-plus';
import {
  CHAT_TYPE,
  GROUP_OPERATION_TYPE,
  GROUP_ROLE_TYPE,
} from '@/IM/constant';
import { EMClient } from '@/IM';
import {
  DEFAULT_GROUP_MEMBERS_PAGE_SIZE,
  buildModifyGroupPayload,
  normalizeFetchedGroupMembers,
  getNextJoinedGroupsPage,
  normalizeGroupSharedFileList,
} from '@/utils/groupDocAdapters';
const Groups = {
  state: {
    groupsInfos: {}, //计划废弃
    joinedGroup: {
      pagingParams: {
        pageNum: 0,
        pageSize: 20,
      },
      joinedGroupList: [],
      joinedGroupListTotal: 0,
      publicPagingCursor: '',
      publicGroupList: [],
      publicGroupListTotal: 0,
      joinedGroupCount: 0,
    },
    groupDetails: new Map(), //key:groupId value:groupDetail
    groupMembers: new Map(), //key:groupId value:groupMemberList
    groupSharedFiles: new Map(), //key:groupId value:sharedFileList
  },
  mutations: {
    SET_JOINED_GROUP: (state, payload) => {
      const { total, entities: joinedGroupList } = payload;
      state.joinedGroup.pagingParams.pageNum++;
      state.joinedGroup.joinedGroupListTotal = total;
      state.joinedGroup.joinedGroupList = _.unionBy(
        [...joinedGroupList],
        [...state.joinedGroup.joinedGroupList],
        (g) => g.groupId,
      );
      state.joinedGroup.joinedGroupCount = total;
    },
    RESET_JOINED_GROUP_LIST: (state, payload = {}) => {
      const { pageNum = 0 } = payload;
      state.joinedGroup.pagingParams.pageNum = pageNum;
      state.joinedGroup.joinedGroupList = [];
      state.joinedGroup.joinedGroupListTotal = 0;
    },
    SET_JOINED_GROUP_COUNT: (state, total) => {
      state.joinedGroup.joinedGroupCount = Number(total || 0);
    },
    SET_PUBLIC_GROUPS: (state, payload) => {
      const { cursor = '', entities = [], isInit = false } = payload;
      state.joinedGroup.publicPagingCursor = cursor;
      state.joinedGroup.publicGroupList = isInit
        ? [...entities]
        : _.unionBy(
            [...state.joinedGroup.publicGroupList],
            [...entities],
            (group) => group.groupid,
          );
      state.joinedGroup.publicGroupListTotal =
        state.joinedGroup.publicGroupList.length;
    },
    UPDATE_GROUP_SHIELD_STATUS: (state, payload) => {
      const { groupId, shieldgroup } = payload;
      state.joinedGroup.joinedGroupList.forEach((groupItem) => {
        if (groupItem.groupId === groupId) {
          groupItem.shieldgroup = Boolean(shieldgroup);
        }
      });
      if (!state.groupDetails.has(groupId)) {
        state.groupDetails.set(groupId, { shieldgroup: Boolean(shieldgroup) });
      } else {
        state.groupDetails.get(groupId).shieldgroup = Boolean(shieldgroup);
      }
    },
    SET_GROUP_DETAILS: (state, payload) => {
      const { groupDetailsList } = payload;
      groupDetailsList.length > 0 &&
        groupDetailsList.forEach((groupDetail) => {
          state.groupDetails.set(groupDetail.id, groupDetail);
        });
    },
    SET_GROUPS_MEMBERS: (state, payload) => {
      const { groupId, members } = payload;
      state.groupMembers.set(groupId, [...members]);
      //同步更新群组列表里面的群人数
      if (state.joinedGroup.joinedGroupList.length) {
        state.joinedGroup.joinedGroupList.forEach((groupItem) => {
          if (groupItem.groupId === groupId) {
            groupItem.affiliationsCount = members.length;
          }
        });
      }
    },
    SET_GROUPS_BLIACK_LIST: (state, payload) => {
      const { groupId, blacklist } = payload;
      if (!state.groupDetails.has(groupId)) {
        state.groupDetails.set(groupId, { blacklist });
      }
      state.groupDetails.get(groupId).blacklist = blacklist;
    },
    SET_GROUPS_MUTE_LIST: (state, payload) => {
      const { groupId, mutelist } = payload;
      if (!state.groupDetails.has(groupId)) {
        state.groupDetails.set(groupId, { mutelist });
      }
      state.groupDetails.get(groupId).mutelist = mutelist;
    },
    SET_GROUPS_ANNOUN: (state, payload) => {
      const { groupId, announcement } = payload;
      if (!state.groupDetails.has(groupId)) {
        state.groupDetails.set(groupId, { announcement: announcement });
      }
      state.groupDetails.get(groupId).announcement = announcement;
    },
    SET_GROUP_SHARED_FILES: (state, payload) => {
      const { groupId, files } = payload;
      state.groupSharedFiles.set(groupId, [...files]);
    },
    //设置用户在群组中的群组属性
    SET_GROUP_MEMBERS_INFO: (state, payload) => {
      const { groupId, inGroupInfo } = payload;
      let groupMemberInfo = {};
      inGroupInfo.length > 0 &&
        inGroupInfo.forEach(
          (item) => (groupMemberInfo = Object.assign(groupMemberInfo, item)),
        );
      if (!state.groupDetails.has(groupId)) {
        state.groupDetails.set(groupId, { groupMemberInfo });
      }
      state.groupDetails.get(groupId).groupMemberInfo = groupMemberInfo;
    },
    //更新本地缓存群组信息
    UPDATE_CACHE_GROUP_INFO: (state, payload) => {
      const { groupId, type, params } = payload;
      //更新群组列表内数据
      if (type === 'groupName') {
        state.joinedGroup.joinedGroupList.length > 0 &&
          state.joinedGroup.joinedGroupList.forEach((groupItem) => {
            if (groupItem.groupId === groupId) {
              groupItem.groupName = params;
            }
          });
        state.groupDetails.has(groupId) &&
          (state.groupDetails.get(groupId).name = params);
      }
      //更新群组详情内的数据
      if (type === 'groupDescription') {
        state.joinedGroup.joinedGroupList.length > 0 &&
          state.joinedGroup.joinedGroupList.forEach((groupItem) => {
            if (groupItem.groupId === groupId) {
              groupItem.description = params;
            }
          });
        state.groupDetails.has(groupId) &&
          (state.groupDetails.get(groupId).description = params);
      }
      if (type === 'groupAvatar') {
        state.joinedGroup.joinedGroupList.length > 0 &&
          state.joinedGroup.joinedGroupList.forEach((groupItem) => {
            if (groupItem.groupId === groupId) {
              groupItem.avatar = params;
            }
          });
        state.groupDetails.has(groupId) &&
          (state.groupDetails.get(groupId).avatar = params);
      }
      if (type === 'groupExt') {
        state.joinedGroup.joinedGroupList.length > 0 &&
          state.joinedGroup.joinedGroupList.forEach((groupItem) => {
            if (groupItem.groupId === groupId) {
              groupItem.ext = params;
            }
          });
        if (state.groupDetails.has(groupId)) {
          state.groupDetails.get(groupId).ext = params;
          state.groupDetails.get(groupId).custom = params;
        }
      }
      //更新群成员数
      if (type === 'groupMemberCount') {
        state.joinedGroup.joinedGroupList.length > 0 &&
          state.joinedGroup.joinedGroupList.forEach((groupItem) => {
            if (groupItem.groupId === groupId) {
              groupItem.affiliationsCount = params;
            }
          });
        state.groupDetails.has(groupId) &&
          (state.groupDetails.get(groupId).affiliations_count = params);
      }
    },
    //更新本地缓存群组成员
    UPDATE_GROUP_MEMBERS: (state, payload) => {
      const { groupId, member, type } = payload;
      switch (type) {
        case GROUP_OPERATION_TYPE.MEMBER_PRESENCE:
          {
            state.groupMembers.has(groupId) &&
              state.groupMembers.get(groupId).push({ member });
          }
          break;
        case GROUP_OPERATION_TYPE.MEMBER_ABSENCE:
          {
            if (
              state.groupMembers.has(groupId) &&
              state.groupMembers.get(groupId).length > 0
            ) {
              const _index = state.groupMembers
                .get(groupId)
                .findIndex(
                  (item) =>
                    (item.member || item.owner || item.userId) === member,
                );
              if (_index > -1) {
                state.groupMembers.get(groupId).splice(_index, 1);
              }
            }
          }
          break;
        default:
          break;
      }
    },
    //更新群组管理员
    UPDATE_GORUPS_ADMIN: (state, payload) => {
      const { type, groupId, userId } = payload;
      state.joinedGroup.joinedGroupList.length > 0 &&
        state.joinedGroup.joinedGroupList.forEach((groupItem) => {
          if (groupItem.groupId === groupId && userId === EMClient.user) {
            if (type === GROUP_OPERATION_TYPE.SET_ADMIN) {
              groupItem.role = GROUP_ROLE_TYPE.ADMIN;
            } else if (type === GROUP_OPERATION_TYPE.REMOVE_ADMIN) {
              groupItem.role = GROUP_ROLE_TYPE.MEMBER;
            }
          }
        });
      if (type === GROUP_OPERATION_TYPE.SET_ADMIN) {
        if (state.groupDetails.has(groupId)) {
          const adminlist = state.groupDetails.get(groupId).adminlist || [];
          if (!adminlist.includes(userId)) {
            state.groupDetails.get(groupId).adminlist = [...adminlist, userId];
          }
        }
      } else if (type === GROUP_OPERATION_TYPE.REMOVE_ADMIN) {
        if (
          state.groupDetails.has(groupId) &&
          state.groupDetails.get(groupId).adminlist?.length > 0
        ) {
          const _index = state.groupDetails
            .get(groupId)
            .adminlist.findIndex((item) => item === userId);
          state.groupDetails.get(groupId).adminlist.splice(_index, 1);
        }
      }
    },
    //删除缓存群组列表
    DELETE_JOINED_GROUP_LIST: (state, payload) => {
      const { groupId } = payload;
      if (state.joinedGroup.joinedGroupList.length > 0) {
        const _index = state.joinedGroup.joinedGroupList.findIndex(
          (item) => item.groupId === groupId,
        );
        if (_index > -1) {
          state.joinedGroup.joinedGroupList.splice(_index, 1);
          state.joinedGroup.joinedGroupListTotal = Math.max(
            state.joinedGroup.joinedGroupListTotal - 1,
            0,
          );
          state.joinedGroup.joinedGroupCount = Math.max(
            state.joinedGroup.joinedGroupCount - 1,
            0,
          );
        }
      }
    },
  },
  actions: {
    //从服务端获取加入的群组列表
    fetchJoinedGroupListFromServer: async (
      { state, dispatch, commit },
      params = {},
    ) => {
      const {
        pagingParams: { pageSize },
      } = state.joinedGroup;
      const { startPageNum, reset = false } = params;
      try {
        const shouldReset = reset || startPageNum === 0;
        if (shouldReset) {
          commit('RESET_JOINED_GROUP_LIST', {
            pageNum: startPageNum !== undefined ? startPageNum : 0,
          });
        }
        const nextPageNum =
          startPageNum !== undefined
            ? startPageNum
            : getNextJoinedGroupsPage(state.joinedGroup);
        const { total, entities } = await EMClient.getJoinedGroups({
          pageNum: nextPageNum,
          pageSize: pageSize,
          needAffiliations: true,
          needRole: true,
        });
        commit('SET_JOINED_GROUP_COUNT', total);
        if (entities?.length === 0) return;
        commit('SET_JOINED_GROUP', { total, entities });
        const groupIds = _.map(entities, 'groupId');
        if (groupIds?.length === 0) return;
        dispatch('fetchGroupDetailFromServer', groupIds).catch(() => {});
      } catch (error) {
        console.error('加入的群组列表获取失败', error);
      }
    },
    //从服务端获取群组详情
    fetchGroupDetailFromServer: async ({ commit }, groupIds = []) => {
      let groupDetails = [];
      async function fetchDetailsForGroupIds(groupIdArray) {
        try {
          const result = await EMClient.getGroupInfo({
            groupId: groupIdArray,
          });
          groupDetails = groupDetails.concat(result.data);
          commit('SET_GROUP_DETAILS', {
            groupDetailsList: groupDetails,
          });
        } catch (error) {
          console.error('[Group Details] fetchGroupDetailFromServer failed', {
            groupIds: groupIdArray,
            currentUser: EMClient.user,
            error,
          });
          throw error;
        }
      }

      if (groupIds.length > 1) {
        const groupIdsArr = _.chunk([...groupIds], 20);
        for (const groupIdsChunk of groupIdsArr) {
          await fetchDetailsForGroupIds(groupIdsChunk);
        }
      } else {
        await fetchDetailsForGroupIds(groupIds);
      }
    },
    //获取群组成员
    fetchGroupsMemberFromServer: async (
      { dispatch, commit },
      { groupId, chatType },
    ) => {
      if (!EMClient.user) {
        console.error('[Group Members] 用户未登录，无法获取群组成员', {
          groupId,
          chatType,
        });
        return;
      }
      // 仅群聊调用 getGroupInfo；与 CHAT_TYPE.GROUP（'groupChat'）对齐
      if (chatType !== CHAT_TYPE.GROUP) {
        return;
      }
      try {
        let cursor = '';
        let members = [];
        do {
          const result = await EMClient.getGroupMembers({
            groupId,
            cursor,
            limit: DEFAULT_GROUP_MEMBERS_PAGE_SIZE,
          });
          const fetchedMembers = normalizeFetchedGroupMembers(
            result?.data?.members || [],
          );
          members = members.concat(fetchedMembers);
          cursor = result?.data?.cursor || '';
        } while (cursor);
        commit('SET_GROUPS_MEMBERS', {
          groupId,
          members,
        });
      } catch (error) {
        console.error('[Group Members] getGroupMembers failed', {
          groupId,
          chatType,
          error,
        });
      }
    },
    fetchPublicGroupListFromServer: async ({ state, commit }, params = {}) => {
      const { limit = 20, cursor, reset = false } = params;
      try {
        const nextCursor =
          cursor !== undefined
            ? cursor
            : reset
            ? ''
            : state.joinedGroup.publicPagingCursor;
        const result = await EMClient.getPublicGroups({
          limit,
          cursor: nextCursor,
        });
        commit('SET_PUBLIC_GROUPS', {
          cursor: result?.cursor || result?.data?.cursor || '',
          entities: result?.data || [],
          isInit: reset || nextCursor === '',
        });
        return result || {};
      } catch (error) {
        console.error('公开群列表获取失败', error);
        throw error;
      }
    },
    fetchJoinedGroupCountFromServer: async ({ commit }) => {
      try {
        const result = await EMClient.getJoinedGroupsCount();
        commit('SET_JOINED_GROUP_COUNT', result?.data || 0);
        return result?.data || 0;
      } catch (error) {
        console.error('群组数量获取失败', error);
        throw error;
      }
    },
    //获取登录用户在某群内的群组属性
    fetchInTheGroupInfoFromServer: async ({ dispatch, commit }, groupId) => {
      try {
        let options = {
          groupId: groupId,
          userId: EMClient.user,
        };
        const { data } = await EMClient.getGroupMemberAttributes(options);
        commit('SET_GROUP_MEMBERS_INFO', {
          groupId: groupId,
          inGroupInfo: [{ [EMClient.user]: { nickName: data.nickName } }],
        });
      } catch (error) {
        console.error('>>>>>群组属性获取失败', error);
      }
    },
    //批量获取群成员群内群组属性
    fetchGroupMemberAttributesFromServer: async (
      { dispatch, commit },
      params,
    ) => {
      const { groupId, members } = params;
      const membersList = _.chunk(members, 10);

      // 添加并发控制
      const MAX_CONCURRENT = 5;
      const queue = [];
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); // 新增延迟函数

      while (membersList.length) {
        const chunk = membersList.splice(0, MAX_CONCURRENT);
        const requests = chunk.map((list) =>
          EMClient.getGroupMembersAttributes({
            groupId,
            userIds: _.flatten(_.map(list, _.values)),
          }),
        );

        const results = await Promise.all(requests);
        queue.push(...results);

        // 添加间隔延迟（最后一个批次不等待）
        if (membersList.length > 0) {
          await delay(1000); // 每个并发批次间隔1秒
        }
      }

      if (queue.length > 0) {
        const groupUsersInfo = _.compact(_.flatMap(queue, 'data'));
        // 处理嵌套数据结构并提交到用户信息模块
        _.forEach(groupUsersInfo, (userObj) => {
          _.forEach(userObj, (info, userId) => {
            if (info?.nickName) {
              commit('UsersProfile/UPDATE_USER_PROFILE', {
                userId,
                sourceType: 'group',
                groupId: params.groupId,
                profile: { nickName: info.nickName },
              });
            }
          });
        });
      }
    },
    //设置登录用户在某群的群组属性
    setInTheGroupInfo: async ({ commit }, params) => {
      const { groupId, nickName } = params;
      try {
        await EMClient.setGroupMemberAttributes({
          groupId: groupId,
          userId: EMClient.user,
          memberAttributes: {
            nickName,
          },
        });
        //通知用户信息管理模块更新群内用户属性。
        commit('UsersProfile/UPDATE_USER_PROFILE', {
          userId: EMClient.user,
          sourceType: 'group',
          groupId: params.groupId,
          profile: { nickName: nickName },
        });
      } catch (error) {
        console.error(error);
      }
    },
    //获取群公告
    fetchAnnounmentFromServer: async ({ dispatch, commit }, groupId) => {
      const option = {
        groupId: groupId,
      };
      try {
        const { data } = await EMClient.fetchGroupAnnouncement(option);
        commit('SET_GROUPS_ANNOUN', {
          groupId: groupId,
          announcement: data.announcement,
        });
      } catch (error) {
        console.error('>>>>>群组公告获取失败', error);
      }
    },
    //群黑名单
    fetchGroupsBlackListFromServer: async ({ commit }, groupId) => {
      try {
        const { data } = await EMClient.getGroupBlocklist({
          groupId: groupId,
        });
        commit('SET_GROUPS_BLIACK_LIST', {
          groupId: groupId,
          blacklist: data,
        });
      } catch (error) {
        console.error(error);
      }
    },
    //群禁言列表
    fetchGroupsMuteListFromServer: async ({ dispatch, commit }, params) => {
      try {
        const { data } = await EMClient.getGroupMuteList({
          groupId: params,
        });
        commit('SET_GROUPS_MUTE_LIST', {
          groupId: params,
          mutelist: data,
        });
      } catch (error) {
        let errorMsg = '获取禁言列表失败，请稍后重试';
        if (error?.data) {
          const errorData =
            typeof error.data === 'string'
              ? error.data
              : JSON.stringify(error.data);
          if (
            errorData.includes('group_authorization') ||
            errorData.includes('group owner permission')
          ) {
            errorMsg = '没有权限获取禁言列表，只有聊天室所有者才能执行此操作';
          }
        }
        ElMessage.error(errorMsg);
      }
    },
    // 修改群名、群描述、群头像或者群扩展信息
    modifyGroupInfo: async ({ dispatch, commit }, params) => {
      const { groupId, modifyType, content } = params;
      const modifyMap = {
        0: { field: 'groupName', cacheType: 'groupName' },
        1: { field: 'description', cacheType: 'groupDescription' },
        2: { field: 'avatar', cacheType: 'groupAvatar' },
        3: { field: 'ext', cacheType: 'groupExt' },
      };
      const config = modifyMap[modifyType];
      if (!config) {
        throw new Error(`Unsupported group modify type: ${modifyType}`);
      }
      const option = buildModifyGroupPayload({
        groupId,
        [config.field]: content,
      });
      await EMClient.modifyGroup(option);
      commit('UPDATE_CACHE_GROUP_INFO', {
        groupId,
        type: config.cacheType,
        params: content,
      });
      dispatch('fetchGroupDetailFromServer', [groupId]);
    },
    // 设置/修改群组公告
    modifyGroupAnnouncement: async ({ dispatch }, params) => {
      //SDK入参属性名是确定的此示例直接将属性名改为了SDK所识别的参数如果修改，具体请看文档。
      const { groupId, announcement } = params;
      try {
        await EMClient.updateGroupAnnouncement({ ...params });
        dispatch('fetchAnnounmentFromServer', groupId);
      } catch (error) {
        console.error('群公告修改失败', error);
        throw error;
      }
    },
    fetchGroupSharedFilesFromServer: async ({ commit }, params) => {
      const option =
        typeof params === 'string'
          ? { groupId: params }
          : { pageNum: 1, pageSize: 20, ...params };
      try {
        const result = await EMClient.getGroupSharedFilelist(option);
        const files = normalizeGroupSharedFileList(result);
        commit('SET_GROUP_SHARED_FILES', {
          groupId: option.groupId,
          files,
        });
        return files;
      } catch (error) {
        console.error('群共享文件列表获取失败', {
          groupId: option.groupId,
          currentUser: EMClient.user,
          error,
        });
        throw error;
      }
    },
    uploadGroupSharedFile: async ({ dispatch }, params) => {
      const { groupId, file, onFileUploadProgress } = params;
      return new Promise((resolve, reject) => {
        try {
          EMClient.uploadGroupSharedFile({
            groupId,
            file,
            onFileUploadProgress,
            onFileUploadComplete: async (response) => {
              console.log('群共享文件上传成功', {
                groupId,
                fileName: file?.name,
                fileSize: file?.size,
                currentUser: EMClient.user,
                response,
              });
              try {
                await dispatch('fetchGroupSharedFilesFromServer', { groupId });
              } catch (refreshError) {
                console.error('群共享文件上传后刷新列表失败', {
                  groupId,
                  fileName: file?.name,
                  currentUser: EMClient.user,
                  error: refreshError,
                });
              }
              resolve(response);
            },
            onFileUploadError: (error) => {
              console.error('群共享文件上传失败', {
                groupId,
                fileName: file?.name,
                fileSize: file?.size,
                currentUser: EMClient.user,
                error,
              });
              reject(error);
            },
            onFileUploadCanceled: (error) => {
              console.error('群共享文件上传取消', {
                groupId,
                fileName: file?.name,
                fileSize: file?.size,
                currentUser: EMClient.user,
                error,
              });
              reject(error);
            },
          });
        } catch (error) {
          console.error('群共享文件上传调用失败', {
            groupId,
            fileName: file?.name,
            fileSize: file?.size,
            currentUser: EMClient.user,
            error,
          });
          reject(error);
        }
      });
    },
    downloadGroupSharedFile: async (_, params) => {
      const { groupId, fileId, secret } = params;
      return new Promise((resolve, reject) => {
        try {
          EMClient.downloadGroupSharedFile({
            groupId,
            fileId,
            secret,
            onFileDownloadComplete: (response) => {
              console.log('群共享文件下载成功', {
                groupId,
                fileId,
                currentUser: EMClient.user,
                response,
              });
              resolve(response);
            },
            onFileDownloadError: (error) => {
              console.error('群共享文件下载失败', {
                groupId,
                fileId,
                currentUser: EMClient.user,
                error,
              });
              reject(error);
            },
          });
        } catch (error) {
          console.error('群共享文件下载调用失败', {
            groupId,
            fileId,
            currentUser: EMClient.user,
            error,
          });
          reject(error);
        }
      });
    },
    deleteGroupSharedFile: async ({ dispatch }, params) => {
      const { groupId, fileId } = params;
      try {
        const result = await EMClient.deleteGroupSharedFile({
          groupId,
          fileId,
        });
        await dispatch('fetchGroupSharedFilesFromServer', { groupId });
        return result;
      } catch (error) {
        console.error('群共享文件删除失败', {
          groupId,
          fileId,
          currentUser: EMClient.user,
          error,
        });
        throw error;
      }
    },
    blockGroupMessage: async ({ commit }, groupId) => {
      try {
        await EMClient.blockGroupMessage({ groupId });
        commit('UPDATE_GROUP_SHIELD_STATUS', {
          groupId,
          shieldgroup: true,
        });
        ElMessage.success('已屏蔽该群消息');
      } catch (error) {
        ElMessage.error('屏蔽群消息失败，请稍后重试');
        throw error;
      }
    },
    unblockGroupMessage: async ({ commit }, groupId) => {
      try {
        await EMClient.unblockGroupMessage({ groupId });
        commit('UPDATE_GROUP_SHIELD_STATUS', {
          groupId,
          shieldgroup: false,
        });
        ElMessage.success('已取消屏蔽该群消息');
      } catch (error) {
        ElMessage.error('取消屏蔽群消息失败，请稍后重试');
        throw error;
      }
    },
    //邀请群成员
    inviteUserJoinTheGroup: async ({ dispatch }, params) => {
      //SDK入参属性名是确定的此示例直接将属性名改为了SDK所识别的参数如果修改，具体请看文档。
      const { users, groupId } = params;
      try {
        await EMClient.inviteUsersToGroup({ users: [users], groupId });
        ElMessage({
          message: '群组邀请成功送出~',
          type: 'success',
        });
      } catch (error) {
        console.error('[Group Invite] inviteUsersToGroup failed', {
          groupId,
          users,
          error,
        });
        ElMessage({
          message: '群组邀请失败，请稍后重试~',
          type: 'error',
        });
      }
    },
    //移出群成员
    removeTheGroupMember: async ({ dispatch }, params) => {
      //SDK入参属性名是确定的此示例直接将属性名改为了SDK所识别的参数如果修改，具体请看文档。
      const { username, groupId } = params;
      try {
        await EMClient.removeGroupMember({ username, groupId });
        ElMessage({
          message: `已将${username}移出群组!`,
          type: 'success',
        });
        //更新群成员
        dispatch('fetchGroupsMemberFromServer', {
          groupId,
          chatType: 'groupChat',
        });
      } catch (error) {
        ElMessage({
          message: '该群成员移出失败，请稍后重试！',
          type: 'error',
        });
      }
    },
    //添加用户到黑名单
    addMemberToBlackList: async ({ dispatch }, params) => {
      const { groupId, usernames } = params;
      try {
        //SDK入参属性名是确定的此示例直接将属性名改为了SDK所识别的参数如果修改，具体请看文档。
        //   let option = {
        //     groupId: "groupId",
        //     usernames: ["user1", "user2"]
        // };
        await EMClient.blockGroupMembers({ groupId, usernames });
        ElMessage({
          message: '黑名单添加成功~',
          type: 'success',
        });
        //重新获取黑名单列表
        dispatch('fetchGroupsBlackListFromServer', groupId);
        //重新获取成员列表
        dispatch('fetchGroupsMemberFromServer', {
          groupId,
          chatType: 'groupChat',
        });
      } catch (error) {
        ElMessage({
          message: '黑名单添加失败，请稍后重试~',
          type: 'error',
        });
      }
    },
    //从黑名单中移出
    removeTheMemberFromBlackList: async ({ dispatch }, params) => {
      const { groupId, usernames } = params;
      try {
        await EMClient.unblockGroupMembers({ groupId, usernames });
        ElMessage({
          message: '黑名单移除成功~',
          type: 'success',
        });
        //重新获取黑名单列表
        dispatch('fetchGroupsBlackListFromServer', groupId);
      } catch (error) {
        console.error('[Group Blocklist] unblockGroupMembers failed', {
          groupId,
          usernames,
          error,
        });
        ElMessage({
          message: '黑名单移除失败，请稍后重试~',
          type: 'error',
        });
      }
    },
    //添加用户到禁言列表
    addMemberToMuteList: async ({ dispatch }, params) => {
      const { groupId, username } = params;
      const targetUsername = Array.isArray(username) ? username[0] : username;

      try {
        await EMClient.muteGroupMember({
          groupId,
          username: targetUsername,
          muteDuration: 886400000,
        });
        ElMessage({
          message: '禁言成功~',
          type: 'success',
        });
        setTimeout(() => {
          dispatch('fetchGroupsMuteListFromServer', groupId);
        }, 800);
      } catch (error) {
        console.error('[Group Mutelist] muteGroupMember failed', {
          groupId,
          username: targetUsername,
          error,
        });
        ElMessage({
          message: '禁言失败，请稍后重试~',
          type: 'error',
        });
      }

      // let option = {
      //   groupId: 'groupId',
      //   username: 'user',
      //   muteDuration: 886400000, // 禁言时长，单位为毫秒。
      // };
      // await EMClient.muteGroupMember(option);
    },
    //从禁言列表中移出
    removeTheMemberFromMuteList: async ({ dispatch }, params) => {
      const { groupId, username } = params;
      const targetUsername = Array.isArray(username) ? username[0] : username;
      try {
        await EMClient.unmuteGroupMember({
          groupId,
          username: targetUsername,
        });
        ElMessage({
          message: '移除禁言成功~',
          type: 'success',
        });
        setTimeout(() => {
          dispatch('fetchGroupsMuteListFromServer', groupId);
        }, 800);
      } catch (error) {
        console.error('[Group Mutelist] unmuteGroupMember failed', {
          groupId,
          username: targetUsername,
          error,
        });
        ElMessage({
          message: '移除禁言失败，请稍后重试~',
          type: 'error',
        });
      }
    },
    //退出群组
    leaveIntheGroup: async ({ commit }, params) => {
      if (!params.groupId) return;
      const { groupId } = params;
      return new Promise((resolve, reject) => {
        EMClient.leaveGroup({
          groupId: groupId,
        })
          .then((res) => {
            commit('DELETE_JOINED_GROUP_LIST', {
              groupId: groupId,
            });
            resolve(res);
          })
          .catch((err) => {
            reject(err);
          });
      });
    },
    //解散群组
    destroyInTheGroup: async ({ commit }, params) => {
      if (!params.groupId) return;
      const { groupId } = params;
      return new Promise((resolve, reject) => {
        const option = {
          groupId: groupId,
        };
        EMClient.destroyGroup(option)
          .then((res) => {
            resolve(res);
            commit('DELETE_JOINED_GROUP_LIST', {
              groupId: groupId,
            });
          })
          .catch((err) => {
            reject(err);
          });
      });
    },
  },
  getters: {
    getGroupDetailMap: (state) => state.groupDetails,
    getGroupMembersMap: (state) => state.groupMembers,
    getGroupSharedFilesMap: (state) => state.groupSharedFiles,
    getJoinedGroupList: (state) => state.joinedGroup.joinedGroupList,
    getJoinedGroupTotal: (state) => state.joinedGroup.joinedGroupListTotal,
    getJoinedGroupCount: (state) => state.joinedGroup.joinedGroupCount,
    getPublicGroupList: (state) => state.joinedGroup.publicGroupList,
    getPublicGroupCursor: (state) => state.joinedGroup.publicPagingCursor,
    //获取加入的群组名
    getGroupName: (state) => (groupId) => {
      const group = state.joinedGroup.joinedGroupList.find(
        (item) => item.groupId === groupId,
      );
      const groupInfo = state.groupDetails.get(groupId) || {};
      return group?.groupName || groupInfo?.name || groupId;
    },
  },
};

export default Groups;

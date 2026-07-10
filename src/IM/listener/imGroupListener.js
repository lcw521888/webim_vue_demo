import { EMClient } from '../index';
import { INFORM_FROM, INFORM_TYPE } from '@/constant';
import store from '@/store';
import { GROUP_OPERATION_TYPE } from '../constant';
import { wrapImEventHandler } from '@/utils/safeCall';

export const imGroupListener = () => {
  const submitInformData = (fromType, informContent) => {
    Promise.resolve(
      store.dispatch('createNewInform', { fromType, informContent }),
    ).catch((err) => console.error('[imGroupListener.createNewInform]', err));
  };
  const refreshGroupDetailFromServer = (groupId) => {
    if (!groupId) return;
    store.dispatch('fetchGroupDetailFromServer', [groupId]).catch(() => {});
  };
  const normalizeGroupEventMembers = (groupevent) => {
    const members = [
      groupevent?.member,
      groupevent?.user,
      groupevent?.username,
      ...(Array.isArray(groupevent?.members) ? groupevent.members : []),
      ...(Array.isArray(groupevent?.users) ? groupevent.users : []),
    ].filter(Boolean);
    return [...new Set(members)];
  };
  const describeGroupEvent = (groupevent) => {
    const operation = groupevent?.operation || '';
    return {
      eventName: INFORM_TYPE[operation] || operation || '未知群组事件',
      operation: operation,
      groupId: groupevent?.id || groupevent?.groupId || '',
      operator: groupevent?.from || groupevent?.operator || '',
      members: normalizeGroupEventMembers(groupevent),
      invitee: groupevent?.invitee || '',
      applicant: groupevent?.applicant || '',
      owner: groupevent?.owner || '',
      memberCount: groupevent?.memberCount ?? '',
      reason: groupevent?.reason || '',
      attributes: groupevent?.attributes || {},
      rawEvent: groupevent,
    };
  };
  const onDispatchGroupEvent = (groupevent) => {
    if (!groupevent || typeof groupevent !== 'object') {
      console.warn('[onDispatchGroupEvent] 无效 groupevent', groupevent);
      return;
    }
    const { operation, id: groupId, from } = groupevent;
    switch (operation) {
      case GROUP_OPERATION_TYPE.CREATE:
      case GROUP_OPERATION_TYPE.DIRECT_JOINED:
      case GROUP_OPERATION_TYPE.ACCEPT_REQUEST:
      case GROUP_OPERATION_TYPE.ACCEPT_INVITE:
      case GROUP_OPERATION_TYPE.MEMBERS_PRESENCE:
        {
          store.dispatch('fetchJoinedGroupListFromServer', {
            startPageNum: 0,
            reset: true,
          });
          refreshGroupDetailFromServer(groupId);
        }
        break;
      //入群通知
      case GROUP_OPERATION_TYPE.MEMBER_PRESENCE:
        {
          const params = {
            groupId,
            type: 'groupMemberCount',
            params: groupevent.memberCount,
          };
          store.commit('UPDATE_CACHE_GROUP_INFO', params);
          store.commit('UPDATE_GROUP_MEMBERS', {
            groupId,
            type: GROUP_OPERATION_TYPE.MEMBER_PRESENCE,
            member: from,
          });
          refreshGroupDetailFromServer(groupId);
        }
        break;
      //群成员退群通知
      case GROUP_OPERATION_TYPE.MEMBER_ABSENCE:
      case GROUP_OPERATION_TYPE.MEMBERS_ABSENCE:
        {
          //退群通知
          const params = {
            groupId,
            type: 'groupMemberCount',
            params: groupevent.memberCount,
          };
          store.commit('UPDATE_CACHE_GROUP_INFO', params);
          store.commit('UPDATE_GROUP_MEMBERS', {
            groupId,
            type: GROUP_OPERATION_TYPE.MEMBER_ABSENCE,
            member: from,
          });
          refreshGroupDetailFromServer(groupId);
        }
        break;
      //群组公告更新
      case GROUP_OPERATION_TYPE.UPDATE_ANNOUNCEMENT:
      case GROUP_OPERATION_TYPE.DELETE_ANNOUNCEMENT:
        {
          store.dispatch('fetchAnnounmentFromServer', groupId);
        }
        break;
      case GROUP_OPERATION_TYPE.UPLOAD_FILE:
      case GROUP_OPERATION_TYPE.DELETE_FILE:
        {
          store.dispatch('fetchGroupSharedFilesFromServer', { groupId });
        }
        break;
      //群组管理员设置
      case GROUP_OPERATION_TYPE.SET_ADMIN:
        {
          store.commit('UPDATE_GORUPS_ADMIN', {
            type: GROUP_OPERATION_TYPE.SET_ADMIN,
            groupId,
            userId: from,
          });
        }
        break;
      //群组管理员取消
      case GROUP_OPERATION_TYPE.REMOVE_ADMIN:
        {
          store.commit('UPDATE_GORUPS_ADMIN', {
            type: GROUP_OPERATION_TYPE.REMOVE_ADMIN,
            groupId,
            userId: from,
          });
          refreshGroupDetailFromServer(groupId);
        }
        break;
      //群组成员禁言
      case GROUP_OPERATION_TYPE.MUTE_MEMBER:
        {
          store.dispatch('fetchGroupsMuteListFromServer', groupId);
        }
        break;
      //群组成员解除禁言
      case GROUP_OPERATION_TYPE.UNMUTE_MEMBER:
        {
          store.dispatch('fetchGroupsMuteListFromServer', groupId);
        }
        break;
      case GROUP_OPERATION_TYPE.MUTE_ALL_MEMBERS:
      case GROUP_OPERATION_TYPE.UNMUTE_ALL_MEMBERS:
      case GROUP_OPERATION_TYPE.ADD_USER_TO_ALLOWLIST:
      case GROUP_OPERATION_TYPE.REMOVE_ALLOWLIST_MEMBER:
      case GROUP_OPERATION_TYPE.UNBLOCK_MEMBER:
      case GROUP_OPERATION_TYPE.CHANGE_OWNER:
      case GROUP_OPERATION_TYPE.UPDATE_INFO:
        {
          refreshGroupDetailFromServer(groupId);
        }
        break;
      //被移出群组
      case GROUP_OPERATION_TYPE.REMOVE_MEMBER:
        {
          //从群组列表中删除某群
          store.commit('DELETE_JOINED_GROUP_LIST', {
            groupId: groupId,
          });
        }
        break;
      //群组解散
      case GROUP_OPERATION_TYPE.DESTROY:
        {
          //从群组列表中删除某群
          store.commit('DELETE_JOINED_GROUP_LIST', {
            groupId: groupId,
          });
        }
        break;
      //群成员更新了群组内成员属性
      case GROUP_OPERATION_TYPE.MEMBER_ATTRIBUTES_UPDATE:
        {
          store.commit('UsersProfile/UPDATE_USER_PROFILE', {
            userId: from,
            sourceType: 'group',
            groupId: groupId,
            profile: { nickName: groupevent?.attributes?.nickName },
          });
        }
        break;
      default:
        break;
    }
  };
  const mountGroupEventListener = () => {
    EMClient.addEventHandler(
      'groupEvent',
      wrapImEventHandler({
        onGroupEvent: (groupevent) => {
          console.log('[IM Group Event] received', describeGroupEvent(groupevent));
          submitInformData(INFORM_FROM.GROUP, groupevent);
          onDispatchGroupEvent(groupevent);
        },
      }),
    );
  };
  return {
    mountGroupEventListener,
  };
};

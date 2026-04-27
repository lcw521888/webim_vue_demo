export const DEFAULT_GROUP_MEMBERS_PAGE_SIZE = 50;

export function normalizeFetchedGroupMembers(members = []) {
  return members.map((item) => {
    const normalized = {
      userId: item.userId,
      role: item.role,
      joinedTime: item.joinedTime,
    };

    if (item.role === 'owner') {
      normalized.owner = item.userId;
    } else {
      normalized.member = item.userId;
    }

    return normalized;
  });
}

export function buildCreateGroupVNextPayload(form = {}) {
  const maxMemberCount = Number(form.maxusers);

  return {
    groupName: form.groupname?.trim(),
    description: form.desc?.trim() || '',
    members: Array.isArray(form.members) ? form.members : [],
    isPublic: Boolean(form.public),
    needApprovalToJoin: Boolean(form.approval),
    allowMemberToInvite: Boolean(form.allowinvites),
    inviteNeedConfirm: Boolean(form.inviteNeedConfirm),
    maxMemberCount:
      Number.isFinite(maxMemberCount) && maxMemberCount > 0
        ? maxMemberCount
        : 200,
  };
}

export function getNextJoinedGroupsPage(joinedGroup = {}) {
  const pageNum = Number(joinedGroup?.pagingParams?.pageNum || 0);
  return pageNum > 0 ? pageNum : 0;
}

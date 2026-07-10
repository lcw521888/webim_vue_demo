/* 好友列表按照拼音排序 */
import _ from 'lodash';
import { pinyin } from 'pinyin-pro';
import { normalizeContactInitial } from './contactInitial';
export default function (friendItemData) {
  const resultObj = {};
  const containerObj = {};
  for (const key in friendItemData) {
    if (Object.hasOwnProperty.call(friendItemData, key)) {
      const v = friendItemData[key];
      const displayName = v.nickname || v.hxId;
      const pinyinKey = normalizeContactInitial(
        displayName,
        pinyin(displayName, { pattern: 'initial' }),
      );
      if (containerObj[pinyinKey]) {
        containerObj[pinyinKey].push(v);
      } else {
        containerObj[pinyinKey] = [];
        containerObj[pinyinKey].push(v);
      }
    }
  }
  const resultObjKeys = _.sortBy(_.keys(containerObj));

  resultObjKeys.forEach((a) => {
    resultObj[a] = containerObj[a];
  });
  return resultObj;
}

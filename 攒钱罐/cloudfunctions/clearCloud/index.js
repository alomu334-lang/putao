// cloudfunctions/clearCloud/index.js
// 用户行使"删除权"：彻底删除本人在云端的提醒配置与全部预算快照。
// 仅按调用者自身 openid 操作，绝不触碰其他用户数据。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function redact(o) { return (o && o.length > 4) ? o.slice(0, 4) + '****' : '****'; }

exports.main = async () => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, err: 'NO_OPENID' };

  // 删除提醒配置
  await db.collection('reminder_profile').doc(openid).remove().catch(() => {});

  // 删除全部历史快照（按 _openid 查，分页循环删除，避免一次删除上限）
  let removed = 0;
  for (let page = 0; page < 50; page++) {
    const batch = await db.collection('daily_snapshot')
      .where({ _openid: openid })
      .limit(100)
      .get();
    if (!batch.data || batch.data.length === 0) break;
    for (let i = 0; i < batch.data.length; i++) {
      await db.collection('daily_snapshot').doc(batch.data[i]._id).remove().catch(() => {});
      removed++;
    }
    if (batch.data.length < 100) break;
  }

  console.log('[clearCloud] openid=%s snapshotsRemoved=%d', redact(openid), removed);
  return { ok: true, removed: removed };
};

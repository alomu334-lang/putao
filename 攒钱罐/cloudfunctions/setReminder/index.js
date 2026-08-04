// cloudfunctions/setReminder/index.js
// 设置/关闭"每日预算提醒"。服务端强制校验，绝不信任客户端传入的 openid。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ---- 服务端防火墙（与小程序端同源逻辑，但不依赖客户端） ----
const ALLOWED = ['pushHour', 'enabled', 'tz', 'wipe'];
function clampInt(v, min, max, def) { v = parseInt(v, 10); if (isNaN(v)) return def; return Math.max(min, Math.min(max, v)); }
function rejectUnknown(input) {
  Object.keys(input || {}).forEach(k => { if (ALLOWED.indexOf(k) < 0) throw new Error('FORBIDDEN_FIELD:' + k); });
}
function todayStr() { const d = new Date(); const p = n => (n < 10 ? '0' + n : '' + n); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, err: 'NO_OPENID' }; // 没有 openid 直接拒绝
  try { rejectUnknown(event); } catch (e) { return { ok: false, err: e.message }; }

  const enabled = event.enabled === true;
  // 用户要求删除云端数据（合规：撤回同意 / 删除权）
  if (event.wipe === true || enabled === false) {
    await db.collection('daily_snapshot').doc(openid + '_' + todayStr()).remove().catch(() => {});
    if (event.wipe === true) {
      await db.collection('reminder_profile').doc(openid).remove().catch(() => {});
      console.log('[setReminder] wipe openid=%s', openid.slice(0, 4) + '****');
      return { ok: true, wiped: true };
    }
    await db.collection('reminder_profile').doc(openid).set({
      data: { _openid: openid, pushHour: clampInt(event.pushHour, 0, 23, 21), enabled: false, tz: clampInt(event.tz, -12, 14, 8), updatedAt: Date.now() }
    });
    console.log('[setReminder] disabled openid=%s', openid.slice(0, 4) + '****');
    return { ok: true, enabled: false };
  }

  const profile = {
    _openid: openid,
    pushHour: clampInt(event.pushHour, 0, 23, 21),
    enabled: true,
    tz: clampInt(event.tz, -12, 14, 8),
    updatedAt: Date.now()
  };
  await db.collection('reminder_profile').doc(openid).set({ data: profile });
  console.log('[setReminder] enabled openid=%s hour=%d', openid.slice(0, 4) + '****', profile.pushHour);
  return { ok: true, enabled: true, pushHour: profile.pushHour };
};

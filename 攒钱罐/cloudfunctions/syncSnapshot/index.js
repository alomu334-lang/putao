// cloudfunctions/syncSnapshot/index.js
// 把"今日聚合预算快照"(仅 remaining / strictRemaining) 写入云端。
// 重要：绝不接收任何单笔消费、商户、备注等明细 —— 防火墙白名单只放行 3 个数值字段。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ---- 服务端防火墙 ----
const ALLOWED = ['date', 'remaining', 'strictRemaining'];
function clampNum(v, min, max, def) { v = Number(v); if (!isFinite(v)) return def; return Math.max(min, Math.min(max, v)); }
function rejectUnknown(input) {
  Object.keys(input || {}).forEach(k => { if (ALLOWED.indexOf(k) < 0) throw new Error('FORBIDDEN_FIELD:' + k); });
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, err: 'NO_OPENID' };

  let payload;
  try {
    rejectUnknown(event);
    const date = String(event.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('BAD_DATE');
    payload = {
      date: date,
      remaining: clampNum(event.remaining, 0, 100000000, 0),
      strictRemaining: clampNum(event.strictRemaining, 0, 100000000, 0)
    };
  } catch (e) {
    return { ok: false, err: e.message };
  }

  try {
    await db.collection('daily_snapshot').doc(openid + '_' + payload.date).set({
      data: {
        _openid: openid,
        date: payload.date,
        remaining: payload.remaining,
        strictRemaining: payload.strictRemaining,
        updatedAt: Date.now()
      }
    });
  } catch (e) {
    return { ok: false, err: 'DB_FAIL' };
  }
  // 日志脱敏：不打印 openid 明文
  console.log('[syncSnapshot] openid=%s date=%s remaining=%s',
    openid.slice(0, 4) + '****', payload.date, payload.remaining);
  return { ok: true };
};

// cloudfunctions/subscribeReminder/index.js
// 定时触发器：每小时运行一次，向"当前小时应推送"的用户发送预算提醒。
// 只推送聚合数字（今日剩余可用），绝不触碰任何单笔消费 / 支付信息。
//
// ⚠️ 部署前必做：
//   1) 在 mp.weixin.qq.com「订阅消息」申请"预算提醒"类模板，把模板 ID 填到下方 TEMPLATE_ID
//   2) 模板字段需与下方 data 的 key 对应（thing1/amount2/date3 仅为示例，以你申请的模板为准）
//   3) 本函数由 config.json 的 timer 触发器按小时调用
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const TEMPLATE_ID = 'REPLACE_WITH_YOUR_TEMPLATE_ID';

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function redact(o) { return (o && o.length > 4) ? o.slice(0, 4) + '****' : '****'; }

exports.main = async () => {
  const now = new Date();
  const hour = now.getHours(); // 依赖云函数运行环境时区（默认东八区）
  const dateStr = todayStr();

  let profiles;
  try {
    const res = await db.collection('reminder_profile')
      .where({ enabled: true, pushHour: hour })
      .limit(100)
      .get();
    profiles = res.data || [];
  } catch (e) {
    console.log('[subscribeReminder] query fail: %s', e.message);
    return { ok: false, err: 'QUERY_FAIL' };
  }

  let sent = 0, failed = 0;
  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const uid = p._openid || p._id;
    // 只取今日聚合快照（remaining），不查任何明细
    let remaining = 0;
    try {
      const snap = await db.collection('daily_snapshot').doc(uid + '_' + dateStr).get();
      remaining = snap.data ? snap.data.remaining : 0;
    } catch (e) { remaining = 0; }

    try {
      await cloud.openapi.subscribeMessage.send({
        touser: uid,
        templateId: TEMPLATE_ID,
        // 仅聚合数字 + 固定文案，不含任何 PII / 支付信息
        data: {
          thing1: { value: '今日预算提醒' },
          amount2: { value: '¥' + Number(remaining).toFixed(2) },
          date3: { value: dateStr }
        }
      });
      sent++;
    } catch (e) {
      failed++;
      console.log('[subscribeReminder] send fail openid=%s err=%s', redact(uid), e.message);
    }
  }
  console.log('[subscribeReminder] hour=%d sent=%d failed=%d', hour, sent, failed);
  return { ok: true, hour: hour, sent: sent, failed: failed };
};

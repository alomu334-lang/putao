// utils/security.js
// ============================================================================
// 攒钱罐 · 隐私防火墙（小程序端）
// 设计原则（隐私最小化 + 纵深防御）：
//   1) 白名单 schema —— 只接受明确声明的字段，其余一律拒绝（防未知字段注入）
//   2) 数值范围钳制 —— 金额/小时只能是合理区间，超出一律收敛
//   3) 文本清洗 —— 去除控制字符、超长截断（本 App 云端不存任何自由文本）
//   4) 绝不接受客户端传入的 openid —— openid 只能由云端从 wxContext 取
//   5) redact() —— 任何日志都不得打印 openid / 标识，只打前 4 位 + ****
// 注意：本 App 不接入微信支付、不读取任何交易流水，云端只接收"聚合预算数字"。
// ============================================================================

// 允许发往云端的字段（严格白名单）
const ALLOWED_REMINDER = ['pushHour', 'enabled', 'tz', 'wipe'];
const ALLOWED_SNAPSHOT = ['date', 'remaining', 'strictRemaining'];

function clampInt(v, min, max, def) {
  v = parseInt(v, 10);
  if (isNaN(v)) return def;
  return Math.max(min, Math.min(max, v));
}
function clampNum(v, min, max, def) {
  v = Number(v);
  if (!isFinite(v)) return def;
  return Math.max(min, Math.min(max, v));
}

// 去除控制字符（含换行/回车/Tab/DEL 等），仅保留可见字符，超长截断
function sanitizeStr(s, maxLen) {
  if (typeof s !== 'string') return '';
  return String(s).replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen || 64);
}

// 防火墙核心：拒绝任何不在白名单里的字段
function rejectUnknown(input, allowed) {
  const keys = Object.keys(input || {});
  for (let i = 0; i < keys.length; i++) {
    if (allowed.indexOf(keys[i]) < 0) {
      throw new Error('FORBIDDEN_FIELD:' + keys[i]);
    }
  }
  return true;
}

function validateReminder(input) {
  input = input || {};
  rejectUnknown(input, ALLOWED_REMINDER);
  return {
    pushHour: clampInt(input.pushHour, 0, 23, 21),
    enabled: input.enabled === true,
    tz: clampInt(input.tz, -12, 14, 8),
    wipe: input.wipe === true
  };
}

function validateSnapshot(input) {
  input = input || {};
  rejectUnknown(input, ALLOWED_SNAPSHOT);
  const date = sanitizeStr(String(input.date || ''), 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('BAD_DATE');
  }
  return {
    date: date,
    remaining: clampNum(input.remaining, 0, 100000000, 0),
    strictRemaining: clampNum(input.strictRemaining, 0, 100000000, 0)
  };
}

// 日志脱敏：openid 只保留前 4 位
function redactOpenid(o) {
  if (!o || typeof o !== 'string') return '****';
  return o.length > 4 ? o.slice(0, 4) + '****' : '****';
}

module.exports = {
  ALLOWED_REMINDER: ALLOWED_REMINDER,
  ALLOWED_SNAPSHOT: ALLOWED_SNAPSHOT,
  clampInt: clampInt,
  clampNum: clampNum,
  sanitizeStr: sanitizeStr,
  rejectUnknown: rejectUnknown,
  validateReminder: validateReminder,
  validateSnapshot: validateSnapshot,
  redactOpenid: redactOpenid
};

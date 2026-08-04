// 通用工具函数
function pad(n) { return n < 10 ? '0' + n : '' + n; }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(d) {
  d = d || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 昨天的日期字符串
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return fmtDate(d);
}

// 两个日期相差天数
function diffDays(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}

// 金额格式化：¥1,234.50
function yuan(n, withSymbol) {
  n = Number(n) || 0;
  const s = n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (withSymbol === false ? '' : '¥') + s;
}

// 简单唯一 id
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 52 周存钱法计划：第 i 周存 i*unit
function plan52(unit) {
  unit = unit || 10;
  const arr = [];
  for (let i = 1; i <= 52; i++) arr.push(i * unit);
  return arr;
}

// 365 天存钱法计划：1..365 随机打乱
function plan365() {
  const arr = [];
  for (let i = 1; i <= 365; i++) arr.push(i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = { pad, today, fmtDate, fmtTime, yesterday, diffDays, yuan, uid, plan52, plan365 };

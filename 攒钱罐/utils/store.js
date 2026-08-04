// 攒钱罐 - 本地数据存储与全部业务逻辑（已含重点管控/鼓励/愿望）
const { today, yesterday, uid, plan52, plan365 } = require('./util.js');

const KEY = 'zqg_state_v3';

function defaultState() {
  return {
    dailyBudget: 0, budgetDate: '', carryOverEnabled: true, savingsAuto: true, carryBase: 0,
    savings: 0, penaltyPool: 0, penaltyRate: 0.2,
    strictLimit: 50,                 // 重点类目(奶茶/炸鸡/游戏)每日总限额
    categories: [
      { key: 'food', name: '餐饮', icon: '🍜' },
      { key: 'milktea', name: '奶茶', icon: '🧋', strict: true },
      { key: 'fried', name: '炸鸡', icon: '🍗', strict: true },
      { key: 'game', name: '游戏', icon: '🎮', strict: true },
      { key: 'shopping', name: '购物', icon: '🛍️' },
      { key: 'transport', name: '交通', icon: '🚌' },
      { key: 'fun', name: '娱乐', icon: '🎡' },
      { key: 'life', name: '生活', icon: '🏠' },
      { key: 'study', name: '学习', icon: '📚' },
      { key: 'other', name: '其他', icon: '📦' }
    ],
    records: [],
    goals: [],
    wishes: [],
    penalties: [],
    streak: 0, lastCheckin: '',
    lastEncourage: null,   // {date, saved} 次日打开时鼓励
    encourageShown: ''
  };
}

const PRAISE = [
  '今天又省下一笔，自律的你最帅！💪', '钱是攒出来的，你今天又赢了昨天的自己 🎉',
  '少花一块，多存一块，离愿望更近一步 🌟', '克制是一种超能力，你刚刚用了一遍 ✨',
  '今天的你，比昨天更有钱了 💰', '没乱花就是赚到，继续保持这股劲 🔥'
];

function getState() {
  const s = wx.getStorageSync(KEY);
  if (!s || typeof s !== 'object') return defaultState();
  return Object.assign(defaultState(), s);
}
function save(s) {
  wx.setStorageSync(KEY, s);
  // 安全钩子：数据变更后，若已开启云开发，由 App 把"聚合预算数字"推到云端。
  // 这里只触发钩子，不包含任何具体字段 —— 绝不会把单笔消费/备注发出去。
  try {
    var g = typeof getApp === 'function' ? getApp() : null;
    if (g && typeof g.syncSnapshot === 'function') g.syncSnapshot();
  } catch (e) { /* 静默 */ }
}
function isStrict(s, catKey) { const c = s.categories.find(x => x.key === catKey); return !!(c && c.strict); }
function sumExpenseOn(s, date) { return s.records.filter(r => r.type === 'expense' && r.date === date).reduce((a, r) => a + r.amount, 0); }
function todayStrictUsed(s) { const t = today(); return s.records.filter(r => r.type === 'expense' && r.date === t && isStrict(s, r.catKey)).reduce((a, r) => a + r.amount, 0); }

/* 跨天结转 + 记录昨日结余用于鼓励 */
function rollover() {
  const s = getState();
  const t = today();
  if (s.budgetDate && s.budgetDate !== t) {
    const yExp = sumExpenseOn(s, s.budgetDate);
    const yLeft = Math.max(0, (s.dailyBudget + s.carryBase) - yExp);
    if (s.savingsAuto) s.savings += yLeft;
    if (yLeft > 0) s.lastEncourage = { date: s.budgetDate, saved: yLeft };
    s.carryBase = s.carryOverEnabled ? yLeft : 0;
    s.dailyBudget = 0; s.budgetDate = '';
    save(s);
  } else if (!s.budgetDate) { s.carryBase = 0; }
  checkUnlocks();
  return s;
}

function setDailyBudget(amount) {
  const s = getState();
  s.dailyBudget = Math.max(0, Number(amount) || 0); s.budgetDate = today(); save(s); return s;
}
function todayBudget() { const s = getState(); return s.budgetDate === today() ? s.dailyBudget + s.carryBase : 0; }
function todayUsed() { return sumExpenseOn(getState(), today()); }
function todayLeft() { return Math.max(0, todayBudget() - todayUsed()); }

/* 记一笔 + 超支拦截/罚金 + 重点类目管控 */
function tryExpense(catKey, amount, note) {
  amount = Math.round((Number(amount) || 0) * 100) / 100;
  if (amount <= 0) return { ok: false, msg: '金额必须大于 0' };
  const s = getState();
  const left = todayLeft();
  if (amount > left) {
    const overflow = Math.round((amount - left) * 100) / 100;
    const penalty = Math.max(1, Math.round(overflow * s.penaltyRate * 100) / 100);
    return { ok: false, blocked: true, overflow, penalty, total: amount };
  }
  if (isStrict(s, catKey)) {
    const newStrict = todayStrictUsed(s) + amount;
    if (newStrict > s.strictLimit) {
      const sover = Math.round((newStrict - s.strictLimit) * 100) / 100;
      const spen = Math.max(1, Math.round(sover * s.penaltyRate * 100) / 100);
      return { ok: false, blocked: true, strict: true, overflow: sover, penalty: spen, total: amount, strictLimit: s.strictLimit, strictUsed: todayStrictUsed(s) };
    }
  }
  s.records.unshift({ id: uid(), date: today(), type: 'expense', catKey, amount, note: note || '', ts: Date.now(), strict: isStrict(s, catKey) });
  save(s);
  return { ok: true, left: todayLeft() };
}

function payPenalty(overflow, penalty) {
  const s = getState();
  s.penalties.unshift({ id: uid(), date: today(), overflow, penalty, ts: Date.now() });
  s.penaltyPool += penalty; s.savings += penalty;
  save(s); checkUnlocks();
  return s;
}
function addIncome(amount, note) {
  const s = getState();
  s.records.unshift({ id: uid(), date: today(), type: 'income', catKey: 'income', amount: Math.max(0, Number(amount) || 0), note: note || '收入', ts: Date.now() });
  save(s); return s;
}
function deleteRecord(id) { const s = getState(); s.records = s.records.filter(r => r.id !== id); save(s); return s; }

/* 目标 */
function createGoal(opt) {
  const s = getState();
  const g = { id: uid(), name: opt.name || '存钱目标', method: opt.method || 'custom', unit: opt.unit || 10, target: 0, saved: 0, deadline: opt.deadline || '', plan: [], done: [], createdAt: Date.now() };
  if (g.method === '52week') { g.plan = plan52(g.unit); g.target = g.plan.reduce((a, b) => a + b, 0); }
  else if (g.method === '365day') { g.plan = plan365(); g.target = g.plan.reduce((a, b) => a + b, 0); }
  else g.target = Math.max(0, Number(opt.target) || 0);
  s.goals.unshift(g); save(s); return g;
}
function contributeGoal(id, amount) {
  const s = getState(); const g = s.goals.find(x => x.id === id); if (!g) return null;
  g.saved += Math.max(0, Number(amount) || 0); s.savings += Math.max(0, Number(amount) || 0);
  save(s); checkUnlocks(); return g;
}
function markPlanDone(id, idx, checked) {
  const s = getState(); const g = s.goals.find(x => x.id === id); if (!g) return null;
  if (!g.done) g.done = [];
  if (checked) { if (g.done.indexOf(idx) < 0) { g.done.push(idx); g.saved += g.plan[idx]; s.savings += g.plan[idx]; } }
  else { const i = g.done.indexOf(idx); if (i >= 0) { g.done.splice(i, 1); g.saved -= g.plan[idx]; s.savings -= g.plan[idx]; } }
  save(s); checkUnlocks(); return g;
}
function deleteGoal(id) { const s = getState(); s.goals = s.goals.filter(g => g.id !== id); save(s); return s; }

/* 愿望清单 */
function createWish(name, cost, icon) {
  const s = getState();
  const w = { id: uid(), name, cost: Math.max(0, Number(cost) || 0), icon: icon || '🎁', unlocked: false, ts: Date.now() };
  s.wishes.unshift(w); save(s);
  const newly = checkUnlocks();
  const freshW = newly.length ? newly[0] : (getState().wishes.find(x => x.id === w.id) || w);
  return { wish: freshW, unlocked: newly };
}
function deleteWish(id) { const s = getState(); s.wishes = s.wishes.filter(w => w.id !== id); save(s); return s; }
function checkUnlocks() {
  const s = getState(); const newly = [];
  s.wishes.forEach(w => { if (!w.unlocked && w.cost > 0 && s.savings >= w.cost) { w.unlocked = true; w.unlockedAt = Date.now(); newly.push(w); (s._unlocked = s._unlocked || []).push(w.id); } });
  if (newly.length) save(s);
  return newly;
}
function takeUnlocked() {
  const s = getState();
  const ids = s._unlocked || [];
  s._unlocked = []; save(s);
  return ids;
}

/* 打卡 */
function checkin() {
  const s = getState(); const t = today();
  if (s.lastCheckin === t) return s;
  if (s.lastCheckin === yesterday()) s.streak += 1; else s.streak = 1;
  s.lastCheckin = t; save(s); return s;
}

/* 设置 */
function updateSettings(patch) { const s = getState(); Object.assign(s, patch); save(s); return s; }
function setStrictLimit(v) { const s = getState(); s.strictLimit = Math.max(0, Number(v) || 0); save(s); return s; }

/* 统计 */
function stats() {
  const s = getState(); const ym = today().slice(0, 7);
  const monthExp = s.records.filter(r => r.type === 'expense' && r.date.slice(0, 7) === ym);
  const monthTotal = monthExp.reduce((a, r) => a + r.amount, 0);
  const byCat = {}; monthExp.forEach(r => { byCat[r.catKey] = (byCat[r.catKey] || 0) + r.amount; });
  const catList = Object.keys(byCat).map(k => { const c = s.categories.find(x => x.key === k); return { key: k, name: c ? c.name : '其他', icon: c ? c.icon : '📦', amount: byCat[k] }; }).sort((a, b) => b.amount - a.amount);
  const trend = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; trend.push({ date: ds.slice(5), amount: sumExpenseOn(s, ds) }); }
  return { monthTotal, catList, trend, savings: s.savings, penaltyPool: s.penaltyPool, totalExpense: s.records.filter(r => r.type === 'expense').reduce((a, r) => a + r.amount, 0) };
}

/* 鼓励语 */
function praise() { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; }
function consumeEncourage() {
  const s = getState();
  if (s.lastEncourage && s.lastEncourage.date !== s.encourageShown && s.lastEncourage.saved > 0) {
    s.encourageShown = s.lastEncourage.date; save(s);
    return { saved: s.lastEncourage.saved, text: praise() };
  }
  return null;
}

/* 云备份（小程序可接微信云开发；此处提供 JSON 导入导出） */
function exportJSON() {
  const s = getState();
  return JSON.stringify({ __zqg: true, v: 1, data: s });
}
function importJSON(txt) {
  try { const o = JSON.parse(txt); if (o && o.__zqg && o.data) { save(o.data); return true; } } catch (e) {}
  return false;
}
function resetAll() { wx.removeStorageSync(KEY); return defaultState(); }

module.exports = {
  getState, save, rollover,
  setDailyBudget, todayBudget, todayUsed, todayLeft, todayStrictUsed, isStrict,
  tryExpense, payPenalty, addIncome, deleteRecord,
  createGoal, contributeGoal, markPlanDone, deleteGoal,
  createWish, deleteWish, checkUnlocks, takeUnlocked,
  checkin, updateSettings, setStrictLimit,
  stats, praise, consumeEncourage,
  exportJSON, importJSON, resetAll, defaultState
};

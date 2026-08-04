const store = require('../../utils/store.js');
const { yuan } = require('../../utils/util.js');

Page({
  data: {
    goals: [],
    wishes: [],
    showAdd: false,
    showWish: false,
    form: { name: '', method: '52week', unit: '10', target: '', deadline: '' },
    wform: { name: '', cost: '', icon: '🎁' },
    methods: [
      { key: '52week', name: '52周存钱法', desc: '每周递增，一年攒一笔' },
      { key: '365day', name: '365天存钱法', desc: '每天 1~365，积少成多' },
      { key: 'custom', name: '自定义目标', desc: '自己定目标和期限' }
    ]
  },

  onShow() { this.load(); this.checkUnlock(); },

  load() {
    const s = store.getState();
    const goals = s.goals.map(g => {
      const planView = (g.plan || []).map((amt, idx) => ({ idx, amount: amt, done: (g.done || []).includes(idx) }));
      return {
        id: g.id, name: g.name, method: g.method,
        savedText: yuan(g.saved), targetText: yuan(g.target),
        percent: g.target > 0 ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0,
        doneCount: (g.done || []).length, planCount: (g.plan || []).length, planView,
        deadline: g.deadline || '无期限'
      };
    });
    const wishes = s.wishes.map(w => {
      const pct = w.cost > 0 ? Math.min(100, Math.round(s.savings / w.cost * 100)) : 100;
      return { id: w.id, name: w.name, icon: w.unlocked ? '🎉' : w.icon, cost: yuan(w.cost),
        unlocked: w.unlocked, need: yuan(Math.max(0, w.cost - s.savings)), percent: pct };
    });
    this.setData({ goals, wishes });
  },

  // 检查是否有愿望刚解锁，弹窗庆祝
  checkUnlock() {
    const ids = store.takeUnlocked();
    if (ids.length) {
      const s = store.getState();
      const w = s.wishes.find(x => x.id === ids[0]);
      if (w) {
        wx.showModal({
          title: '🎉 愿望解锁：' + w.name,
          content: '存钱罐已攒够 ' + yuan(w.cost) + '，奖励到手！继续冲 🚀',
          showCancel: false
        });
      }
    }
  },

  openAdd() { this.setData({ showAdd: true }); },
  closeAdd() { this.setData({ showAdd: false }); },
  openWish() { this.setData({ showWish: true }); },
  closeWish() { this.setData({ showWish: false }); },

  pickMethod(e) { this.setData({ 'form.method': e.currentTarget.dataset.m }); },
  onName(e) { this.setData({ 'form.name': e.detail.value }); },
  onUnit(e) { this.setData({ 'form.unit': e.detail.value }); },
  onTarget(e) { this.setData({ 'form.target': e.detail.value }); },
  onDate(e) { this.setData({ 'form.deadline': e.detail.value }); },
  onWName(e) { this.setData({ 'wform.name': e.detail.value }); },
  onWCost(e) { this.setData({ 'wform.cost': e.detail.value }); },
  onWIcon(e) { this.setData({ 'wform.icon': e.detail.value }); },

  submitAdd() {
    const f = this.data.form;
    const opt = { name: f.name, method: f.method, unit: Number(f.unit) || 10, deadline: f.deadline };
    if (f.method === 'custom') opt.target = Number(f.target) || 0;
    store.createGoal(opt);
    this.setData({ showAdd: false, form: { name: '', method: '52week', unit: '10', target: '', deadline: '' } });
    this.load();
    wx.showToast({ title: '目标已创建', icon: 'success' });
  },

  submitWish() {
    const wf = this.data.wform;
    if (!wf.name) { wx.showToast({ title: '请输入愿望名', icon: 'none' }); return; }
    const r = store.createWish(wf.name, Number(wf.cost) || 0, wf.icon || '🎁');
    this.setData({ showWish: false, wform: { name: '', cost: '', icon: '🎁' } });
    this.load();
    if (r.unlocked.length || (r.wish.cost > 0 && store.getState().savings >= r.wish.cost)) {
      wx.showModal({ title: '🎉 愿望解锁：' + r.wish.name, content: '存钱罐已攒够 ' + yuan(r.wish.cost) + '，奖励到手！', showCancel: false });
    } else {
      wx.showToast({ title: '愿望已添加', icon: 'success' });
    }
  },

  contribute(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '存入存钱罐', editable: true, placeholderText: '输入存入金额',
      success: (res) => {
        if (res.confirm) {
          const amt = Number(res.content);
          if (amt > 0) { store.contributeGoal(id, amt); this.load(); this.checkUnlock(); wx.showToast({ title: '已存入', icon: 'success' }); }
        }
      }
    });
  },

  togglePlan(e) {
    const { id, idx, done } = e.currentTarget.dataset;
    store.markPlanDone(id, Number(idx), !done);
    this.load(); this.checkUnlock();
  },

  del(e) {
    wx.showActionSheet({
      itemList: ['删除该目标'],
      success: (res) => { if (res.tapIndex === 0) { store.deleteGoal(e.currentTarget.dataset.id); this.load(); } }
    });
  },
  delWish(e) {
    wx.showActionSheet({
      itemList: ['删除该愿望'],
      success: (res) => { if (res.tapIndex === 0) { store.deleteWish(e.currentTarget.dataset.id); this.load(); } }
    });
  }
});

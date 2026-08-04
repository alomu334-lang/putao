const store = require('../../utils/store.js');
const { yuan, today } = require('../../utils/util.js');

Page({
  data: {
    categories: [],
    selected: '',
    amount: '',
    note: '',
    budgetSet: false,
    left: 0,
    budget: 0,
    showBlock: false,
    blockInfo: null
  },

  onShow() {
    store.rollover();
    const s = store.getState();
    const set = s.budgetDate === today();
    this.setData({
      categories: s.categories,
      selected: this.data.selected || (s.categories[0] && s.categories[0].key),
      budgetSet: set,
      left: store.todayLeft(),
      budget: store.todayBudget()
    });
  },

  selectCat(e) {
    this.setData({ selected: e.currentTarget.dataset.key });
  },
  onAmount(e) { this.setData({ amount: e.detail.value }); },
  onNote(e) { this.setData({ note: e.detail.value }); },

  goBudget() {
    wx.navigateTo({ url: '/pages/budget/budget' });
  },

  confirm() {
    const amt = Number(this.data.amount);
    if (!amt || amt <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' });
      return;
    }
    const res = store.tryExpense(this.data.selected, amt, this.data.note);
    if (res.ok) {
      wx.showToast({ title: '已记录，今日还可使用 ' + yuan(res.left), icon: 'none' });
      this.setData({ amount: '', note: '' });
      // 重新计算剩余
      const s = store.getState();
      this.setData({ left: store.todayLeft(), budget: store.todayBudget() });
    } else if (res.blocked) {
      this.setData({ showBlock: true, blockInfo: res });
    } else {
      wx.showToast({ title: res.msg || '出错了', icon: 'none' });
    }
  },

  // 认罚缴纳罚金（支付被拦截）
  payPenalty() {
    const info = this.data.blockInfo;
    store.payPenalty(info.overflow, info.penalty);
    this.setData({ showBlock: false, amount: '', note: '', left: store.todayLeft() });
    wx.showToast({ title: '罚金 ' + yuan(info.penalty) + ' 已进存钱罐', icon: 'none' });
  },

  // 改为只花光今日剩余
  spendLeft() {
    const left = store.todayLeft();
    const res = store.tryExpense(this.data.selected, left, this.data.note);
    this.setData({ showBlock: false });
    if (res.ok) {
      wx.showToast({ title: '已花光今日剩余', icon: 'success' });
      this.setData({ amount: '', note: '', left: store.todayLeft() });
    }
  },

  cancelBlock() {
    this.setData({ showBlock: false });
  }
});

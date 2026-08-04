const store = require('../../utils/store.js');
const { yuan, today } = require('../../utils/util.js');

Page({
  data: {
    amount: '',
    presets: [50, 100, 200, 300, 500, 1000],
    current: 0,
    carryBase: 0,
    carryOverEnabled: true,
    savingsAuto: true
  },

  onShow() {
    const s = store.getState();
    this.setData({
      current: store.todayBudget(),
      carryBase: s.carryBase,
      carryOverEnabled: s.carryOverEnabled,
      savingsAuto: s.savingsAuto,
      amount: s.budgetDate === today() ? String(s.dailyBudget) : ''
    });
  },

  onInput(e) {
    this.setData({ amount: e.detail.value });
  },
  tapPreset(e) {
    const v = Number(e.currentTarget.dataset.v);
    const cur = Number(this.data.amount) || 0;
    this.setData({ amount: String(cur + v) });
  },
  clear() {
    this.setData({ amount: '' });
  },

  toggleCarry(e) {
    const v = e.detail.value;
    store.updateSettings({ carryOverEnabled: v });
    this.setData({ carryOverEnabled: v });
  },
  toggleSave(e) {
    const v = e.detail.value;
    store.updateSettings({ savingsAuto: v });
    this.setData({ savingsAuto: v });
  },

  confirm() {
    const amt = Number(this.data.amount);
    if (!amt || amt <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' });
      return;
    }
    store.setDailyBudget(amt);
    wx.showToast({ title: '今日可用金额已设置', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  }
});

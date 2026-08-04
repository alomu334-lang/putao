const store = require('../../utils/store.js');
const { yuan, today } = require('../../utils/util.js');

Page({
  data: {
    budgetSet: false, budget: 0, used: 0, left: 0, percent: 0, barClass: '',
    streak: 0, checkedIn: false, todayList: [], goals: [], savings: 0,
    strictUsed: 0, strictLimit: 50, strictPct: 0, strictOver: false,
    wishTotal: 0, wishUnlocked: 0
  },

  onShow() {
    store.rollover();
    this.refresh();
    const enc = store.consumeEncourage();
    if (enc) {
      wx.showModal({
        title: '昨天你省下了 ' + yuan(enc.saved),
        content: enc.text + '\n这笔钱已经进了存钱罐 🐷',
        showCancel: false
      });
    }
  },

  refresh() {
    const s = store.getState();
    const budget = store.todayBudget();
    const used = store.todayUsed();
    const left = store.todayLeft();
    const percent = budget > 0 ? Math.min(100, Math.round(used / budget * 100)) : 0;
    let barClass = '';
    if (percent >= 90) barClass = 'danger';
    else if (percent >= 70) barClass = 'warn';

    const strictUsed = store.todayStrictUsed(s);
    const strictPct = s.strictLimit > 0 ? Math.min(100, Math.round(strictUsed / s.strictLimit * 100)) : 0;

    const todayList = store.todayRecords().map(r => {
      const c = s.categories.find(x => x.key === r.catKey);
      return Object.assign({}, r, {
        catName: c ? c.name : '其他', catIcon: c ? c.icon : '📦',
        amountText: (r.type === 'income' ? '+' : '-') + yuan(r.amount)
      });
    });

    const goals = s.goals.map(g => ({
      id: g.id, name: g.name, saved: yuan(g.saved), target: yuan(g.target),
      percent: g.target > 0 ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0
    })).slice(0, 3);

    this.setData({
      budgetSet: s.budgetDate === today(), budget, used, left, percent, barClass,
      streak: s.streak, checkedIn: s.lastCheckin === today(), todayList, goals,
      savings: s.savings, strictUsed, strictLimit: s.strictLimit, strictPct,
      strictOver: strictUsed > s.strictLimit,
      wishTotal: s.wishes.length, wishUnlocked: s.wishes.filter(w => w.unlocked).length
    });
  },

  goBudget() { wx.navigateTo({ url: '/pages/budget/budget' }); },
  goExpense() { wx.navigateTo({ url: '/pages/expense/expense' }); },
  goGoal() { wx.switchTab({ url: '/pages/goal/goal' }); },
  goRecords() { wx.switchTab({ url: '/pages/records/records' }); },

  doCheckin() { store.checkin(); this.refresh(); wx.showToast({ title: '打卡成功 🔥', icon: 'success' }); },

  summary() {
    const left = store.todayLeft();
    if (store.todayBudget() <= 0) { wx.showToast({ title: '先设置今日额度', icon: 'none' }); return; }
    if (left > 0) {
      wx.showModal({ title: '今天省下了 ' + yuan(left), content: store.praise() + '\n这笔钱已经进了存钱罐 🐷', showCancel: false });
    } else {
      wx.showToast({ title: '今天额度刚好用完', icon: 'none' });
    }
  }
});

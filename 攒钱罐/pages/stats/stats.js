const store = require('../../utils/store.js');
const { yuan } = require('../../utils/util.js');

Page({
  data: {
    monthTotal: '¥0.00',
    savings: '¥0.00',
    penaltyPool: '¥0.00',
    totalExpense: '¥0.00',
    catList: [],
    trend: [],
    maxTrend: 1
  },

  onShow() { this.load(); },

  load() {
    const st = store.stats();
    const maxTrend = Math.max(1, ...st.trend.map(t => t.amount));
    const catList = st.catList.map(c => ({
      ...c,
      amountText: yuan(c.amount),
      percent: st.monthTotal > 0 ? Math.round(c.amount / st.monthTotal * 100) : 0
    }));
    this.setData({
      monthTotal: yuan(st.monthTotal),
      savings: yuan(st.savings),
      penaltyPool: yuan(st.penaltyPool),
      totalExpense: yuan(st.totalExpense),
      catList,
      trend: st.trend.map(t => ({ date: t.date, amount: t.amount, h: Math.round(t.amount / maxTrend * 100) })),
      maxTrend
    });
  }
});

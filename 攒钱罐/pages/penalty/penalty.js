const store = require('../../utils/store.js');
const { yuan, fmtTime } = require('../../utils/util.js');

Page({
  data: {
    list: [],
    total: '¥0.00',
    count: 0
  },

  onShow() {
    const s = store.getState();
    const list = s.penalties
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .map(p => ({
        id: p.id,
        date: p.date,
        time: fmtTime(p.ts),
        overflowText: yuan(p.overflow),
        penaltyText: yuan(p.penalty)
      }));
    const total = s.penalties.reduce((a, p) => a + p.penalty, 0);
    this.setData({ list, total: yuan(total), count: list.length });
  }
});

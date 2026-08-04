const store = require('../../utils/store.js');
const { yuan, fmtTime } = require('../../utils/util.js');

Page({
  data: {
    filter: 'all', // all | expense | income
    groups: [],
    total: 0,
    totalText: '¥0.00'
  },

  onShow() { this.load(); },

  load() {
    const s = store.getState();
    let recs = s.records.slice();
    if (this.data.filter === 'expense') recs = recs.filter(r => r.type === 'expense');
    if (this.data.filter === 'income') recs = recs.filter(r => r.type === 'income');

    const map = {};
    recs.forEach(r => {
      const c = s.categories.find(x => x.key === r.catKey);
      const item = {
        id: r.id, type: r.type, catName: c ? c.name : '其他',
        catIcon: c ? c.icon : '📦', note: r.note,
        amountText: (r.type === 'income' ? '+' : '-') + yuan(r.amount),
        time: fmtTime(r.ts)
      };
      (map[r.date] = map[r.date] || []).push(item);
    });

    const groups = Object.keys(map).sort((a, b) => b.localeCompare(a)).map(date => {
      const sum = map[date].reduce((a, r) => a + (r.type === 'expense' ? r.amount : 0), 0);
      return { date, sum: yuan(sum), items: map[date] };
    });

    const total = recs.reduce((a, r) => a + (r.type === 'expense' ? r.amount : 0), 0);
    this.setData({ groups, total, totalText: yuan(total) });
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.f });
    this.load();
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: ['删除这条记录'],
      success: (res) => {
        if (res.tapIndex === 0) {
          store.deleteRecord(id);
          this.load();
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  }
});

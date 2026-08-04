const store = require('../../utils/store.js');
const { yuan } = require('../../utils/util.js');
const cfg = require('../../utils/config.js');

Page({
  data: {
    penaltyRate: 0.2, penaltyRateText: '20%',
    carryOverEnabled: true, savingsAuto: true,
    strictLimit: 50, strictText: '¥50',
    penaltyPool: '¥0.00', savings: '¥0.00', penaltyCount: 0,
    cloudReady: false,
    reminderEnabled: false,
    reminderText: '未开启'
  },

  onShow() {
    this.load();
    const app = typeof getApp === 'function' ? getApp() : null;
    const cloudReady = !!(app && app.globalData && app.globalData.cloudReady);
    const reminderEnabled = wx.getStorageSync('zqg_reminder_enabled') === true;
    this.setData({ cloudReady: cloudReady, reminderEnabled: reminderEnabled, reminderText: reminderEnabled ? '每天 21:00 推送' : '未开启' });
  },

  load() {
    const s = store.getState();
    this.setData({
      penaltyRate: s.penaltyRate, penaltyRateText: Math.round(s.penaltyRate * 100) + '%',
      carryOverEnabled: s.carryOverEnabled, savingsAuto: s.savingsAuto,
      strictLimit: s.strictLimit, strictText: yuan(s.strictLimit),
      penaltyPool: yuan(s.penaltyPool), savings: yuan(s.savings), penaltyCount: s.penalties.length
    });
  },

  setRate() {
    wx.showActionSheet({
      itemList: ['10%', '20%', '30%', '50%'],
      success: (res) => {
        const rates = [0.1, 0.2, 0.3, 0.5];
        const r = rates[res.tapIndex];
        store.updateSettings({ penaltyRate: r });
        this.setData({ penaltyRate: r, penaltyRateText: Math.round(r * 100) + '%' });
      }
    });
  },
  setStrict() {
    wx.showModal({
      title: '重点类目每日限额', editable: true, placeholderText: '奶茶/炸鸡/游戏合计上限',
      content: String(this.data.strictLimit),
      success: (res) => {
        if (res.confirm) {
          const v = Number(res.content);
          if (v >= 0) { store.setStrictLimit(v); this.load(); }
        }
      }
    });
  },
  toggleCarry(e) { store.updateSettings({ carryOverEnabled: e.detail.value }); this.setData({ carryOverEnabled: e.detail.value }); },
  toggleSave(e) { store.updateSettings({ savingsAuto: e.detail.value }); this.setData({ savingsAuto: e.detail.value }); },

  goPenalty() { wx.navigateTo({ url: '/pages/penalty/penalty' }); },

  exportData() {
    const txt = store.exportJSON();
    wx.setClipboardData({ data: txt, success: () => wx.showToast({ title: '备份已复制到剪贴板', icon: 'success' }) });
  },
  importData() {
    wx.getClipboardData({
      success: (res) => {
        if (store.importJSON(res.data)) { this.load(); wx.showToast({ title: '导入成功', icon: 'success' }); }
        else wx.showToast({ title: '剪贴板内容无效', icon: 'none' });
      }
    });
  },
  cloudSync() {
    wx.showModal({
      title: '云同步', content: '云同步为微信小程序专属能力：接入「微信云开发」可实现多设备同步与账单云备份；并可在「我的→订阅消息」开启「预算超支/每日剩余额度」定时推送。网页版请用上面的导出/导入做备份。',
      showCancel: false
    });
  },

  // 开启"每日预算提醒"：必须先取得用户对订阅消息的显式授权（合规 + 平台强制）
  enableReminder() {
    if (!cfg.cloudConfigured()) {
      wx.showModal({ title: '未开启云开发', content: '请先在微信开发者工具中开通云开发、在 utils/config.js 填入 CLOUD_ENV 与订阅消息模板 ID 后使用。未配置时数据仅保存在本机，绝对不外传。', showCancel: false });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [cfg.SUBSCRIBE_TEMPLATE_ID],
      success: (res) => {
        if (res[cfg.SUBSCRIBE_TEMPLATE_ID] === 'accept') {
          wx.cloud.callFunction({ name: 'setReminder', data: { enabled: true, pushHour: 21 } })
            .then(() => {
              wx.setStorageSync('zqg_reminder_enabled', true);
              this.setData({ reminderEnabled: true, reminderText: '每天 21:00 推送' });
              wx.showToast({ title: '已开启每日提醒', icon: 'success' });
            })
            .catch(() => wx.showToast({ title: '设置失败，请重试', icon: 'none' }));
        } else {
          wx.showToast({ title: '未授权，无法推送', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '授权失败', icon: 'none' })
    });
  },

  // 开关切换：开 → 走授权流程；关 → 服务端停用推送
  toggleReminder(e) {
    if (e.detail.value) {
      this.enableReminder();
    } else {
      wx.cloud.callFunction({ name: 'setReminder', data: { enabled: false } })
        .then(() => {
          wx.setStorageSync('zqg_reminder_enabled', false);
          this.setData({ reminderEnabled: false, reminderText: '未开启' });
        })
        .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }));
    }
  },

  // 删除权：清空本人在云端的全部提醒数据与预算快照
  clearCloudData() {
    wx.showModal({
      title: '清除云端数据', content: '将删除你在云端的提醒配置与全部预算快照（仅聚合数字），且不可恢复。本地数据不受影响。', confirmColor: '#fa5151',
      success: (res) => {
        if (!res.confirm) return;
        wx.cloud.callFunction({ name: 'clearCloud', data: {} })
          .then(() => {
            wx.setStorageSync('zqg_reminder_enabled', false);
            this.setData({ reminderEnabled: false, reminderText: '未开启' });
            wx.showToast({ title: '云端数据已清除', icon: 'success' });
          })
          .catch(() => wx.showToast({ title: '清除失败', icon: 'none' }));
      }
    });
  },

  reset() {
    wx.showModal({
      title: '清空所有数据', content: '将删除全部账单、目标与设置，且不可恢复！', confirmColor: '#fa5151',
      success: (res) => { if (res.confirm) { store.resetAll(); this.load(); wx.showToast({ title: '已清空', icon: 'success' }); } }
    });
  },

  about() {
    wx.showModal({
      title: '关于攒钱罐',
      content: '管住每日钱包：每天设可用金额，花超了自动拦截并罚金存钱。新增重点类目管控(奶茶/炸鸡/游戏)、每日省钱鼓励、愿望解锁动画。网页版数据存本机；小程序版可接微信云开发多端同步与超支订阅消息。',
      showCancel: false
    });
  }
});

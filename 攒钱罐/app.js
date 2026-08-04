// 攒钱罐 - 全局逻辑
const store = require('./utils/store.js');
const cfg = require('./utils/config.js');

App({
  globalData: {
    appName: '攒钱罐',
    cloudReady: false,
    env: cfg.CLOUD_ENV
  },

  onLaunch() {
    // 启动时处理跨天结转（昨日结余 / 罚金 等）
    store.rollover();

    // 云开发为【可选能力】：未配置环境时静默跳过，App 仍以"纯本地模式"运行
    if (cfg.cloudConfigured()) {
      try {
        // traceUser:false —— 不采集/上报用户信息用于追踪
        wx.cloud.init({ env: cfg.CLOUD_ENV, traceUser: false });
        this.globalData.cloudReady = true;
      } catch (e) {
        this.globalData.cloudReady = false;
      }
    }
  },

  onShow() {
    store.rollover();
  },

  // 由 store.save() 在每次数据变更后调用（若存在）。
  // 只把"今日聚合预算数字"推到云端，绝不包含任何单笔消费 / 商户 / 备注。
  syncSnapshot() {
    if (!this.globalData.cloudReady) return; // 未开云开发则完全不联网
    try {
      const s = store.getState();
      const remaining = store.todayLeft();
      const strictRemaining = Math.max(0, s.strictLimit - store.todayStrictUsed(s));
      wx.cloud.callFunction({
        name: 'syncSnapshot',
        data: { date: store.today(), remaining: remaining, strictRemaining: strictRemaining }
      }).catch(() => {}); // 推送失败不影响本地使用
    } catch (e) { /* 静默：云端异常绝不能影响本地记账 */ }
  }
});

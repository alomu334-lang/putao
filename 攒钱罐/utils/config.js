// utils/config.js
// 集中放置需要你自行替换的"环境相关"配置。其余安全逻辑不依赖这些值。
module.exports = {
  // 在 mp.weixin.qq.com「订阅消息」中申请「预算提醒」类模板，把模板 ID 填到这里
  SUBSCRIBE_TEMPLATE_ID: 'REPLACE_WITH_YOUR_TEMPLATE_ID',

  // 微信云开发环境 ID（在云开发控制台获取）。留空 / 含 REPLACE 时，App 自动降级为"纯本地模式"
  CLOUD_ENV: 'REPLACE_WITH_YOUR_CLOUD_ENV'
};

// 判断云开发是否已正确配置（未配置则所有云端能力自动关闭，数据只留本机）
function cloudConfigured() {
  const env = module.exports.CLOUD_ENV || '';
  return typeof wx !== 'undefined' && wx.cloud && env.indexOf('REPLACE') < 0 && env.length > 0;
}
module.exports.cloudConfigured = cloudConfigured;

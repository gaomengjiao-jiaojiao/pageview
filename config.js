// 后端代理配置：本地服务读取后用于转发请求到线上接口
module.exports = {
  // 本地静态服务监听端口
  PORT: 3000,
  // dev接口域名（不带末尾斜杠），例如 https://xxx.example.com
  BASE_URL: 'https://aixue-dev.ihuman.pwrdgp.com',
  // 线上接口域名
  //  BASE_URL: 'https://aixue.ihuman.pwrdgp.com',
  // 线上后台登录态 Cookie 字符串（从浏览器 DevTools 复制完整 Cookie 头）
  COOKIE: 'ExpirePage=https://hr.ihuman.pwrdgp.com/psc/ps/; PS_LOGINLIST=https://hr.ihuman.pwrdgp.com/ps; PS_TOKENEXPIRE=23_Jul_2026_03:34:13_GMT; PS_TOKEN=rQAAAAQDAgEBAAAAvAIAAAAAAAAsAAAABABTaGRyAk4Adwg4AC4AMQAwABRfcZ/x8xSkpNvPh31nyWvkOSA8Q20AAAAFAFNkYXRhYXicHYo7DkBQFESPT5RKu/DCI8QGRCmoNKIQIUFpcxZn8m5xzszNvEAY+J4nfz7ukp2Vh4uNm52Tw/VopmMk7oWWiUV1oLRkWCpSuRYthZjTYJRKMZeN/rVW1q34AY2VDl8=; PS_TokenSite=https://hr.ihuman.pwrdgp.com/psc/ps/?hr.ihuman.pwrdgp.com-PORTAL-PSJSESSIONID; PS_DEVICEFEATURES=new:1; SignOnDefault=; PS_LASTSITE=https://hr.ihuman.pwrdgp.com/psc/ps/; iPlanetDirectoryPro=pv9LYtjNAmK-n-JQbXCVMlrzFyKk4vkaWY3m6-cMF4aJQsTPa6X5yP34uuOBiGsz0c3a6c8ab5effcfdc49c5e8340de3e07'
      ,

  // 可选：公司内部 CA 根证书路径（PEM），相对本项目根目录
  // 推荐方案：导出公司 CA 并填这个路径，例如 './certs/wm-ca.pem'
  CA_CERT_PATH: './certs/wm-chain.pem',

  // 可选：开发环境临时跳过 HTTPS 证书校验（不安全，不建议长期开启）
  ALLOW_INSECURE_HTTPS: false,

  // 告知后端按 JSON 处理请求并返回 JSON（避免 protobuf 二进制响应）
  FROM_JSON: 'true',

  // 卡片图片上传到 COS 的对象 key 前缀（会自动补齐末尾 /）
  CARD_COS_KEY_PREFIX: '/incentive/card/',
};


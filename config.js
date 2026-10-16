// 后端代理配置：本地服务读取后用于转发请求到线上接口
module.exports = {
  // 本地静态服务监听端口
  PORT: 3000,
  // 监听地址。给局域网其他人访问时用 0.0.0.0；只给自己本机用可改回 127.0.0.1
  HOST: '0.0.0.0',
  // dev接口域名（不带末尾斜杠），例如 https://xxx.example.com
  BASE_URL: 'https://aixue-dev.ihuman.pwrdgp.com',
  // 线上接口域名
  //  BASE_URL: 'https://aixue.ihuman.pwrdgp.com',
  // 线上后台登录态 Cookie 字符串（从浏览器 DevTools 复制完整 Cookie 头）
  COOKIE: 'iPlanetDirectoryPro=pv9LYtjNAmK-n-JQbXCVMh5fLSrJy2eFxo7LcZCIngaJj1xycgcurNuH0AVz_P3dd68ff99f35ad95f93484763efe5d2d7d; ExpirePage=https://hr.ihuman.pwrdgp.com/psc/ps/; PS_LOGINLIST=https://hr.ihuman.pwrdgp.com/ps; PS_TOKEN=rQAAAAQDAgEBAAAAvAIAAAAAAAAsAAAABABTaGRyAk4Adwg4AC4AMQAwABSITPQFAKhc4TKSjwx/N/hFI7r+u20AAAAFAFNkYXRhYXicHYo7DkBAEIa/RZRKt9iN93IBUQoqjShESFC6nMOZ7Ez+1/zzAoHvKSX6ebiJd1YeLjZudk4Ol8OZjpGoF2qZWCQOFBkJGRWaVJwW1M5bDLmsoZTW0LgvK5cKfo2HDmk=; PS_TokenSite=https://hr.ihuman.pwrdgp.com/psc/ps/?hr.ihuman.pwrdgp.com-PORTAL-PSJSESSIONID; SignOnDefault=; PS_LASTSITE=https://hr.ihuman.pwrdgp.com/psc/ps/; PS_TOKENEXPIRE=8_Oct_2026_01:53:20_GMT'
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

  // 超时空对话 - 人物资源上传到 COS 的对象 key 前缀。
  // 最终 key = 前缀 + yyyy-mm-dd/ + 毫秒时间戳 + 原文件扩展名，
  // 例如 /resource/character/avatar/2026-09-16/1781145608368.png
  TIMECHAT_COS_KEY_PREFIX: {
    avatar: '/resource/character/avatar/',
    res_pack: '/resource/character/res_pack/',
    knowledge: '/resource/character/knowledge/',
  },
};

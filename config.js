// 后端代理配置：本地服务读取后用于转发请求到线上接口
module.exports = {
  // 本地静态服务监听端口
  PORT: 3000,

  // dev接口域名（不带末尾斜杠），例如 https://xxx.example.com
  BASE_URL: 'https://aixue-dev.ihuman.pwrdgp.com',
  // 线上接口域名
  // BASE_URL: 'https://aixue.ihuman.pwrdgp.com',

  // 线上后台登录态 Cookie 字符串（从浏览器 DevTools 复制完整 Cookie 头）
  COOKIE: 'JSESSIONID=3C0671421040E996D46C642EB1CDD2E0; userTag=; ssolng=cn; _ga=GA1.2.1352357858.1779355790; i18next=cn; _gid=GA1.2.32266514.1780985320; wpollre_scred=78673F7E94BFCA793DD73B35B2E9D25FBFBA1EEC; iPlanetDirectoryPro=pv9LYtjNAmK-n-JQbXCVMlrzFyKk4vkaWY3m6-cMF4blInqm6fQJbRwtGKIjdq6_72f80cd2fec8bf8d69084abce51987f9; etoken=cHZUOUxZdGpOQW1LLW4tSlFiRVhDVk1scnpGeUtrNHZrYVdZM202LVljTUY0YmxJbnFtNmZRSmJCUnd0R0tJamRxNl83MmY4SzBjZDJmZWM4YmY4ZDY5MDg0Q2FiY2U1MTk4N2Y5ZTQ5ZA==; ssousername=gaomengjiao',

  // 可选：公司内部 CA 根证书路径（PEM），相对本项目根目录
  // 推荐方案：导出公司 CA 并填这个路径，例如 './certs/wm-ca.pem'
  CA_CERT_PATH: './certs/wm-chain.pem',

  // 可选：开发环境临时跳过 HTTPS 证书校验（不安全，不建议长期开启）
  ALLOW_INSECURE_HTTPS: false,

  // 告知后端按 JSON 处理请求并返回 JSON（避免 protobuf 二进制响应）
  FROM_JSON: 'true',

  // 卡片图片上传到 COS 的对象 key 前缀（会自动补齐末尾 /）
  CARD_COS_KEY_PREFIX: 'incentive/card/',
};


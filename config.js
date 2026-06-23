// 后端代理配置：本地服务读取后用于转发请求到线上接口
module.exports = {
  // 本地静态服务监听端口
  PORT: 3000,

  // dev接口域名（不带末尾斜杠），例如 https://xxx.example.com
  BASE_URL: 'https://aixue-dev.ihuman.pwrdgp.com',
  // 线上接口域名
  //  BASE_URL: 'https://aixue.ihuman.pwrdgp.com',

  // 线上后台登录态 Cookie 字符串（从浏览器 DevTools 复制完整 Cookie 头）
  COOKIE: 'JSESSIONID=50A926D1419AC87E2D9A7CB94E84ACBD; userTag=; ssolng=cn; _ga=GA1.2.1352357858.1779355790; i18next=cn; wpollre_scred=930FC94357A6B847C4EB5B88998D19B2A7F71222; iPlanetDirectoryPro=pv9LYtjNAmK-n-JQbXCVMlrzFyKk4vkaWY3m6-cMF4bHHD8xtPfw8ruP6z73UaeB36d8c0c3883bde88d335ca3c05f53c99; etoken=cHZNOUxZdGpOQW1LLW4tSlFiWFhDVk1scnpGeUtrNHZrYVdZM202LURjTUY0YkhIRDh4dFBmdzhIcnVQNno3M1VhZUIzNmQ4WGMwYzM4ODNiZGU4OGQzMzVjS2EzYzA1ZjUzYzk5ZmQ2YQ==; ssousername=gaomengjiao',

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


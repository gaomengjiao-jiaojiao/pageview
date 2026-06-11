// 轻量级本地服务：
// 1. 托管 public/ 下的静态文件
// 2. 把以 /api/ 开头的请求转发到 config.BASE_URL，并自动带上配置的 Cookie
// 用法：node server.js

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const config = require('./config');

const PUBLIC_DIR = path.join(__dirname, 'public');

// 常见静态文件扩展名 → MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function buildHttpsOptions(targetProtocol) {
  if (targetProtocol !== 'https:') return {};

  const options = {};

  if (config.CA_CERT_PATH) {
    try {
      options.ca = fs.readFileSync(path.resolve(__dirname, config.CA_CERT_PATH));
    } catch (err) {
      console.warn('[警告] 读取 CA 证书失败，继续使用系统默认信任库：' + err.message);
    }
  }

  if (config.ALLOW_INSECURE_HTTPS === true) {
    options.rejectUnauthorized = false;
  }

  return options;
}

function isRedirectStatus(statusCode) {
  return [301, 302, 303, 307, 308].includes(Number(statusCode));
}

function sendAuthExpired(res, message) {
  res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ code: 401, message }));
}

function serveRuntimeConfig(res) {
  const runtimeConfig = {
    CARD_COS_KEY_PREFIX: config.CARD_COS_KEY_PREFIX || 'operation_api/card/',
  };
  res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
  res.end(`window.__APP_CONFIG__ = ${JSON.stringify(runtimeConfig)};`);
}

function requestUpstream(targetUrl, req, body, redirectCount = 0) {
  const target = typeof targetUrl === 'string' ? new URL(targetUrl) : targetUrl;
  const lib = target.protocol === 'https:' ? https : http;
  const tlsOptions = buildHttpsOptions(target.protocol);

  const forwardHeaders = {};
  const allowHeaderKeys = [
    'accept',
    'accept-language',
    'user-agent',
    'x-requested-with',
  ];
  allowHeaderKeys.forEach((k) => {
    if (req.headers[k]) forwardHeaders[k] = req.headers[k];
  });

  const headers = {
    ...forwardHeaders,
    'Content-Type': req.headers['content-type'] || 'application/json',
    'Content-Length': Buffer.byteLength(body),
    Accept: req.headers.accept || '*/*',
    Origin: config.BASE_URL,
    Referer: config.BASE_URL + '/',
  };
  if (config.FROM_JSON) {
    headers.FromJson = String(config.FROM_JSON);
  }
  if (config.COOKIE) {
    headers.Cookie = config.COOKIE;
  }

  return new Promise((resolve, reject) => {
    const proxyReq = lib.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        method: req.method,
        path: target.pathname + target.search,
        headers,
        ...tlsOptions,
      },
      (proxyRes) => {
        const location = proxyRes.headers.location;
        if (location && isRedirectStatus(proxyRes.statusCode)) {
          if (redirectCount >= 5) {
            proxyRes.resume();
            reject(new Error('上游重定向次数过多'));
            return;
          }
          const nextUrl = new URL(location, target);
          proxyRes.resume();
          resolve(requestUpstream(nextUrl, req, body, redirectCount + 1));
          return;
        }
        resolve(proxyRes);
      }
    );

    proxyReq.on('error', reject);
    proxyReq.write(body);
    proxyReq.end();
  });
}

// 把请求体（Buffer 流）完整收集成字符串，便于转发
function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// 把 /api/xxx 的请求代理到线上接口
async function proxyRequest(req, res) {
  // 把前缀 /api 去掉，拼到线上 BASE_URL 后面
  // 例如：/api/operation/api/incentive_card/create_card → BASE_URL + /operation/api/incentive_card/create_card
  const targetPath = req.url.replace(/^\/api/, '');
  const target = new URL(config.BASE_URL + targetPath);

  const body = await collectBody(req);
  try {
    const proxyRes = await requestUpstream(target, req, body);
    const finalPath = (proxyRes.req && proxyRes.req.path) || '';
    if (finalPath.includes('/PWForms') || finalPath.includes('/pwforms')) {
      proxyRes.resume();
      sendAuthExpired(res, '登录态已失效或无权限，请更新 config.js 的 COOKIE 后重试');
      return;
    }
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  } catch (err) {
    console.error('[proxy error]', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: -1, message: '代理请求失败：' + err.message }));
  }
}

// 处理静态文件请求
function serveStatic(req, res) {
  // 默认入口为 index.html
  let pathname = url.parse(req.url).pathname;
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(PUBLIC_DIR, pathname);

  // 防止路径穿越：必须在 PUBLIC_DIR 下
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found: ' + pathname);
      return;
    }
    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/runtime-config.js') {
      serveRuntimeConfig(res);
    } else if (req.url.startsWith('/api/')) {
      await proxyRequest(req, res);
    } else {
      serveStatic(req, res);
    }
  } catch (err) {
    console.error('[server error]', err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server Error: ' + err.message);
  }
});

server.listen(config.PORT, () => {
  console.log(`卡券管理后台已启动：http://localhost:${config.PORT}`);
  console.log(`接口代理 → ${config.BASE_URL}`);
  if (!config.COOKIE) {
    console.warn('[警告] 尚未配置 Cookie，调用线上接口可能会鉴权失败。请编辑 config.js。');
  }
  if (config.BASE_URL.includes('REPLACE_ME')) {
    console.warn('[警告] BASE_URL 还是占位符，请编辑 config.js 填入线上域名。');
  }
  if (config.CA_CERT_PATH) {
    console.log(`[TLS] 使用自定义 CA 证书：${config.CA_CERT_PATH}`);
  }
  if (config.ALLOW_INSECURE_HTTPS === true) {
    console.warn('[TLS 警告] 已关闭 HTTPS 证书校验（仅建议开发环境临时使用）。');
  }
});

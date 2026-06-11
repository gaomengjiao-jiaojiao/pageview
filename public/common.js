// 通用工具函数：HTTP 请求、消息提示、HTML 转义、JSON 校验
// 暴露到全局 window 对象，供 cards.js / goods.js 使用

function isErrorLikeMessage(msg) {
  if (!msg) return false;
  const text = String(msg).trim().toLowerCase();
  if (!text) return false;
  // 兼容后端把业务错误塞进 message，但 code 仍返回 0 的场景
  return /\bbiz\s*error\b|\bfailed\b|失败|错误/.test(text);
}

// 统一 POST JSON 请求；走本地 /api 前缀由 server.js 代理到线上
async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/x-protobuf')) {
    throw new Error('接口返回 protobuf（二进制），当前页面仅支持 JSON 返回，请联系后端开启 JSON 网关');
  }
  const data = await res.json();
  // 后端约定 code === 0 视为成功，否则视为业务错误（兼容字符串枚举 'OK'）
  const code = data.code;
  const ok =
    code === 0 ||
    code === '0' ||
    code === 200 ||
    code === '200' ||
    code === 'OK' ||
    code === undefined ||
    code === null;
  if (!ok || isErrorLikeMessage(data.message)) {
    throw new Error(data.message || `业务错误：code=${code}`);
  }
  return data;
}

// 顶部消息提示
let toastTimer = null;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('hidden');
  }, 2500);
}

// HTML 转义，防 XSS
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// JSON 字符串校验（空字符串视为合法）
function validateJson(str) {
  if (!str || !str.trim()) return true;
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

// 通用：打开/关闭弹窗
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// 卡券枚举文案（卡券列表和卡片选择器都会用）
const CARD_SECOND_TYPE_LABEL = {
  0: '-', 101: '宠物背景', 102: '宠物颜色', 103: '宠物套装', 104: '宠物相框',
};

window.App = { post, toast, esc, validateJson, openModal, closeModal, CARD_SECOND_TYPE_LABEL };

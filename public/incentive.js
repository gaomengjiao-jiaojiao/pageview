// 激励发放模块：发卡片、发金币

const _I = window.App;

const INCENTIVE_API = {
  SEND_CARD: '/api/operation/api/incentive/card/send',
  SEND_GOLD: '/api/operation/api/incentive/gold/send',
};

const CARD_SOURCE_TYPE_LABEL = {
  0: '未知', 1: '宠物商城购买', 2: '激活宠物赠送', 3: '捕获Boss获得', 4: '首次进入获得知知', 100: '手动补发',
};
const GOLD_BUSINESS_TYPE_LABEL = {
  0: '未知',
  1: '宠物任务获得',
  2: '用户注册',
  3: '天梯宝箱',
  4: '核心课程',
  5: '课堂巩固',
  6: '小小讲师',
  7: '个性化练习',
  8: '习题课',
  100: '手动补发',
  200: '直播活动(兼容历史)',
  201: '直播活动-答题',
  202: '直播活动-投票',
  203: '直播活动-签到',
  204: '直播活动-红包',
  205: '直播活动-抢麦',
  206: '直播活动-手动奖励',
  207: '直播活动-在线时长达标奖励',
  208: '回放观看时长达标奖励',
  1000: '宠物商城购买消耗',
};

// ========== 发卡片 ==========

function collectCardForm() {
  const body = {
    user_id: document.getElementById('ic-user-id').value.trim(),
    card_id: document.getElementById('ic-card-id').value.trim(),
    card_source_type: Number(document.getElementById('ic-source-type').value),
  };
  const subId = document.getElementById('ic-source-sub-id').value.trim();
  const sourceId = document.getElementById('ic-source-id').value.trim();
  const desc = document.getElementById('ic-source-desc').value.trim();
  const remark = document.getElementById('ic-remark').value.trim();
  const idemKey = document.getElementById('ic-idempotency-key').value.trim();
  if (subId) body.card_source_sub_id = subId;
  if (sourceId) body.card_source_id = sourceId;
  if (desc) body.card_source_desc = desc;
  if (remark) body.remark = remark;
  if (idemKey) body.idempotency_key = idemKey;
  return body;
}

async function submitSendCard(e) {
  e.preventDefault();
  const body = collectCardForm();
  if (!body.user_id) { _I.toast('请填写用户ID', 'error'); return; }
  if (!body.card_id) { _I.toast('请填写卡片ID', 'error'); return; }

  try {
    const resp = await _I.post(INCENTIVE_API.SEND_CARD, body);
    const data = resp.data || {};
    _I.toast('发卡成功，user_card_id=' + (data.user_card_id || '-'), 'success');
  } catch (err) {
    _I.toast('发卡失败：' + err.message, 'error');
  }
}

// ========== 批量发卡 ==========

let cardBatchCancelled = false;

function collectCardBatchForm() {
  const mode = document.getElementById('icb-batch-mode').value;
  const body = {
    card_source_type: Number(document.getElementById('icb-source-type').value),
  };
  const cardId = document.getElementById('icb-card-id').value.trim();
  const subId = document.getElementById('icb-source-sub-id').value.trim();
  const sourceId = document.getElementById('icb-source-id').value.trim();
  const desc = document.getElementById('icb-source-desc').value.trim();
  const remark = document.getElementById('icb-remark').value.trim();
  if (subId) body.card_source_sub_id = subId;
  if (sourceId) body.card_source_id = sourceId;
  if (desc) body.card_source_desc = desc;
  if (remark) body.remark = remark;
  if (cardId) body.card_id = cardId;

  let items = [];
  if (mode === 'multi-card') {
    const userIds = parseBatchUserIds(document.getElementById('icb-user-ids').value);
    const cardIds = parseBatchUserIds(document.getElementById('icb-card-ids').value);
    items = userIds.flatMap(userId => cardIds.map(card_id => ({ user_id: userId, card_id })));
  } else {
    const userIds = parseBatchUserIds(document.getElementById('icb-user-ids').value);
    items = userIds.map(userId => ({ user_id: userId, card_id: cardId }));
  }
  return { mode, items, body };
}

function renderCardBatchProgress(done, total) {
  const bar = document.getElementById('icb-progress-bar');
  const text = document.getElementById('icb-progress-text');
  bar.max = Math.max(total, 1);
  bar.value = done;
  text.textContent = `${done} / ${total}`;
}

function appendCardBatchRow(idx, userId, cardId, ok, data, errMsg) {
  const tbody = document.querySelector('#icb-result-table tbody');
  const tr = document.createElement('tr');
  const resultCell = ok
    ? `<td class="ok">成功</td>`
    : `<td class="err">失败</td>`;
  const infoCell = ok
    ? `<td>${(data && data.user_card_id) || '-'}</td>`
    : `<td>-</td>`;
  tr.innerHTML = `
    <td>${idx}</td>
    <td>${_I.esc(userId)}</td>
    <td>${_I.esc(cardId)}</td>
    ${resultCell}
    ${infoCell}
    <td>${_I.esc(errMsg || '')}</td>
  `;
  tr.className = ok ? 'row-ok' : 'row-err';
  tbody.appendChild(tr);
}

function showCardBatchSummary(total, success, fail) {
  const el = document.getElementById('icb-summary');
  el.textContent = `共 ${total} 条，成功 ${success}，失败 ${fail}`;
}

function exportCardBatchCsv() {
  const rows = [['序号', '用户ID', '卡片ID', '结果', '用户卡片ID', '错误信息']];
  document.querySelectorAll('#icb-result-table tbody tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    rows.push([
      cells[0]?.textContent || '',
      cells[1]?.textContent || '',
      cells[2]?.textContent || '',
      cells[3]?.textContent || '',
      cells[4]?.textContent || '',
      cells[5]?.textContent || '',
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `batch_card_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// 并发池：最多 concurrency 个请求在飞，失败继续，支持取消
async function runCardBatchPool(items, baseBody, idemPrefix, concurrency, onItem) {
  let cursor = 0;
  let done = 0;
  const total = items.length;
  const workers = [];
  const N = Math.min(concurrency, total);

  async function worker() {
    while (cursor < items.length && !cardBatchCancelled) {
      const idx = cursor++;
      const item = items[idx];
      const userId = item.user_id;
      const cardId = item.card_id;
      const body = { ...baseBody, user_id: userId, card_id: cardId };
      if (idemPrefix) body.idempotency_key = `${idemPrefix}_${userId}_${cardId}`;
      let ok = false, data = null, errMsg = '';
      try {
        const resp = await _I.post(INCENTIVE_API.SEND_CARD, body);
        data = resp.data || {};
        ok = true;
      } catch (err) {
        errMsg = err.message || String(err);
      }
      onItem(idx, userId, cardId, ok, data, errMsg);
      done++;
      renderCardBatchProgress(done, total);
    }
  }

  for (let i = 0; i < N; i++) workers.push(worker());
  await Promise.all(workers);
}

async function submitSendCardBatch(e) {
  e.preventDefault();
  let formData;
  try {
    formData = collectCardBatchForm();
  } catch (err) {
    _I.toast(err.message || '批量输入格式错误', 'error');
    return;
  }
  const { mode, items, body } = formData;
  if (!items.length) {
    _I.toast(mode === 'multi-card' ? '请填写用户ID列表和卡片ID列表' : '请填写用户ID列表', 'error');
    return;
  }
  if (mode !== 'multi-card' && !body.card_id) { _I.toast('请填写卡片ID', 'error'); return; }
  if (items.some(item => !item.user_id || !item.card_id)) {
    _I.toast('存在空的用户ID或卡片ID，请检查输入', 'error');
    return;
  }

  const idemPrefix = document.getElementById('icb-idempotency-key').value.trim();
  const concurrency = Math.max(1, Math.min(20, Number(document.getElementById('icb-concurrency').value) || 5));

  // 重置 UI
  cardBatchCancelled = false;
  document.querySelector('#icb-result-table tbody').innerHTML = '';
  document.getElementById('icb-export').classList.add('hidden');
  document.getElementById('icb-cancel').classList.remove('hidden');
  document.getElementById('icb-summary').textContent = '';
  renderCardBatchProgress(0, items.length);

  let success = 0, fail = 0;
  const startBtn = e.target.querySelector('button[type="submit"]');
  startBtn.disabled = true;

  try {
    await runCardBatchPool(items, body, idemPrefix, concurrency, (idx, userId, cardId, ok, data, errMsg) => {
      appendCardBatchRow(idx + 1, userId, cardId, ok, data, errMsg);
      if (ok) success++; else fail++;
    });
  } finally {
    startBtn.disabled = false;
    document.getElementById('icb-cancel').classList.add('hidden');
    showCardBatchSummary(items.length, success, fail);
    if (fail > 0 || success > 0) document.getElementById('icb-export').classList.remove('hidden');
    if (cardBatchCancelled) _I.toast('已取消', 'info');
    else _I.toast(`完成：成功 ${success}，失败 ${fail}`, success && !fail ? 'success' : 'info');
  }
}

function cancelCardBatch() {
  cardBatchCancelled = true;
}

function toggleCardBatchMode() {
  const mode = document.getElementById('icb-batch-mode').value;
  const userIds = document.getElementById('icb-user-ids');
  const cardIdRow = document.getElementById('icb-card-id-row');
  const cardId = document.getElementById('icb-card-id');
  const cardIdsRow = document.getElementById('icb-card-ids-row');
  const cardIds = document.getElementById('icb-card-ids');
  const sameCard = mode === 'same-card';
  userIds.required = true;
  cardIdRow.classList.toggle('hidden', !sameCard);
  cardId.required = sameCard;
  cardIds.required = !sameCard;
  cardIdsRow.classList.toggle('hidden', sameCard);
}

function initSendCardBatch() {
  document.getElementById('form-send-card-batch').addEventListener('submit', submitSendCardBatch);
  document.getElementById('icb-batch-mode').addEventListener('change', toggleCardBatchMode);
  document.getElementById('icb-cancel').addEventListener('click', cancelCardBatch);
  document.getElementById('icb-export').addEventListener('click', exportCardBatchCsv);
  toggleCardBatchMode();
}

// ========== 发金币 ==========

function collectGoldForm() {
  const body = {
    user_id: document.getElementById('ig-user-id').value.trim(),
    amount: Number(document.getElementById('ig-amount').value),
    business_type: Number(document.getElementById('ig-business-type').value),
  };
  const bizId = document.getElementById('ig-business-id').value.trim();
  const subBizId = document.getElementById('ig-sub-business-id').value.trim();
  const title = document.getElementById('ig-title').value.trim();
  const desc = document.getElementById('ig-description').value.trim();
  const remark = document.getElementById('ig-remark').value.trim();
  const idemKey = document.getElementById('ig-idempotency-key').value.trim();
  if (bizId) body.business_id = bizId;
  if (subBizId) body.sub_business_id = subBizId;
  if (title) body.title = title;
  if (desc) body.description = desc;
  if (remark) body.remark = remark;
  if (idemKey) body.idempotency_key = idemKey;
  return body;
}

async function submitSendGold(e) {
  e.preventDefault();
  const body = collectGoldForm();
  if (!body.user_id) { _I.toast('请填写用户ID', 'error'); return; }
  if (!body.amount) { _I.toast('请填写发放金额', 'error'); return; }

  try {
    const resp = await _I.post(INCENTIVE_API.SEND_GOLD, body);
    const data = resp.data || {};
    _I.toast(`发金币成功，交易ID：${data.transaction_id || '-'}，余额：${data.balance || 0}`, 'success');
    document.getElementById('form-send-gold').reset();
  } catch (err) {
    _I.toast('发金币失败：' + err.message, 'error');
  }
}

// ========== 批量发金币 ==========

// 解析用户ID输入：支持换行/逗号/空格分隔，去空格、去空、去重（保留顺序）
function parseBatchUserIds(raw) {
  const list = String(raw || '')
    .split(/[\s,，;；]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const result = [];
  for (const id of list) {
    if (!seen.has(id)) { seen.add(id); result.push(id); }
  }
  return result;
}

function collectGoldBatchForm() {
  const userIds = parseBatchUserIds(document.getElementById('igb-user-ids').value);
  const body = {
    amount: Number(document.getElementById('igb-amount').value),
    business_type: Number(document.getElementById('igb-business-type').value),
  };
  const bizId = document.getElementById('igb-business-id').value.trim();
  const subBizId = document.getElementById('igb-sub-business-id').value.trim();
  const title = document.getElementById('igb-title').value.trim();
  const desc = document.getElementById('igb-description').value.trim();
  const remark = document.getElementById('igb-remark').value.trim();
  if (bizId) body.business_id = bizId;
  if (subBizId) body.sub_business_id = subBizId;
  if (title) body.title = title;
  if (desc) body.description = desc;
  if (remark) body.remark = remark;
  return { userIds, body };
}

let goldBatchCancelled = false;

function renderGoldBatchProgress(done, total) {
  const bar = document.getElementById('igb-progress-bar');
  const text = document.getElementById('igb-progress-text');
  bar.max = Math.max(total, 1);
  bar.value = done;
  text.textContent = `${done} / ${total}`;
}

function appendGoldBatchRow(idx, userId, ok, data, errMsg) {
  const tbody = document.querySelector('#igb-result-table tbody');
  const tr = document.createElement('tr');
  const resultCell = ok
    ? `<td class="ok">成功</td>`
    : `<td class="err">失败</td>`;
  const infoCell = ok
    ? `<td>交易ID：${(data && data.transaction_id) || '-'}，余额：${(data && data.balance) || 0}</td>`
    : `<td>-</td>`;
  tr.innerHTML = `
    <td>${idx}</td>
    <td>${_I.esc(userId)}</td>
    ${resultCell}
    ${infoCell}
    <td>${_I.esc(errMsg || '')}</td>
  `;
  tr.className = ok ? 'row-ok' : 'row-err';
  tbody.appendChild(tr);
}

function showGoldBatchSummary(total, success, fail) {
  const el = document.getElementById('igb-summary');
  el.textContent = `共 ${total} 人，成功 ${success}，失败 ${fail}`;
}

function exportGoldBatchCsv() {
  const rows = [['序号', '用户ID', '结果', '交易ID', '余额', '错误信息']];
  document.querySelectorAll('#igb-result-table tbody tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    rows.push([
      cells[0]?.textContent || '',
      cells[1]?.textContent || '',
      cells[2]?.textContent || '',
      (cells[3]?.textContent || '').replace(/^交易ID：/, '').replace(/，余额：/, ','),
      '',
      cells[4]?.textContent || '',
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `batch_gold_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// 并发池：最多 concurrency 个请求在飞，失败继续，支持取消
async function runGoldBatchPool(userIds, baseBody, idemPrefix, concurrency, onItem) {
  let cursor = 0;
  let done = 0;
  const total = userIds.length;
  const workers = [];
  const N = Math.min(concurrency, total);

  async function worker() {
    while (cursor < userIds.length && !goldBatchCancelled) {
      const idx = cursor++;
      const userId = userIds[idx];
      const body = { ...baseBody, user_id: userId };
      if (idemPrefix) body.idempotency_key = `${idemPrefix}_${userId}`;
      let ok = false, data = null, errMsg = '';
      try {
        const resp = await _I.post(INCENTIVE_API.SEND_GOLD, body);
        data = resp.data || {};
        ok = true;
      } catch (err) {
        errMsg = err.message || String(err);
      }
      onItem(idx, userId, ok, data, errMsg);
      done++;
      renderGoldBatchProgress(done, total);
    }
  }

  for (let i = 0; i < N; i++) workers.push(worker());
  await Promise.all(workers);
}

async function submitSendGoldBatch(e) {
  e.preventDefault();
  const { userIds, body } = collectGoldBatchForm();
  if (!userIds.length) { _I.toast('请填写用户ID列表', 'error'); return; }
  if (!body.amount) { _I.toast('请填写发放金额', 'error'); return; }

  const idemPrefix = document.getElementById('igb-idempotency-key').value.trim();
  const concurrency = Math.max(1, Math.min(20, Number(document.getElementById('igb-concurrency').value) || 5));

  // 重置 UI
  goldBatchCancelled = false;
  document.querySelector('#igb-result-table tbody').innerHTML = '';
  document.getElementById('igb-export').classList.add('hidden');
  document.getElementById('igb-cancel').classList.remove('hidden');
  document.getElementById('igb-summary').textContent = '';
  renderGoldBatchProgress(0, userIds.length);

  let success = 0, fail = 0;
  const startBtn = e.target.querySelector('button[type="submit"]');
  startBtn.disabled = true;

  try {
    await runGoldBatchPool(userIds, body, idemPrefix, concurrency, (idx, userId, ok, data, errMsg) => {
      appendGoldBatchRow(idx + 1, userId, ok, data, errMsg);
      if (ok) success++; else fail++;
    });
  } finally {
    startBtn.disabled = false;
    document.getElementById('igb-cancel').classList.add('hidden');
    showGoldBatchSummary(userIds.length, success, fail);
    if (fail > 0 || success > 0) document.getElementById('igb-export').classList.remove('hidden');
    if (goldBatchCancelled) _I.toast('已取消', 'info');
    else _I.toast(`完成：成功 ${success}，失败 ${fail}`, success && !fail ? 'success' : 'info');
  }
}

function cancelGoldBatch() {
  goldBatchCancelled = true;
}

function initSendGoldBatch() {
  document.getElementById('form-send-gold-batch').addEventListener('submit', submitSendGoldBatch);
  document.getElementById('igb-cancel').addEventListener('click', cancelGoldBatch);
  document.getElementById('igb-export').addEventListener('click', exportGoldBatchCsv);
}

// ========== 模块初始化 ==========

function initSendCard() {
  document.getElementById('form-send-card').addEventListener('submit', submitSendCard);
}

function initSendGold() {
  document.getElementById('form-send-gold').addEventListener('submit', submitSendGold);
}

window.SendCard = { initSendCard };
window.SendCardBatch = { initSendCardBatch };
window.SendGold = { initSendGold };
window.SendGoldBatch = { initSendGoldBatch };

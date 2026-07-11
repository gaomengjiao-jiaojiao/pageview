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

// ========== 模块初始化 ==========

function initSendCard() {
  document.getElementById('form-send-card').addEventListener('submit', submitSendCard);
}

function initSendGold() {
  document.getElementById('form-send-gold').addEventListener('submit', submitSendGold);
}

window.SendCard = { initSendCard };
window.SendGold = { initSendGold };

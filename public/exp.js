// 发经验模块：发放宠物经验值

const _E = window.App;

const EXP_API = {
  GRANT: '/api/operation/api/pet/exp/grant',
};

const EXP_SOURCE_TYPE_LABEL = {
  0: '未知',
  1: '宠物任务',
  4: '核心课程',
  5: '课堂巩固',
  6: '小小讲师',
  7: '个性化练习',
  8: '习题课',
  100: '手动补发',
};

// ========== 发经验 ==========

function collectExpForm() {
  const petIdStr = document.getElementById('ie-pet-id').value.trim();
  const body = {
    user_id: document.getElementById('ie-user-id').value.trim(),
    exp_num: Number(document.getElementById('ie-exp-num').value),
    source_type: Number(document.getElementById('ie-source-type').value),
  };
  if (petIdStr) body.pet_id = petIdStr;

  const sourceId = document.getElementById('ie-source-id').value.trim();
  const sourceSubId = document.getElementById('ie-source-sub-id').value.trim();
  const sourceDesc = document.getElementById('ie-source-desc').value.trim();
  const remark = document.getElementById('ie-remark').value.trim();
  if (sourceId) body.source_id = sourceId;
  if (sourceSubId) body.source_sub_id = sourceSubId;
  if (sourceDesc) body.source_desc = sourceDesc;
  if (remark) body.remark = remark;
  return body;
}

async function submitSendExp(e) {
  e.preventDefault();
  const body = collectExpForm();
  if (!body.user_id) {
    _E.toast('请填写用户ID', 'error');
    return;
  }
  if (!body.exp_num || body.exp_num <= 0) {
    _E.toast('请填写有效的经验值数量', 'error');
    return;
  }

  try {
    const resp = await _E.post(EXP_API.GRANT, body);
    const data = resp.data || {};
    _E.toast('发放经验成功', 'success');

    document.getElementById('res-added-exp').textContent = data.added_exp || body.exp_num;
    document.getElementById('res-after-exp').textContent = data.after_exp || '-';
    document.getElementById('exp-result').classList.remove('hidden');

    document.getElementById('form-send-exp').reset();
  } catch (err) {
    _E.toast('发放经验失败：' + err.message, 'error');
    document.getElementById('exp-result').classList.add('hidden');
  }
}

// ========== 模块初始化 ==========

function initSendExp() {
  document.getElementById('form-send-exp').addEventListener('submit', submitSendExp);
}

window.SendExp = { initSendExp };

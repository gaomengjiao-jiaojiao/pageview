// 优惠券后台模块：优惠券配置、优惠券发放、用户券查询
// 对应接口：优惠券后台接口文档.md
// 注意：优惠券接口分页为 page/page_size（页码从 1 开始），与卡券模块的 offset/limit 不同

const _C = window.App;

const COUPON_API = {
  CREATE: '/api/operation/api/coupon/create_coupon',
  UPDATE: '/api/operation/api/coupon/update_coupon',
  DETAIL: '/api/operation/api/coupon/get_coupon_detail',
  LIST: '/api/operation/api/coupon/list_coupons',
  OPTIONS: '/api/operation/api/coupon/list_coupon_options',
  UPDATE_STATUS: '/api/operation/api/coupon/update_coupon_status',
  GRANT: '/api/operation/api/coupon/grant_coupon',
  LIST_BATCHES: '/api/operation/api/coupon/list_grant_batches',
  BATCH_DETAIL: '/api/operation/api/coupon/get_grant_batch_detail',
  DISABLE_BATCH: '/api/operation/api/coupon/disable_grant_batch',
  LIST_USER_COUPONS: '/api/operation/api/coupon/list_user_coupons',
};

// 枚举文案（与文档枚举对齐）
const COUPON_TYPE_LABEL = { 0: '-', 1: '立减券', 2: '满减券', 3: '折扣券' };
const OVERALL_STATUS_LABEL = { 0: '-', 1: '未上线', 2: '上线', 3: '下线' };
const GRANT_TYPE_LABEL = { 0: '-', 1: '运营手动', 2: '系统自动' };
const EXECUTE_STATUS_LABEL = { 0: '-', 1: '待执行', 2: '执行中', 3: '完成', 4: '部分失败', 5: '结果未知' };
const USE_STATUS_LABEL = { 0: '-', 1: '启用', 2: '停用' };
const GRANT_RECORD_STATUS_LABEL = { 0: '-', 1: '待处理', 2: '成功', 3: '失败', 4: '跳过' };
const USER_COUPON_STATUS_LABEL = { 0: '-', 1: '可用', 2: '锁定', 3: '已使用', 4: '已过期', 5: '作废' };

// ========== 工具函数 ==========

// 秒级时间戳 → 'YYYY-MM-DD HH:mm:ss'
function fmtTime(ts) {
  if (!ts || Number(ts) <= 0) return '-';
  const d = new Date(Number(ts) * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 秒级时间戳 → datetime-local 输入框的 value
function tsToLocalInput(ts) {
  if (!ts || Number(ts) <= 0) return '';
  const d = new Date(Number(ts) * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// datetime-local 的 value → 秒级时间戳
function localInputToTs(val) {
  if (!val) return 0;
  return Math.floor(new Date(val).getTime() / 1000);
}

// 元 → 分
function yuanToFen(v) {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

// 分 → '¥x.xx'
function fenToYuanText(v) {
  const n = Number(v) || 0;
  return `¥${(n / 100).toFixed(2)}`;
}

// textarea 文本 → 去空去重的 ID 列表
function parseIdList(str) {
  return String(str || '')
    .split(/[\s,，;；]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function fmtNum(v) {
  return (v === undefined || v === null) ? '-' : v;
}

// page 从 1 开始的分页信息渲染
function renderPager(state, infoId, prevId, nextId) {
  const totalPage = Math.max(1, Math.ceil(state.total / state.pageSize));
  document.getElementById(infoId).textContent =
    `第 ${state.page} 页 / 共 ${totalPage} 页 / 共 ${state.total} 条`;
  document.getElementById(prevId).disabled = state.page <= 1;
  document.getElementById(nextId).disabled = state.page >= totalPage;
}

// 各状态标签
function overallStatusTag(status) {
  if (status === 2) return '<span class="tag tag-on">上线</span>';
  if (status === 3) return '<span class="tag tag-off">下线</span>';
  if (status === 1) return '<span class="tag tag-warn">未上线</span>';
  return '-';
}

function executeStatusTag(s) {
  if (!EXECUTE_STATUS_LABEL[s] || Number(s) === 0) return '-';
  const cls = Number(s) === 3 ? 'tag-on' : (Number(s) === 4 ? 'tag-off' : (Number(s) === 2 ? 'tag-info' : 'tag-warn'));
  return `<span class="tag ${cls}">${EXECUTE_STATUS_LABEL[s]}</span>`;
}

function useStatusTag(s) {
  if (Number(s) === 1) return '<span class="tag tag-on">启用</span>';
  if (Number(s) === 2) return '<span class="tag tag-off">停用</span>';
  return '-';
}

function userCouponStatusTag(s) {
  if (!USER_COUPON_STATUS_LABEL[s] || Number(s) === 0) return '-';
  const cls = Number(s) === 1 ? 'tag-on' : (Number(s) === 5 ? 'tag-off' : (Number(s) === 2 ? 'tag-info' : 'tag-warn'));
  return `<span class="tag ${cls}">${USER_COUPON_STATUS_LABEL[s]}</span>`;
}

function grantRecordStatusTag(s) {
  if (!GRANT_RECORD_STATUS_LABEL[s] || Number(s) === 0) return '-';
  const cls = Number(s) === 2 ? 'tag-on' : (Number(s) === 3 ? 'tag-off' : (Number(s) === 4 ? 'tag-warn' : 'tag-info'));
  return `<span class="tag ${cls}">${GRANT_RECORD_STATUS_LABEL[s]}</span>`;
}

// 有效期展示文案
function couponValidText(c) {
  if (Number(c.valid_type) === 1) {
    return `${fmtTime(c.valid_start_at)} ~ ${fmtTime(c.valid_end_at)}`;
  }
  if (Number(c.valid_type) === 2) {
    const p = c.valid_payload || {};
    return `发放后 ${p.valid_days || 0} 天 ${p.valid_hours || 0} 小时`;
  }
  return '-';
}

// 发放范围展示文案
function grantScopeText(rule) {
  if (!rule) return '-';
  const parts = [];
  if (rule.spu_ids && rule.spu_ids.length) parts.push(`SPU: ${rule.spu_ids.join('、')}`);
  if (rule.user_ids && rule.user_ids.length) parts.push(`用户: ${rule.user_ids.join('、')}`);
  if (rule.phones && rule.phones.length) parts.push(`手机号: ${rule.phones.join('、')}`);
  return parts.join('\n') || '-';
}

// 详情键值行渲染
function renderDetailRows(elId, rows) {
  document.getElementById(elId).innerHTML = rows.map(([k, v]) =>
    `<div class="detail-row"><span>${_C.esc(k)}</span><strong>${_C.esc(v)}</strong></div>`
  ).join('');
}

// ============================================================
// 模块一：优惠券管理
// ============================================================

const couponState = {
  page: 1,
  pageSize: 20,
  total: 0,
  filter: { coupon_name: '', coupon_type: 0, overall_status: 0, coupon_id: '', coupon_no: '' },
};

async function loadCouponList() {
  const f = couponState.filter;
  const body = { page: couponState.page, page_size: couponState.pageSize };
  if (f.coupon_name) body.coupon_name = f.coupon_name;
  if (Number(f.coupon_type) > 0) body.coupon_type = Number(f.coupon_type);
  if (Number(f.overall_status) > 0) body.overall_status = Number(f.overall_status);
  if (f.coupon_id) body.coupon_id = f.coupon_id;
  if (f.coupon_no) body.coupon_no = f.coupon_no;
  try {
    const resp = await _C.post(COUPON_API.LIST, body);
    const list = ((resp.data && resp.data.list) || []).map(item => item.coupon).filter(Boolean);
    couponState.total = (resp.data && resp.data.total_count) || 0;
    renderCouponList(list);
    renderPager(couponState, 'cp-page-info', 'btn-cp-prev', 'btn-cp-next');
  } catch (err) {
    _C.toast('加载失败：' + err.message, 'error');
    renderCouponList([]);
  }
}

function renderCouponList(list) {
  const tbody = document.getElementById('cp-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty">暂无数据</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(c => {
    const rule = c.discount_rule || {};
    // 上线中的券显示「下线」，未上线/下线的券显示「上线」
    const statusBtn = Number(c.overall_status) === 2
      ? '<button class="btn btn-danger" data-action="status" data-target="3" data-id="' + _C.esc(c.id) + '">下线</button>'
      : '<button class="btn" data-action="status" data-target="2" data-id="' + _C.esc(c.id) + '">上线</button>';
    return `
      <tr>
        <td>${_C.esc(c.id)}</td>
        <td>${_C.esc(c.coupon_no)}</td>
        <td>${_C.esc(c.coupon_name)}</td>
        <td>${_C.esc(COUPON_TYPE_LABEL[c.coupon_type] || c.coupon_type)}</td>
        <td>${_C.esc(fenToYuanText(rule.amount))}</td>
        <td>${_C.esc(couponValidText(c))}</td>
        <td>${_C.esc(fmtNum(c.total_stock))}</td>
        <td>${_C.esc(fmtNum(c.user_grant_limit))}</td>
        <td>${overallStatusTag(c.overall_status)}</td>
        <td>${_C.esc(fmtTime(c.updated_at))}</td>
        <td>
          <div class="row-actions">
            <button class="btn" data-action="detail" data-id="${_C.esc(c.id)}">详情</button>
            <button class="btn" data-action="edit" data-id="${_C.esc(c.id)}">编辑</button>
            ${statusBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ---------- 新建 / 编辑 ----------

function toggleCouponValidSection() {
  const type = Number(document.getElementById('f-coupon-valid-type').value);
  document.getElementById('cp-valid-abs').classList.toggle('hidden', type !== 1);
  document.getElementById('cp-valid-rel').classList.toggle('hidden', type !== 2);
}

function resetCouponForm() {
  document.getElementById('coupon-form').reset();
  document.getElementById('f-coupon-id').value = '';
  document.getElementById('cp-create-only').classList.remove('hidden');
  document.getElementById('f-coupon-valid-type').value = '1';
  toggleCouponValidSection();
}

function collectCouponFormBody() {
  const validType = Number(document.getElementById('f-coupon-valid-type').value);
  const body = {
    coupon_name: document.getElementById('f-coupon-name').value.trim(),
    coupon_type: Number(document.getElementById('f-coupon-type').value),
    discount_rule: { amount: yuanToFen(document.getElementById('f-coupon-amount').value) },
    use_scope_type: 1,
    use_scope_rule: { spu_ids: parseIdList(document.getElementById('f-coupon-spu-ids').value) },
    valid_type: validType,
    total_stock: Number(document.getElementById('f-coupon-stock').value) || 0,
    user_grant_limit: Number(document.getElementById('f-coupon-limit').value) || 0,
    internal_remark: document.getElementById('f-coupon-remark').value.trim(),
  };
  if (validType === 1) {
    body.valid_start_at = localInputToTs(document.getElementById('f-coupon-valid-start').value);
    body.valid_end_at = localInputToTs(document.getElementById('f-coupon-valid-end').value);
  } else {
    body.valid_payload = {
      valid_days: Number(document.getElementById('f-coupon-valid-days').value) || 0,
      valid_hours: Number(document.getElementById('f-coupon-valid-hours').value) || 0,
    };
  }
  return body;
}

function validateCouponBody(body) {
  if (!body.coupon_name) return '请填写优惠券名称';
  if (!(body.discount_rule.amount > 0)) return '请填写正确的立减金额';
  if (!body.use_scope_rule.spu_ids.length) return '请填写适用 SPU ID';
  if (body.valid_type === 1) {
    if (!body.valid_start_at || !body.valid_end_at) return '请选择有效期起止时间';
    if (body.valid_end_at <= body.valid_start_at) return '结束时间必须晚于开始时间';
  } else {
    const p = body.valid_payload;
    if (!(p.valid_days > 0 || p.valid_hours > 0)) return '相对有效期的天/小时至少一个大于 0';
  }
  // 总库存 / 单用户发放数量限制选填，留空传 0（后端取默认值 9999999 / 1）
  return '';
}

async function openCouponEditModal(couponId) {
  try {
    const resp = await _C.post(COUPON_API.DETAIL, { coupon_id: couponId });
    const c = resp.data && resp.data.coupon;
    if (!c) { _C.toast('优惠券不存在', 'error'); return; }
    const rule = c.discount_rule || {};
    const validType = Number(c.valid_type) || 1;
    document.getElementById('f-coupon-id').value = c.id;
    document.getElementById('f-coupon-name').value = c.coupon_name || '';
    document.getElementById('f-coupon-type').value = String(c.coupon_type || 1);
    document.getElementById('f-coupon-amount').value = rule.amount ? String(rule.amount / 100) : '';
    document.getElementById('f-coupon-spu-ids').value =
      ((c.use_scope_rule && c.use_scope_rule.spu_ids) || []).join('\n');
    document.getElementById('f-coupon-valid-type').value = String(validType);
    if (validType === 1) {
      document.getElementById('f-coupon-valid-start').value = tsToLocalInput(c.valid_start_at);
      document.getElementById('f-coupon-valid-end').value = tsToLocalInput(c.valid_end_at);
    } else {
      const p = c.valid_payload || {};
      document.getElementById('f-coupon-valid-days').value = p.valid_days || 0;
      document.getElementById('f-coupon-valid-hours').value = p.valid_hours || 0;
    }
    document.getElementById('f-coupon-stock').value = c.total_stock || '';
    document.getElementById('f-coupon-limit').value = c.user_grant_limit || 1;
    document.getElementById('f-coupon-remark').value = c.internal_remark || '';
    toggleCouponValidSection();
    document.getElementById('cp-create-only').classList.add('hidden');
    document.getElementById('modal-coupon-title').textContent = '编辑优惠券';
    _C.openModal('modal-coupon');
  } catch (err) {
    _C.toast('加载详情失败：' + err.message, 'error');
  }
}

async function submitCouponForm(e) {
  e.preventDefault();
  const body = collectCouponFormBody();
  const errMsg = validateCouponBody(body);
  if (errMsg) { _C.toast(errMsg, 'error'); return; }

  const couponId = document.getElementById('f-coupon-id').value;
  const isEdit = !!couponId;
  let reqBody;
  if (isEdit) {
    reqBody = Object.assign({ coupon_id: couponId }, body);
  } else {
    reqBody = Object.assign(
      { online_after_create: document.getElementById('f-coupon-online').checked }, body);
  }

  try {
    await _C.post(isEdit ? COUPON_API.UPDATE : COUPON_API.CREATE, reqBody);
    _C.toast(isEdit ? '更新成功' : '创建成功', 'success');
    _C.closeModal('modal-coupon');
    loadCouponList();
  } catch (err) {
    _C.toast((isEdit ? '更新失败：' : '创建失败：') + err.message, 'error');
  }
}

// ---------- 详情 ----------

async function openCouponDetail(couponId) {
  try {
    const resp = await _C.post(COUPON_API.DETAIL, { coupon_id: couponId });
    const c = resp.data && resp.data.coupon;
    if (!c) { _C.toast('优惠券不存在', 'error'); return; }
    const rule = c.discount_rule || {};
    const spus = c.scope_spus || [];
    const spuText = spus.length
      ? spus.map(s => `${s.spu_no || '-'} ${s.spu_name || '-'}（ID:${s.spu_id}）`).join('\n')
      : ((c.use_scope_rule && c.use_scope_rule.spu_ids) || []).join('\n') || '-';
    renderDetailRows('cp-detail-body', [
      ['优惠券 ID', c.id],
      ['券编号', c.coupon_no],
      ['名称', c.coupon_name],
      ['类型', COUPON_TYPE_LABEL[c.coupon_type] || c.coupon_type],
      ['立减金额', fenToYuanText(rule.amount)],
      ['使用范围类型', c.use_scope_type === 1 ? '指定 SPU' : (c.use_scope_type || '-')],
      ['适用 SPU', spuText],
      ['有效期', couponValidText(c)],
      ['总库存', fmtNum(c.total_stock)],
      ['单用户限领', fmtNum(c.user_grant_limit)],
      ['整体状态', OVERALL_STATUS_LABEL[c.overall_status] || c.overall_status],
      ['状态变更原因', c.overall_status_reason || '-'],
      ['内部备注', c.internal_remark || '-'],
      ['创建人 ID', c.created_by || '-'],
      ['更新人 ID', c.updated_by || '-'],
      ['创建时间', fmtTime(c.created_at)],
      ['更新时间', fmtTime(c.updated_at)],
    ]);
    _C.openModal('modal-coupon-detail');
  } catch (err) {
    _C.toast('加载详情失败：' + err.message, 'error');
  }
}

// ---------- 修改整体状态 ----------

function openCouponStatusModal(couponId, targetStatus) {
  document.getElementById('f-cs-coupon-id').value = couponId;
  document.getElementById('f-cs-status').value = String(targetStatus);
  document.getElementById('f-cs-reason').value = '';
  _C.openModal('modal-coupon-status');
}

async function submitCouponStatus(e) {
  e.preventDefault();
  const body = {
    coupon_id: document.getElementById('f-cs-coupon-id').value,
    overall_status: Number(document.getElementById('f-cs-status').value),
    reason: document.getElementById('f-cs-reason').value.trim(),
  };
  if (!body.reason) { _C.toast('请填写变更原因', 'error'); return; }
  try {
    await _C.post(COUPON_API.UPDATE_STATUS, body);
    _C.toast('状态修改成功', 'success');
    _C.closeModal('modal-coupon-status');
    loadCouponList();
  } catch (err) {
    _C.toast('状态修改失败：' + err.message, 'error');
  }
}

function initCouponPage() {
  // 新建
  document.getElementById('btn-create-coupon').addEventListener('click', () => {
    resetCouponForm();
    document.getElementById('modal-coupon-title').textContent = '新建优惠券';
    _C.openModal('modal-coupon');
  });

  // 有效期类型切换
  document.getElementById('f-coupon-valid-type').addEventListener('change', toggleCouponValidSection);

  // 表单提交
  document.getElementById('coupon-form').addEventListener('submit', submitCouponForm);
  document.getElementById('coupon-status-form').addEventListener('submit', submitCouponStatus);

  // 行操作
  document.getElementById('cp-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'detail') openCouponDetail(id);
    if (action === 'edit') openCouponEditModal(id);
    if (action === 'status') openCouponStatusModal(id, btn.dataset.target);
  });

  // 查询 / 重置
  document.getElementById('btn-cp-search').addEventListener('click', () => {
    couponState.filter = {
      coupon_name: document.getElementById('cp-f-name').value.trim(),
      coupon_type: Number(document.getElementById('cp-f-type').value) || 0,
      overall_status: Number(document.getElementById('cp-f-status').value) || 0,
      coupon_id: document.getElementById('cp-f-id').value.trim(),
      coupon_no: document.getElementById('cp-f-no').value.trim(),
    };
    couponState.page = 1;
    loadCouponList();
  });
  document.getElementById('btn-cp-reset').addEventListener('click', () => {
    document.getElementById('cp-f-type').value = '0';
    document.getElementById('cp-f-status').value = '0';
    document.getElementById('cp-f-name').value = '';
    document.getElementById('cp-f-id').value = '';
    document.getElementById('cp-f-no').value = '';
    couponState.filter = { coupon_name: '', coupon_type: 0, overall_status: 0, coupon_id: '', coupon_no: '' };
    couponState.page = 1;
    loadCouponList();
  });

  // 分页
  document.getElementById('btn-cp-prev').addEventListener('click', () => {
    if (couponState.page <= 1) return;
    couponState.page -= 1;
    loadCouponList();
  });
  document.getElementById('btn-cp-next').addEventListener('click', () => {
    if (couponState.page >= Math.max(1, Math.ceil(couponState.total / couponState.pageSize))) return;
    couponState.page += 1;
    loadCouponList();
  });
  document.getElementById('cp-page-size').addEventListener('change', (e) => {
    couponState.pageSize = Number(e.target.value);
    couponState.page = 1;
    loadCouponList();
  });
}

// ============================================================
// 模块二：优惠券发放
// ============================================================

const grantOptionsState = { loaded: false };

const batchState = {
  page: 1,
  pageSize: 20,
  total: 0,
  filter: { batch_no: '', batch_id: '', coupon_id: '', grant_type: 0, execute_status: 0, use_status: 0 },
};

// 批次详情里发放明细分页
const batchDetailState = { batchId: '', page: 1, pageSize: 20, total: 0 };

// ---------- 可选优惠券 ----------

async function loadGrantOptions(force) {
  if (grantOptionsState.loaded && !force) return;
  const box = document.getElementById('grant-coupon-options');
  box.innerHTML = '<span class="hint">加载中…</span>';
  try {
    const resp = await _C.post(COUPON_API.OPTIONS, {});
    const list = (resp.data && resp.data.list) || [];
    if (!list.length) {
      box.innerHTML = '<span class="hint">暂无已上线优惠券</span>';
    } else {
      box.innerHTML = list.map(c => `
        <label>
          <input type="checkbox" value="${_C.esc(c.coupon_id)}" />
          ${_C.esc(c.coupon_name)}（ID: ${_C.esc(c.coupon_id)}）
        </label>
      `).join('');
    }
    grantOptionsState.loaded = true;
  } catch (err) {
    box.innerHTML = `<span class="hint">加载失败：${_C.esc(err.message)}</span>`;
  }
}

// ---------- 发放表单 ----------

function updateGrantTypeUI() {
  const type = Number(document.getElementById('f-grant-type').value);
  document.getElementById('grant-time-row').classList.toggle('hidden', type !== 2);
}

async function submitGrantForm(e) {
  e.preventDefault();
  const couponIds = Array.from(
    document.querySelectorAll('#grant-coupon-options input:checked')).map(i => i.value);
  const grantType = Number(document.getElementById('f-grant-type').value);
  const spuIds = parseIdList(document.getElementById('f-grant-spu-ids').value);
  const userIds = parseIdList(document.getElementById('f-grant-user-ids').value);
  const phones = parseIdList(document.getElementById('f-grant-phones').value);
  const validStart = localInputToTs(document.getElementById('f-grant-valid-start').value);
  const validEnd = localInputToTs(document.getElementById('f-grant-valid-end').value);
  const reason = document.getElementById('f-grant-reason').value.trim();

  if (!couponIds.length) { _C.toast('请至少选择一张优惠券', 'error'); return; }
  if (!spuIds.length && !userIds.length && !phones.length) {
    _C.toast('发放范围（SPU/用户ID/手机号）至少填一种', 'error'); return;
  }
  // 批次有效期选填：留空跟随券模板有效期；填写则起止必须同时填且失效晚于生效
  if ((validStart || validEnd) && !(validStart && validEnd)) {
    _C.toast('批次生效/失效时间需同时填写，留空则跟随券模板有效期', 'error'); return;
  }
  if (validStart && validEnd && validEnd <= validStart) { _C.toast('失效时间必须晚于生效时间', 'error'); return; }
  if (!reason) { _C.toast('请填写发券原因', 'error'); return; }

  const grantScopeRule = {};
  if (spuIds.length) grantScopeRule.spu_ids = spuIds;
  if (userIds.length) grantScopeRule.user_ids = userIds;
  if (phones.length) grantScopeRule.phones = phones;

  const body = {
    coupon_ids: couponIds,
    grant_type: grantType,
    grant_scope_rule: grantScopeRule,
    reason,
  };
  if (validStart && validEnd) {
    body.valid_start_at = validStart;
    body.valid_end_at = validEnd;
  }
  if (grantType === 2) {
    const grantTime = localInputToTs(document.getElementById('f-grant-grant-time').value);
    if (!grantTime) { _C.toast('系统自动发放必须选择计划发放时间', 'error'); return; }
    body.grant_time = grantTime;
  }

  try {
    const resp = await _C.post(COUPON_API.GRANT, body);
    const batchId = (resp.data && resp.data.batch_id) || '-';
    _C.toast(`提交成功，批次 ID：${batchId}，发放结果请查看批次列表`, 'success');
    document.getElementById('form-grant').reset();
    updateGrantTypeUI();
    batchState.page = 1;
    loadBatchList();
  } catch (err) {
    _C.toast('发放失败：' + err.message, 'error');
  }
}

// ---------- 批次列表 ----------

async function loadBatchList() {
  const f = batchState.filter;
  const body = { page: batchState.page, page_size: batchState.pageSize };
  if (f.batch_no) body.batch_no = f.batch_no;
  if (f.batch_id) body.batch_id = f.batch_id;
  if (f.coupon_id) body.coupon_id = f.coupon_id;
  if (Number(f.grant_type) > 0) body.grant_type = Number(f.grant_type);
  if (Number(f.execute_status) > 0) body.execute_status = Number(f.execute_status);
  if (Number(f.use_status) > 0) body.use_status = Number(f.use_status);
  try {
    const resp = await _C.post(COUPON_API.LIST_BATCHES, body);
    const list = (resp.data && resp.data.list) || [];
    batchState.total = (resp.data && resp.data.total_count) || 0;
    renderBatchList(list);
    renderPager(batchState, 'gb-page-info', 'btn-gb-prev', 'btn-gb-next');
  } catch (err) {
    _C.toast('加载失败：' + err.message, 'error');
    renderBatchList([]);
  }
}

function renderBatchList(list) {
  const tbody = document.getElementById('gb-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty">暂无数据</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(b => {
    const couponsText = (b.coupons || []).map(c => c.coupon_name).join('、') || '-';
    const validText = `${fmtTime(b.valid_start_at)}<br>~ ${fmtTime(b.valid_end_at)}`;
    const counts = `${fmtNum(b.total_count)} / ${fmtNum(b.success_count)} / ${fmtNum(b.other_count)}`;
    const disableBtn = Number(b.use_status) === 1
      ? `<button class="btn btn-danger" data-action="disable" data-id="${_C.esc(b.batch_id)}">停用</button>`
      : '';
    return `
      <tr>
        <td>${_C.esc(b.batch_id)}</td>
        <td>${_C.esc(b.batch_no)}</td>
        <td>${_C.esc(couponsText)}</td>
        <td>${_C.esc(GRANT_TYPE_LABEL[b.grant_type] || b.grant_type)}</td>
        <td>${validText}</td>
        <td>${b.grant_time ? _C.esc(fmtTime(b.grant_time)) : '立即发放'}</td>
        <td>${_C.esc(counts)}</td>
        <td>${executeStatusTag(b.execute_status)}</td>
        <td>${useStatusTag(b.use_status)}</td>
        <td>
          <div class="row-actions">
            <button class="btn" data-action="detail" data-id="${_C.esc(b.batch_id)}">详情</button>
            ${disableBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ---------- 批次详情（含发放明细）----------

async function openBatchDetail(batchId) {
  batchDetailState.batchId = batchId;
  batchDetailState.page = 1;
  fetchBatchDetail();
}

async function fetchBatchDetail() {
  try {
    const resp = await _C.post(COUPON_API.BATCH_DETAIL, {
      batch_id: batchDetailState.batchId,
      page: batchDetailState.page,
      page_size: batchDetailState.pageSize,
    });
    const d = resp.data || {};
    const b = d.batch || {};
    batchDetailState.total = d.total_count || 0;
    renderBatchInfo(b);
    renderGrantRecords(d.grant_records || []);
    renderPager(batchDetailState, 'gbr-page-info', 'btn-gbr-prev', 'btn-gbr-next');
    _C.openModal('modal-grant-batch');
  } catch (err) {
    _C.toast('加载批次详情失败：' + err.message, 'error');
  }
}

function renderBatchInfo(b) {
  const couponsText = (b.coupons || []).map(c => `${c.coupon_name}（ID:${c.coupon_id}）`).join('\n');
  renderDetailRows('gb-detail-info', [
    ['批次 ID', b.id],
    ['批次编号', b.batch_no],
    ['优惠券', couponsText || '-'],
    ['发放方式', GRANT_TYPE_LABEL[b.grant_type] || b.grant_type],
    ['执行状态', EXECUTE_STATUS_LABEL[b.execute_status] || b.execute_status],
    ['使用控制', USE_STATUS_LABEL[b.use_status] || b.use_status],
    ['发放统计', `目标 ${fmtNum(b.total_count)} / 成功 ${fmtNum(b.success_count)} / 失败 ${fmtNum(b.failed_count)} / 跳过 ${fmtNum(b.skipped_count)}`],
    ['券生效时间', fmtTime(b.valid_start_at)],
    ['券失效时间', fmtTime(b.valid_end_at)],
    ['计划发放时间', b.grant_time ? fmtTime(b.grant_time) : '立即发放'],
    ['发券原因', b.reason || '-'],
    ['停用原因', b.use_status_reason || '-'],
    ['发放范围', grantScopeText(b.grant_scope_rule)],
    ['创建人 ID', b.created_by || '-'],
    ['创建时间', fmtTime(b.created_at)],
  ]);
}

function renderGrantRecords(list) {
  const tbody = document.getElementById('gbr-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无数据</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r => `
    <tr>
      <td>${_C.esc(r.user_id)}</td>
      <td>${_C.esc(r.phone)}</td>
      <td>${_C.esc(r.coupon_id)}</td>
      <td>${_C.esc(r.user_coupon_id)}</td>
      <td>${grantRecordStatusTag(r.grant_status)}</td>
      <td>${_C.esc(r.fail_reason || '-')}</td>
      <td>${_C.esc(fmtTime(r.created_at))}</td>
    </tr>
  `).join('');
}

// ---------- 停用批次 ----------

function openDisableBatchModal(batchId) {
  document.getElementById('f-db-batch-id').value = batchId;
  document.getElementById('f-db-reason').value = '';
  _C.openModal('modal-disable-batch');
}

async function submitDisableBatch(e) {
  e.preventDefault();
  const batchId = document.getElementById('f-db-batch-id').value;
  const reason = document.getElementById('f-db-reason').value.trim();
  if (!reason) { _C.toast('请填写停用原因', 'error'); return; }
  if (!confirm('停用后已发放的券会作废、未发放的不再发放，确定停用该批次吗？')) return;
  try {
    await _C.post(COUPON_API.DISABLE_BATCH, { batch_id: batchId, reason });
    _C.toast('停用成功', 'success');
    _C.closeModal('modal-disable-batch');
    loadBatchList();
  } catch (err) {
    _C.toast('停用失败：' + err.message, 'error');
  }
}

function initGrantPage() {
  document.getElementById('form-grant').addEventListener('submit', submitGrantForm);
  document.getElementById('f-grant-type').addEventListener('change', updateGrantTypeUI);
  document.getElementById('btn-refresh-options').addEventListener('click', () => loadGrantOptions(true));
  document.getElementById('disable-batch-form').addEventListener('submit', submitDisableBatch);

  // 批次行操作
  document.getElementById('gb-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.action === 'detail') openBatchDetail(btn.dataset.id);
    if (btn.dataset.action === 'disable') openDisableBatchModal(btn.dataset.id);
  });

  // 查询 / 重置
  document.getElementById('btn-gb-search').addEventListener('click', () => {
    batchState.filter = {
      batch_no: document.getElementById('gb-f-batch-no').value.trim(),
      batch_id: document.getElementById('gb-f-batch-id').value.trim(),
      coupon_id: document.getElementById('gb-f-coupon-id').value.trim(),
      grant_type: Number(document.getElementById('gb-f-grant-type').value) || 0,
      execute_status: Number(document.getElementById('gb-f-execute-status').value) || 0,
      use_status: Number(document.getElementById('gb-f-use-status').value) || 0,
    };
    batchState.page = 1;
    loadBatchList();
  });
  document.getElementById('btn-gb-reset').addEventListener('click', () => {
    document.getElementById('gb-f-batch-no').value = '';
    document.getElementById('gb-f-batch-id').value = '';
    document.getElementById('gb-f-coupon-id').value = '';
    document.getElementById('gb-f-grant-type').value = '0';
    document.getElementById('gb-f-execute-status').value = '0';
    document.getElementById('gb-f-use-status').value = '0';
    batchState.filter = { batch_no: '', batch_id: '', coupon_id: '', grant_type: 0, execute_status: 0, use_status: 0 };
    batchState.page = 1;
    loadBatchList();
  });

  // 批次分页
  document.getElementById('btn-gb-prev').addEventListener('click', () => {
    if (batchState.page <= 1) return;
    batchState.page -= 1;
    loadBatchList();
  });
  document.getElementById('btn-gb-next').addEventListener('click', () => {
    if (batchState.page >= Math.max(1, Math.ceil(batchState.total / batchState.pageSize))) return;
    batchState.page += 1;
    loadBatchList();
  });
  document.getElementById('gb-page-size').addEventListener('change', (e) => {
    batchState.pageSize = Number(e.target.value);
    batchState.page = 1;
    loadBatchList();
  });

  // 发放明细分页
  document.getElementById('btn-gbr-prev').addEventListener('click', () => {
    if (batchDetailState.page <= 1) return;
    batchDetailState.page -= 1;
    fetchBatchDetail();
  });
  document.getElementById('btn-gbr-next').addEventListener('click', () => {
    const totalPage = Math.max(1, Math.ceil(batchDetailState.total / batchDetailState.pageSize));
    if (batchDetailState.page >= totalPage) return;
    batchDetailState.page += 1;
    fetchBatchDetail();
  });
}

// ============================================================
// 模块三：用户优惠券
// ============================================================

const userCouponState = {
  page: 1,
  pageSize: 20,
  total: 0,
  filter: { phone: '', user_id: '', coupon_id: '', batch_no: '' },
};

async function loadUserCouponList() {
  const f = userCouponState.filter;
  const body = { page: userCouponState.page, page_size: userCouponState.pageSize };
  if (f.phone) body.phone = f.phone;
  if (f.user_id) body.user_id = f.user_id;
  if (f.coupon_id) body.coupon_id = f.coupon_id;
  if (f.batch_no) body.batch_no = f.batch_no;
  try {
    const resp = await _C.post(COUPON_API.LIST_USER_COUPONS, body);
    const list = (resp.data && resp.data.list) || [];
    userCouponState.total = (resp.data && resp.data.total_count) || 0;
    renderUserCouponList(list);
    renderPager(userCouponState, 'uc-page-info', 'btn-uc-prev', 'btn-uc-next');
  } catch (err) {
    _C.toast('加载失败：' + err.message, 'error');
    renderUserCouponList([]);
  }
}

function renderUserCouponList(list) {
  const tbody = document.getElementById('uc-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty">暂无数据</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(item => `
    <tr>
      <td>${_C.esc(item.user_id)}</td>
      <td>${_C.esc(item.user_name || '-')}</td>
      <td>${_C.esc(item.phone || '-')}</td>
      <td>${_C.esc(item.coupon_name)}</td>
      <td>${_C.esc(item.batch_no || '-')}</td>
      <td>${_C.esc(GRANT_TYPE_LABEL[item.grant_type] || item.grant_type)}</td>
      <td>${_C.esc(fenToYuanText(item.discount_amount))}</td>
      <td>${_C.esc(fmtTime(item.valid_start_at))}</td>
      <td>${_C.esc(fmtTime(item.valid_end_at))}</td>
      <td>${userCouponStatusTag(item.status)}${item.status_desc ? `<div class="hint">${_C.esc(item.status_desc)}</div>` : ''}</td>
    </tr>
  `).join('');
}

function initUserCouponPage() {
  document.getElementById('btn-uc-search').addEventListener('click', () => {
    userCouponState.filter = {
      phone: document.getElementById('uc-f-phone').value.trim(),
      user_id: document.getElementById('uc-f-user-id').value.trim(),
      coupon_id: document.getElementById('uc-f-coupon-id').value.trim(),
      batch_no: document.getElementById('uc-f-batch-no').value.trim(),
    };
    userCouponState.page = 1;
    loadUserCouponList();
  });
  document.getElementById('btn-uc-reset').addEventListener('click', () => {
    document.getElementById('uc-f-phone').value = '';
    document.getElementById('uc-f-user-id').value = '';
    document.getElementById('uc-f-coupon-id').value = '';
    document.getElementById('uc-f-batch-no').value = '';
    userCouponState.filter = { phone: '', user_id: '', coupon_id: '', batch_no: '' };
    userCouponState.page = 1;
    loadUserCouponList();
  });

  document.getElementById('btn-uc-prev').addEventListener('click', () => {
    if (userCouponState.page <= 1) return;
    userCouponState.page -= 1;
    loadUserCouponList();
  });
  document.getElementById('btn-uc-next').addEventListener('click', () => {
    const totalPage = Math.max(1, Math.ceil(userCouponState.total / userCouponState.pageSize));
    if (userCouponState.page >= totalPage) return;
    userCouponState.page += 1;
    loadUserCouponList();
  });
  document.getElementById('uc-page-size').addEventListener('change', (e) => {
    userCouponState.pageSize = Number(e.target.value);
    userCouponState.page = 1;
    loadUserCouponList();
  });
}

window.Coupon = { initCouponPage, loadCouponList };
window.CouponGrant = { initGrantPage, loadBatchList, loadGrantOptions };
window.UserCoupon = { initUserCouponPage, loadUserCouponList };

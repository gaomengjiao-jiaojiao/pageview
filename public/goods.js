// 宠物商店管理模块：商品列表、增删改查
// 创建/编辑时通过 Cards.openCardPicker 选择关联卡片 → 写入 goods_value

const _G = window.App;

const GOODS_API = {
  CREATE: '/api/operation/api/pet_store/create_goods',
  UPDATE: '/api/operation/api/pet_store/update_goods',
  DELETE: '/api/operation/api/pet_store/delete_goods',
  GET: '/api/operation/api/pet_store/get_goods_detail',
  LIST: '/api/operation/api/pet_store/admin_get_goods_list',
};

// 商品类型枚举（与卡券二级类型同值，便于按类型筛选卡片）
const GOODS_TYPE_LABEL = {
  0: '-', 101: '宠物背景', 102: '宠物颜色', 103: '宠物套装', 104: '宠物相框',
};
const BUY_TYPE_LABEL = { 0: '-', 1: '金币购买' };

const goodsState = {
  offset: 0,
  limit: 20,
  total: 0,
  filter: { goods_type: 0, goods_buy_type: 0, is_enabled: 'all', goods_name: '' },
};

// ========== 列表 ==========

async function loadGoodsList() {
  // proto 里 is_enabled 是 bool；后端按 "all" 判全部，则不传该字段
  const body = {
    goods_type: Number(goodsState.filter.goods_type) || 0,
    goods_buy_type: Number(goodsState.filter.goods_buy_type) || 0,
    goods_name: goodsState.filter.goods_name || '',
    pagination: { offset: goodsState.offset, limit: goodsState.limit },
  };
  if (goodsState.filter.is_enabled !== 'all') {
    body.is_enabled = goodsState.filter.is_enabled === 'true';
  }
  try {
    const resp = await _G.post(GOODS_API.LIST, body);
    const list = (resp.data && resp.data.list) || [];
    const pageInfo = (resp.data && resp.data.page_info) || {};
    goodsState.total = pageInfo.total_count || 0;
    renderGoodsList(list);
    renderGoodsPageInfo();
  } catch (err) {
    _G.toast('加载失败：' + err.message, 'error');
    renderGoodsList([]);
  }
}

function renderGoodsList(list) {
  const tbody = document.getElementById('goods-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty">暂无数据</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(item => {
    const statusTag = item.is_enabled
      ? '<span class="tag tag-on">已上架</span>'
      : '<span class="tag tag-off">未上架</span>';
    // 卡片信息
    const cardInfo = item.card_info || {};
    const cardId = cardInfo.card_id || item.goods_value || '-';
    const cardName = cardInfo.card_name || '-';
    const cardImg = cardInfo.card_preview_url
      ? `<img class="preview-img" src="${_G.esc(cardInfo.card_preview_url)}" alt="" onerror="this.style.display='none'" />`
      : '-';
    return `
      <tr>
        <td>${_G.esc(item.goods_id)}</td>
        <td>${_G.esc(cardId)}</td>
        <td>${_G.esc(cardName)}</td>
        <td>${cardImg}</td>
        <td>${_G.esc(GOODS_TYPE_LABEL[item.goods_type] || item.goods_type)}</td>
        <td>${_G.esc(item.goods_name)}</td>
        <td>${_G.esc(item.goods_price)}</td>
        <td>${_G.esc(BUY_TYPE_LABEL[item.goods_buy_type] || item.goods_buy_type)}</td>
        <td>${_G.esc(item.sort)}</td>
        <td>${statusTag}</td>
        <td>
          <div class="row-actions">
            <button class="btn" data-action="edit" data-id="${_G.esc(item.goods_id)}">编辑</button>
            <button class="btn btn-danger" data-action="delete" data-id="${_G.esc(item.goods_id)}">删除</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderGoodsPageInfo() {
  const cur = Math.floor(goodsState.offset / goodsState.limit) + 1;
  const totalPage = Math.max(1, Math.ceil(goodsState.total / goodsState.limit));
  document.getElementById('goods-page-info').textContent =
    `第 ${cur} 页 / 共 ${totalPage} 页 / 共 ${goodsState.total} 条`;
  document.getElementById('btn-goods-prev').disabled = goodsState.offset <= 0;
  document.getElementById('btn-goods-next').disabled = goodsState.offset + goodsState.limit >= goodsState.total;
}

// ========== 弹窗（新建 / 编辑）==========

function collectGoodsFormBody() {
  return {
    goods_type: Number(document.getElementById('g-goods-type').value),
    goods_name: document.getElementById('g-goods-name').value.trim(),
    goods_desc: document.getElementById('g-goods-desc').value.trim(),
    goods_price: document.getElementById('g-goods-price').value.trim(),
    goods_condition: document.getElementById('g-goods-condition').value.trim(),
    goods_buy_type: Number(document.getElementById('g-goods-buy-type').value),
    unlock_level_id: Number(document.getElementById('g-unlock-level').value) || 0,
    goods_value: document.getElementById('g-goods-value').value.trim(),
    sort: Number(document.getElementById('g-sort').value) || 0,
    is_enabled: document.getElementById('g-is-enabled').checked,
  };
}

function resetGoodsForm() {
  document.getElementById('goods-form').reset();
  document.getElementById('g-goods-id').value = '';
  document.getElementById('g-goods-value').value = '';
  document.getElementById('g-goods-value-hint').textContent = '未选择';
  document.getElementById('g-is-enabled').checked = true;
}

async function openGoodsEditModal(goodsId) {
  try {
    const resp = await _G.post(GOODS_API.GET, { goods_id: goodsId });
    const g = resp.data && resp.data.goods_info;
    if (!g) { _G.toast('商品不存在', 'error'); return; }
    document.getElementById('g-goods-id').value = g.goods_id;
    document.getElementById('g-goods-name').value = g.goods_name || '';
    document.getElementById('g-goods-type').value = g.goods_type || 101;
    document.getElementById('g-goods-desc').value = g.goods_desc || '';
    document.getElementById('g-goods-price').value = g.goods_price || '';
    document.getElementById('g-goods-buy-type').value = g.goods_buy_type || 1;
    document.getElementById('g-unlock-level').value = g.unlock_level_id || 0;
    document.getElementById('g-goods-value').value = g.goods_value || '';
    document.getElementById('g-sort').value = g.sort || 0;
    document.getElementById('g-goods-condition').value = g.goods_condition || '';
    document.getElementById('g-is-enabled').checked = !!g.is_enabled;
    document.getElementById('g-goods-value-hint').textContent =
      g.goods_value ? `当前卡片ID：${g.goods_value}` : '未选择';
    document.getElementById('modal-goods-title').textContent = '编辑商品';
    _G.openModal('modal-goods');
  } catch (err) {
    _G.toast('加载详情失败：' + err.message, 'error');
  }
}

async function submitGoodsForm(e) {
  e.preventDefault();
  const body = collectGoodsFormBody();
  if (!body.goods_price) { _G.toast('请填写商品价格', 'error'); return; }
  if (!body.goods_value) { _G.toast('请选择关联卡片', 'error'); return; }
  if (!_G.validateJson(body.goods_condition)) { _G.toast('补充信息不是合法 JSON', 'error'); return; }

  const goodsId = document.getElementById('g-goods-id').value;
  const isEdit = !!goodsId;
  const url = isEdit ? GOODS_API.UPDATE : GOODS_API.CREATE;
  // goods_id 在 proto 中也是 json:"goods_id,string"
  const reqBody = isEdit ? Object.assign({ goods_id: goodsId }, body) : body;

  try {
    await _G.post(url, reqBody);
    _G.toast(isEdit ? '更新成功' : '创建成功', 'success');
    _G.closeModal('modal-goods');
    resetGoodsForm();
    loadGoodsList();
  } catch (err) {
    _G.toast((isEdit ? '更新失败：' : '创建失败：') + err.message, 'error');
  }
}

async function deleteGoods(goodsId) {
  if (!confirm('确定删除该商品吗？')) return;
  try {
    await _G.post(GOODS_API.DELETE, { goods_id: goodsId });
    _G.toast('删除成功', 'success');
    loadGoodsList();
  } catch (err) {
    _G.toast('删除失败：' + err.message, 'error');
  }
}

// ========== 选择卡片 ==========

function pickCard() {
  // 把当前商品类型透传给卡片选择器作为预筛选条件
  // 商品类型枚举值与卡券二级类型枚举值一致（101/102/103/104）
  const goodsType = Number(document.getElementById('g-goods-type').value);
  window.Cards.openCardPicker(goodsType, (card) => {
    document.getElementById('g-goods-value').value = card.card_id;
    document.getElementById('g-goods-value-hint').textContent =
      `已选：${card.card_name}（ID: ${card.card_id}）`;
  });
}

// ========== 模块初始化 ==========

function initGoods() {
  // 新建
  document.getElementById('btn-create-goods').addEventListener('click', () => {
    resetGoodsForm();
    document.getElementById('modal-goods-title').textContent = '新建商品';
    _G.openModal('modal-goods');
  });

  // 表单提交
  document.getElementById('goods-form').addEventListener('submit', submitGoodsForm);

  // 选择卡片
  document.getElementById('btn-pick-card').addEventListener('click', pickCard);

  // 行操作
  document.getElementById('goods-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'edit') openGoodsEditModal(id);
    if (action === 'delete') deleteGoods(id);
  });

  // 查询 / 重置
  document.getElementById('btn-goods-search').addEventListener('click', () => {
    goodsState.filter.goods_type = document.getElementById('g-type').value;
    goodsState.filter.goods_buy_type = document.getElementById('g-buy-type').value;
    goodsState.filter.is_enabled = document.getElementById('g-enabled').value;
    goodsState.filter.goods_name = document.getElementById('g-name').value.trim();
    goodsState.offset = 0;
    loadGoodsList();
  });
  document.getElementById('btn-goods-reset').addEventListener('click', () => {
    document.getElementById('g-type').value = '0';
    document.getElementById('g-buy-type').value = '0';
    document.getElementById('g-enabled').value = 'all';
    document.getElementById('g-name').value = '';
    goodsState.filter = { goods_type: 0, goods_buy_type: 0, is_enabled: 'all', goods_name: '' };
    goodsState.offset = 0;
    loadGoodsList();
  });

  // 分页
  document.getElementById('btn-goods-prev').addEventListener('click', () => {
    if (goodsState.offset <= 0) return;
    goodsState.offset = Math.max(0, goodsState.offset - goodsState.limit);
    loadGoodsList();
  });
  document.getElementById('btn-goods-next').addEventListener('click', () => {
    if (goodsState.offset + goodsState.limit >= goodsState.total) return;
    goodsState.offset += goodsState.limit;
    loadGoodsList();
  });
  document.getElementById('goods-page-size').addEventListener('change', (e) => {
    goodsState.limit = Number(e.target.value);
    goodsState.offset = 0;
    loadGoodsList();
  });
}

window.Goods = { initGoods, loadGoodsList };

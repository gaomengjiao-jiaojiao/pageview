// 卡券管理模块：列表查询、新建、编辑、删除
// 同时对外提供 openCardPicker，供商品页选择卡片使用

const {
  post: appPost,
  toast: appToast,
  esc: appEsc,
  validateJson: appValidateJson,
  openModal: appOpenModal,
  closeModal: appCloseModal,
  CARD_SECOND_TYPE_LABEL: cardSecondTypeLabel,
} = window.App;

const CARD_API = {
  CREATE: '/api/operation/api/incentive_card/create_card',
  UPDATE: '/api/operation/api/incentive_card/update_card',
  DELETE: '/api/operation/api/incentive_card/delete_card',
  GET: '/api/operation/api/incentive_card/get_card',
  LIST: '/api/operation/api/incentive_card/list_cards',
};
const COS_API = {
  GET_PERMISSION: '/api/operation/api/cos/get_permission',
};
const APP_CONFIG = window.__APP_CONFIG__ || {};

const FIRST_TYPE_LABEL = { 0: '-', 1: '宠物装扮' };
const STATUS_LABEL = { 0: '-', 1: '启用', 2: '禁用' };

// 更新图片预览
function updateCardImagePreviews() {
  const previewUrl = document.getElementById('f-card-preview-url').value.trim();
  const previewLockedUrl = document.getElementById('f-card-preview-url-locked').value.trim();
  const bigImageUrl = document.getElementById('f-card-big-image-url').value.trim();

  const previewEl = document.getElementById('preview-url-preview');
  const lockedEl = document.getElementById('preview-url-locked-preview');
  const bigEl = document.getElementById('big-image-url-preview');

  if (previewUrl) {
    previewEl.innerHTML = `<img src="${appEsc(previewUrl)}" alt="已获得图预览" onerror="this.parentElement.innerHTML='<span class=\\'img-error\\'>图片加载失败</span>'" />`;
  } else {
    previewEl.innerHTML = '';
  }

  if (previewLockedUrl) {
    lockedEl.innerHTML = `<img src="${appEsc(previewLockedUrl)}}" alt="未获得图预览" onerror="this.parentElement.innerHTML='<span class=\\'img-error\\'>图片加载失败</span>'" />`;
  } else {
    lockedEl.innerHTML = '';
  }

  if (bigImageUrl) {
    bigEl.innerHTML = `<img src="${appEsc(bigImageUrl)}" alt="图片大图预览" onerror="this.parentElement.innerHTML='<span class=\\'img-error\\'>图片加载失败</span>'" />`;
  } else {
    bigEl.innerHTML = '';
  }
}

const cardState = {
  offset: 0,
  limit: 20,
  total: 0,
  filter: { card_first_type: 0, card_second_type: 0, card_status: 0, card_name: '' },
};

function getExtFromName(name) {
  const idx = name.lastIndexOf('.');
  if (idx < 0 || idx === name.length - 1) return 'png';
  return name.slice(idx + 1).toLowerCase();
}

function buildCardImageObjectKey(file) {
  const ext = getExtFromName(file.name);
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'png';
  const rand = Math.random().toString(36).slice(2, 10);
  const rawPrefix = APP_CONFIG.CARD_COS_KEY_PREFIX || 'operation_api/card/';
  const normalizedPrefix = String(rawPrefix).replace(/\/+$/, '') + '/';
  return `${normalizedPrefix}${Date.now()}_${rand}.${safeExt}`;
}

async function uploadCardImageToCos(file, filePath) {
  const fileExt = getExtFromName(file.name);
  const permResp = await appPost(COS_API.GET_PERMISSION, {
    file_type: 'card',
    file_ext: fileExt,
    file_path: filePath,
    operation_type: 1,
    bucket_type: 1,
  });
  const signedUrl = permResp && permResp.data && permResp.data.signed_url;
  if (!signedUrl) throw new Error('获取 COS 上传地址失败');

  const putResp = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!putResp.ok) {
    const text = await putResp.text();
    throw new Error(`上传 COS 失败：HTTP ${putResp.status} ${text || ''}`.trim());
  }
}

async function handleCardImageUpload(fileInputId, keyInputId, desc) {
  const fileInput = document.getElementById(fileInputId);
  const keyInput = document.getElementById(keyInputId);
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    appToast(`请先选择${desc}文件`, 'error');
    return;
  }
  const objectKey = buildCardImageObjectKey(file);
  await uploadCardImageToCos(file, objectKey);
  keyInput.value = objectKey;
  appToast(`${desc}上传成功`, 'success');
}

// ========== 列表 ==========

async function loadCardList() {
  const body = {
    card_first_type: Number(cardState.filter.card_first_type) || 0,
    card_second_type: Number(cardState.filter.card_second_type) || 0,
    card_status: Number(cardState.filter.card_status) || 0,
    card_name: cardState.filter.card_name || '',
    pagination: { offset: cardState.offset, limit: cardState.limit },
  };
  try {
    const resp = await appPost(CARD_API.LIST, body);
    const list = (resp.data && resp.data.list) || [];
    const pageInfo = (resp.data && resp.data.page_info) || {};
    cardState.total = pageInfo.total_count || 0;
    renderCardList(list);
    renderCardPageInfo();
  } catch (err) {
    appToast('加载失败：' + err.message, 'error');
    renderCardList([]);
  }
}

function renderCardList(list) {
  const tbody = document.getElementById('card-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty">暂无数据</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(item => {
    const statusTag = item.card_status === 1
      ? '<span class="tag tag-on">启用</span>'
      : item.card_status === 2 ? '<span class="tag tag-off">禁用</span>' : '-';
    const img = item.card_preview_url
      ? `<img class="preview-img" src="${appEsc(item.card_preview_url)}" alt="" onerror="this.style.display='none'" />`
      : '-';
    return `
      <tr>
        <td>${appEsc(item.card_id)}</td>
        <td>${img}</td>
        <td>${appEsc(item.card_name)}</td>
        <td>${appEsc(item.card_sub_title)}</td>
        <td>${appEsc(FIRST_TYPE_LABEL[item.card_first_type] || item.card_first_type)}</td>
        <td>${appEsc(cardSecondTypeLabel[item.card_second_type] || item.card_second_type)}</td>
        <td>${statusTag}</td>
        <td>${appEsc(item.sort)}</td>
        <td>${appEsc(item.send_count)}</td>
        <td>
          <div class="row-actions">
            <button class="btn" data-action="edit" data-id="${appEsc(item.card_id)}">编辑</button>
            <button class="btn btn-danger" data-action="delete" data-id="${appEsc(item.card_id)}">删除</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderCardPageInfo() {
  const cur = Math.floor(cardState.offset / cardState.limit) + 1;
  const totalPage = Math.max(1, Math.ceil(cardState.total / cardState.limit));
  document.getElementById('card-page-info').textContent =
    `第 ${cur} 页 / 共 ${totalPage} 页 / 共 ${cardState.total} 条`;
  document.getElementById('btn-card-prev').disabled = cardState.offset <= 0;
  document.getElementById('btn-card-next').disabled = cardState.offset + cardState.limit >= cardState.total;
}

// ========== 弹窗（新建 / 编辑）==========

function collectCardFormBody() {
  const colorStart = document.getElementById('f-card-color-start').value.trim();
  const colorEnd = document.getElementById('f-card-color-end').value.trim();
  const bigImageUrl = document.getElementById('f-card-big-image-url').value.trim();

  const extConfigObj = {};
  if (colorStart) extConfigObj.color_start = colorStart;
  if (colorEnd) extConfigObj.color_end = colorEnd;
  if (bigImageUrl) extConfigObj.big_image_url = bigImageUrl;

  return {
    card_name: document.getElementById('f-card-name').value.trim(),
    card_sub_title: document.getElementById('f-card-sub-title').value.trim(),
    card_first_type: Number(document.getElementById('f-card-first-type').value),
    card_second_type: Number(document.getElementById('f-card-second-type').value),
    card_preview_url: document.getElementById('f-card-preview-url').value.trim(),
    card_preview_url_locked: document.getElementById('f-card-preview-url-locked').value.trim(),
    card_desc: document.getElementById('f-card-desc').value.trim(),
    card_status: Number(document.getElementById('f-card-status').value),
    sort: Number(document.getElementById('f-card-sort').value) || 0,
    remark: document.getElementById('f-card-remark').value.trim(),
    ext_config: Object.keys(extConfigObj).length > 0 ? extConfigObj : null,
  };
}

async function openCardEditModal(cardId) {
  try {
    const resp = await appPost(CARD_API.GET, { card_id: cardId });
    const card = resp.data && resp.data.card;
    if (!card) { appToast('卡券不存在', 'error'); return; }

    let extConfig = {};
    if (card.ext_config) {
      if (typeof card.ext_config === 'object') {
        extConfig = card.ext_config;
      } else {
        try {
          extConfig = JSON.parse(card.ext_config);
        } catch (e) {
          extConfig = {};
        }
      }
    }

    document.getElementById('f-card-id').value = card.card_id;
    document.getElementById('f-card-name').value = card.card_name || '';
    document.getElementById('f-card-sub-title').value = card.card_sub_title || '';
    document.getElementById('f-card-color-start').value = extConfig.color_start || '';
    document.getElementById('f-card-color-end').value = extConfig.color_end || '';
    document.getElementById('f-card-big-image-url').value = extConfig.big_image_url || '';
    document.getElementById('f-card-first-type').value = card.card_first_type || 1;
    document.getElementById('f-card-second-type').value = card.card_second_type || 101;
    document.getElementById('f-card-preview-url').value = card.card_preview_url || '';
    document.getElementById('f-card-preview-url-locked').value = card.card_preview_url_locked || '';
    document.getElementById('f-card-desc').value = card.card_desc || '';
    document.getElementById('f-card-status').value = card.card_status || 1;
    document.getElementById('f-card-sort').value = card.sort || 0;
    document.getElementById('f-card-remark').value = card.remark || '';

    document.getElementById('modal-card-title').textContent = '编辑卡券';
    updateCardImagePreviews();
    appOpenModal('modal-card');
  } catch (err) {
    appToast('加载详情失败：' + err.message, 'error');
  }
}

async function submitCardForm(e) {
  e.preventDefault();
  const body = collectCardFormBody();
  if (!body.card_name) { appToast('请填写卡券名称', 'error'); return; }

  const cardId = document.getElementById('f-card-id').value;
  const isEdit = !!cardId;
  const url = isEdit ? CARD_API.UPDATE : CARD_API.CREATE;
  // card_id 在 proto 中标记为 string，需以字符串传
  const reqBody = isEdit ? Object.assign({ card_id: cardId }, body) : body;

  try {
    await appPost(url, reqBody);
    appToast(isEdit ? '更新成功' : '创建成功', 'success');
    appCloseModal('modal-card');
    document.getElementById('card-form').reset();
    document.getElementById('f-card-id').value = '';
    loadCardList();
  } catch (err) {
    appToast((isEdit ? '更新失败：' : '创建失败：') + err.message, 'error');
  }
}

async function deleteCard(cardId) {
  if (!confirm('确定删除该卡券吗？')) return;
  try {
    await appPost(CARD_API.DELETE, { card_id: cardId });
    appToast('删除成功', 'success');
    loadCardList();
  } catch (err) {
    appToast('删除失败：' + err.message, 'error');
  }
}

// ========== 卡片选择器（供商品页调用）==========

const pickerState = {
  offset: 0,
  limit: 10,
  total: 0,
  filter: { card_second_type: 0, card_name: '' },
  onPick: null, // 选中后的回调：(card) => void
};

async function loadPicker() {
  const body = {
    card_first_type: 0,
    card_second_type: Number(pickerState.filter.card_second_type) || 0,
    card_status: 0,
    card_name: pickerState.filter.card_name || '',
    pagination: { offset: pickerState.offset, limit: pickerState.limit },
  };
  try {
    const resp = await appPost(CARD_API.LIST, body);
    const list = (resp.data && resp.data.list) || [];
    const pageInfo = (resp.data && resp.data.page_info) || {};
    pickerState.total = pageInfo.total_count || 0;
    renderPicker(list);
  } catch (err) {
    appToast('加载卡片失败：' + err.message, 'error');
  }
}

function renderPicker(list) {
  const tbody = document.getElementById('pk-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无数据</td></tr>';
  } else {
    tbody.innerHTML = list.map(item => {
      const img = item.card_preview_url
        ? `<img class="preview-img" src="${appEsc(item.card_preview_url)}" alt="" onerror="this.style.display='none'" />`
        : '-';
      const statusTag = item.card_status === 1
        ? '<span class="tag tag-on">启用</span>' : '<span class="tag tag-off">禁用</span>';
      // 选中按钮上挂载所需数据，事件委托里再读取
      return `
        <tr>
          <td>${appEsc(item.card_id)}</td>
          <td>${img}</td>
          <td>${appEsc(item.card_name)}</td>
          <td>${appEsc(cardSecondTypeLabel[item.card_second_type] || item.card_second_type)}</td>
          <td>${statusTag}</td>
          <td>
            <button class="btn btn-primary" data-pick-id="${appEsc(item.card_id)}" data-pick-name="${appEsc(item.card_name)}">选择</button>
          </td>
        </tr>
      `;
    }).join('');
  }
  const cur = Math.floor(pickerState.offset / pickerState.limit) + 1;
  const totalPage = Math.max(1, Math.ceil(pickerState.total / pickerState.limit));
  document.getElementById('pk-page-info').textContent =
    `第 ${cur} 页 / 共 ${totalPage} 页 / 共 ${pickerState.total} 条`;
  document.getElementById('btn-pk-prev').disabled = pickerState.offset <= 0;
  document.getElementById('btn-pk-next').disabled = pickerState.offset + pickerState.limit >= pickerState.total;
}

// 对外暴露：打开卡片选择器
// secondType: 预设二级类型筛选（与商品 goods_type 对齐：背景/颜色/套装/相框）
// onPick: 选中卡片后回调，参数为 {card_id, card_name}
function openCardPicker(secondType, onPick) {
  pickerState.filter.card_second_type = secondType || 0;
  pickerState.filter.card_name = '';
  pickerState.offset = 0;
  pickerState.onPick = onPick;
  document.getElementById('pk-second-type').value = String(secondType || 0);
  document.getElementById('pk-name').value = '';
  appOpenModal('modal-picker');
  loadPicker();
}

// ========== 模块初始化（事件绑定）==========

function initCards() {
  // 新建
  document.getElementById('btn-create-card').addEventListener('click', () => {
    document.getElementById('card-form').reset();
    document.getElementById('f-card-id').value = '';
    document.getElementById('modal-card-title').textContent = '新建卡券';
    // 清空图片预览
    document.getElementById('preview-url-preview').innerHTML = '';
    document.getElementById('preview-url-locked-preview').innerHTML = '';
    document.getElementById('big-image-url-preview').innerHTML = '';
    appOpenModal('modal-card');
  });

  // 图片 URL 输入框变化时更新预览
  ['f-card-preview-url', 'f-card-preview-url-locked', 'f-card-big-image-url'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCardImagePreviews);
  });

  // 表单提交
  document.getElementById('card-form').addEventListener('submit', submitCardForm);
  document.getElementById('btn-upload-preview').addEventListener('click', async () => {
    try {
      await handleCardImageUpload('f-card-preview-file', 'f-card-preview-url', '已获得图片');
      updateCardImagePreviews();
    } catch (err) {
      appToast('上传失败：' + err.message, 'error');
    }
  });
  document.getElementById('btn-upload-preview-locked').addEventListener('click', async () => {
    try {
      await handleCardImageUpload('f-card-preview-file-locked', 'f-card-preview-url-locked', '未获得图片');
      updateCardImagePreviews();
    } catch (err) {
      appToast('上传失败：' + err.message, 'error');
    }
  });
  document.getElementById('btn-upload-big-image').addEventListener('click', async () => {
    try {
      await handleCardImageUpload('f-card-big-image-file', 'f-card-big-image-url', '图片大图');
      updateCardImagePreviews();
    } catch (err) {
      appToast('上传失败：' + err.message, 'error');
    }
  });

  // 行操作：编辑/删除
  document.getElementById('card-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'edit') openCardEditModal(id);
    if (action === 'delete') deleteCard(id);
  });

  // 查询 / 重置
  document.getElementById('btn-card-search').addEventListener('click', () => {
    cardState.filter.card_first_type = document.getElementById('f-first-type').value;
    cardState.filter.card_second_type = document.getElementById('f-second-type').value;
    cardState.filter.card_status = document.getElementById('f-status').value;
    cardState.filter.card_name = document.getElementById('f-name').value.trim();
    cardState.offset = 0;
    loadCardList();
  });
  document.getElementById('btn-card-reset').addEventListener('click', () => {
    document.getElementById('f-first-type').value = '0';
    document.getElementById('f-second-type').value = '0';
    document.getElementById('f-status').value = '0';
    document.getElementById('f-name').value = '';
    cardState.filter = { card_first_type: 0, card_second_type: 0, card_status: 0, card_name: '' };
    cardState.offset = 0;
    loadCardList();
  });

  // 分页
  document.getElementById('btn-card-prev').addEventListener('click', () => {
    if (cardState.offset <= 0) return;
    cardState.offset = Math.max(0, cardState.offset - cardState.limit);
    loadCardList();
  });
  document.getElementById('btn-card-next').addEventListener('click', () => {
    if (cardState.offset + cardState.limit >= cardState.total) return;
    cardState.offset += cardState.limit;
    loadCardList();
  });
  document.getElementById('card-page-size').addEventListener('change', (e) => {
    cardState.limit = Number(e.target.value);
    cardState.offset = 0;
    loadCardList();
  });

  // 选择器事件
  document.getElementById('btn-pk-search').addEventListener('click', () => {
    pickerState.filter.card_second_type = document.getElementById('pk-second-type').value;
    pickerState.filter.card_name = document.getElementById('pk-name').value.trim();
    pickerState.offset = 0;
    loadPicker();
  });
  document.getElementById('btn-pk-prev').addEventListener('click', () => {
    if (pickerState.offset <= 0) return;
    pickerState.offset = Math.max(0, pickerState.offset - pickerState.limit);
    loadPicker();
  });
  document.getElementById('btn-pk-next').addEventListener('click', () => {
    if (pickerState.offset + pickerState.limit >= pickerState.total) return;
    pickerState.offset += pickerState.limit;
    loadPicker();
  });
  // 选中卡片：事件委托
  document.getElementById('pk-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pick-id]');
    if (!btn) return;
    const card = { card_id: btn.dataset.pickId, card_name: btn.dataset.pickName };
    if (typeof pickerState.onPick === 'function') {
      pickerState.onPick(card);
    }
    appCloseModal('modal-picker');
  });
}

window.Cards = { initCards, loadCardList, openCardPicker };

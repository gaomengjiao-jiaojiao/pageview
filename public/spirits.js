// 精灵管理：精灵 CRUD + 关联卡牌选择器
(function () {
  const { post: appPost, toast: appToast, esc, openModal: appOpenModal, closeModal: appCloseModal } = window.App;

  const API = {
    CREATE: '/api/operation/api/spirit/create_spirit',
    UPDATE: '/api/operation/api/spirit/update_spirit',
    DELETE: '/api/operation/api/spirit/delete_spirit',
    GET: '/api/operation/api/spirit/get_spirit',
    LIST: '/api/operation/api/spirit/list_spirits',
    CARDS: '/api/operation/api/lesson_game/list_game_cards',
    COS: '/api/operation/api/cos/get_permission',
  };

  const state = {
    offset: 0,
    limit: 20,
    total: 0,
    filter: { name: '', status: 0 },
    cards: [],
    editingSpiritId: '0',
  };

  const statusText = { 1: '启用', 2: '禁用' };
  const statusClass = { 1: 'tag-on', 2: 'tag-off' };

  function formatTime(value) {
    if (!value) return '-';
    const date = new Date(Number(value) * 1000);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false });
  }

  // 详情接口返回完整 URL，提交时只回传 COS 对象路径，避免把签名/域名地址原样写回。
  function toCosObjectPath(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    try {
      const parsed = new URL(text);
      return parsed.pathname || text;
    } catch (_) {
      return text;
    }
  }

  function getExt(name) {
    const index = String(name || '').lastIndexOf('.');
    return index >= 0 ? String(name).slice(index + 1).toLowerCase() : 'bin';
  }

  async function uploadAsset(fileInputId, targetInputId, label) {
    const file = document.getElementById(fileInputId).files[0];
    if (!file) {
      appToast(`请先选择${label}文件`, 'error');
      return;
    }
    try {
      const ext = getExt(file.name);
      const path = `/resource/incentive/spirit/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const permission = await appPost(API.COS, {
        file_type: 'spirit',
        file_ext: ext,
        file_path: path,
        operation_type: 1,
        bucket_type: 1,
      });
      const signedUrl = permission.data && permission.data.signed_url;
      if (!signedUrl) throw new Error('获取 COS 上传地址失败');
      const response = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!response.ok) throw new Error(`上传失败：HTTP ${response.status}`);
      document.getElementById(targetInputId).value = path;
      appToast(`${label}上传成功`);
    } catch (error) {
      appToast(error.message, 'error');
    }
  }

  async function loadSpiritList() {
    const body = {
      spirit_name: state.filter.name.trim(),
      status: Number(state.filter.status) || 0,
      pagination: { offset: state.offset, limit: state.limit },
    };
    const tbody = document.getElementById('spirit-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="empty">加载中...</td></tr>';
    try {
      const response = await appPost(API.LIST, body);
      const data = response.data || {};
      state.total = Number(data.page_info && data.page_info.total_count) || 0;
      renderSpiritList(data.list || []);
      renderPageInfo();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">${esc(error.message)}</td></tr>`;
    }
  }

  function renderSpiritList(list) {
    const tbody = document.getElementById('spirit-tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">暂无数据</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((item) => {
      const status = Number(item.status);
      const image = item.spirit_image_url
        ? `<img class="preview-img" src="${esc(item.spirit_image_url)}" alt="${esc(item.spirit_name)}" />`
        : '<span class="hint">无图片</span>';
      return `<tr>
        <td>${esc(item.spirit_id)}</td>
        <td>${image}</td>
        <td><strong>${esc(item.spirit_name)}</strong></td>
        <td>${esc(item.spirit_hp_factor)}%</td>
        <td><span class="tag ${statusClass[status] || 'tag-warn'}">${statusText[status] || `状态 ${status}`}</span></td>
        <td>${esc(item.card_count || 0)}</td>
        <td>${esc(formatTime(item.updated_at))}</td>
        <td class="row-actions">
          <button class="btn" data-spirit-action="edit" data-id="${esc(item.spirit_id)}">编辑</button>
          <button class="btn btn-danger" data-spirit-action="delete" data-id="${esc(item.spirit_id)}" data-name="${esc(item.spirit_name)}">删除</button>
        </td>
      </tr>`;
    }).join('');
  }

  function renderPageInfo() {
    const current = Math.floor(state.offset / state.limit) + 1;
    const pages = Math.max(1, Math.ceil(state.total / state.limit));
    document.getElementById('spirit-page-info').textContent = `第 ${current} / ${pages} 页，共 ${state.total} 条`;
    document.getElementById('btn-spirit-prev').disabled = current <= 1;
    document.getElementById('btn-spirit-next').disabled = current >= pages;
  }

  async function loadCards() {
    if (state.cards.length) return;
    try {
      const response = await appPost(API.CARDS, { rarity: 0, card_first_type: 0, card_second_type: 0, element: 0 });
      state.cards = (response.data && response.data.list) || [];
    } catch (error) {
      appToast(`加载卡牌失败：${error.message}`, 'error');
    }
  }

  function renderCardPicker(selectedIds) {
    const selected = new Set((selectedIds || []).map(String));
    const currentId = String(state.editingSpiritId);
    const tbody = document.getElementById('spirit-card-tbody');
    if (!state.cards.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">暂无可选卡牌</td></tr>';
      return;
    }
    tbody.innerHTML = state.cards.map((card) => {
      const id = String(card.card_id);
      const occupied = String(card.spirit_id || '0') !== '0' && String(card.spirit_id) !== currentId;
      return `<tr class="${occupied ? 'disabled-row' : ''}">
        <td><input type="checkbox" class="spirit-card-checkbox" value="${esc(id)}" ${selected.has(id) ? 'checked' : ''} ${occupied ? 'disabled' : ''}></td>
        <td>${esc(id)}</td><td>${esc(card.card_name)}</td><td>${esc(card.rarity)}</td><td>${esc(card.element)}${occupied ? ` <span class="hint">已关联精灵 ${esc(card.spirit_id)}</span>` : ''}</td>
      </tr>`;
    }).join('');
  }

  function resetSpiritForm() {
    state.editingSpiritId = '0';
    document.getElementById('spirit-form').reset();
    document.getElementById('spirit-form-id').value = '';
    document.getElementById('spirit-hp').value = '100';
    document.getElementById('spirit-status').value = '1';
    document.getElementById('modal-spirit-title').textContent = '新建精灵';
    document.getElementById('spirit-card-tbody').innerHTML = '<tr><td colspan="5" class="empty">加载中...</td></tr>';
  }

  async function openSpiritModal(spiritId) {
    resetSpiritForm();
    if (spiritId) {
      state.editingSpiritId = String(spiritId);
      document.getElementById('modal-spirit-title').textContent = '编辑精灵';
      try {
        const response = await appPost(API.GET, { spirit_id: String(spiritId) });
        const spirit = response.data && response.data.spirit;
        if (!spirit) throw new Error('精灵详情为空');
        document.getElementById('spirit-form-id').value = spirit.spirit_id || '';
        document.getElementById('spirit-name').value = spirit.spirit_name || '';
        document.getElementById('spirit-image').value = toCosObjectPath(spirit.spirit_image_url);
        document.getElementById('spirit-hp').value = spirit.spirit_hp_factor ?? 100;
        document.getElementById('spirit-status').value = spirit.status || 1;
        document.getElementById('spirit-remark').value = spirit.remark || '';
        const ext = spirit.ext_config || {};
        document.getElementById('spirit-avatar-image').value = toCosObjectPath(ext.avatar_image_url);
        document.getElementById('spirit-bg-image').value = toCosObjectPath(ext.bg_image_url);
        document.getElementById('spirit-ultimate-res').value = toCosObjectPath(ext.ultimate_res_url);
        await loadCards();
        renderCardPicker((spirit.cards || []).map((card) => card.card_id));
      } catch (error) {
        appToast(error.message, 'error');
        return;
      }
    } else {
      await loadCards();
      renderCardPicker([]);
    }
    appOpenModal('modal-spirit');
  }

  function collectSpiritBody() {
    const name = document.getElementById('spirit-name').value.trim();
    const hp = Number(document.getElementById('spirit-hp').value);
    if (!name) throw new Error('请输入精灵名称');
    if (!Number.isInteger(hp) || hp < 0 || hp > 200) throw new Error('血量系数须为 0~200 的整数');
    const cardIds = Array.from(document.querySelectorAll('.spirit-card-checkbox:checked')).map((input) => input.value);
    const body = {
      spirit_name: name,
      spirit_image_url: document.getElementById('spirit-image').value.trim(),
      spirit_hp_factor: hp,
      ext_config: {
        avatar_image_url: document.getElementById('spirit-avatar-image').value.trim(),
        bg_image_url: document.getElementById('spirit-bg-image').value.trim(),
        ultimate_res_url: document.getElementById('spirit-ultimate-res').value.trim(),
      },
      status: Number(document.getElementById('spirit-status').value) || 1,
      remark: document.getElementById('spirit-remark').value.trim(),
      card_ids: cardIds,
    };
    const id = document.getElementById('spirit-form-id').value.trim();
    if (id) body.spirit_id = id;
    return body;
  }

  async function submitSpiritForm(event) {
    event.preventDefault();
    try {
      const body = collectSpiritBody();
      await appPost(body.spirit_id ? API.UPDATE : API.CREATE, body);
      appCloseModal('modal-spirit');
      appToast(body.spirit_id ? '精灵已更新' : '精灵已创建');
      loadSpiritList();
    } catch (error) {
      appToast(error.message, 'error');
    }
  }

  async function deleteSpirit(id, name) {
    if (!window.confirm(`确定删除精灵“${name}”吗？删除后会清除卡牌关联。`)) return;
    try {
      await appPost(API.DELETE, { spirit_id: String(id) });
      appToast('精灵已删除');
      loadSpiritList();
    } catch (error) {
      appToast(error.message, 'error');
    }
  }

  function initSpirits() {
    document.getElementById('btn-create-spirit').addEventListener('click', () => openSpiritModal());
    document.getElementById('btn-spirit-search').addEventListener('click', () => {
      state.filter.name = document.getElementById('spirit-filter-name').value;
      state.filter.status = document.getElementById('spirit-filter-status').value;
      state.offset = 0;
      loadSpiritList();
    });
    document.getElementById('btn-spirit-reset').addEventListener('click', () => {
      document.getElementById('spirit-filter-name').value = '';
      document.getElementById('spirit-filter-status').value = '0';
      state.filter = { name: '', status: 0 };
      state.offset = 0;
      loadSpiritList();
    });
    document.getElementById('btn-spirit-prev').addEventListener('click', () => {
      state.offset = Math.max(0, state.offset - state.limit);
      loadSpiritList();
    });
    document.getElementById('btn-spirit-next').addEventListener('click', () => {
      if (state.offset + state.limit < state.total) state.offset += state.limit;
      loadSpiritList();
    });
    document.getElementById('spirit-page-size').addEventListener('change', (event) => {
      state.limit = Number(event.target.value) || 20;
      state.offset = 0;
      loadSpiritList();
    });
    document.getElementById('spirit-tbody').addEventListener('click', (event) => {
      const button = event.target.closest('[data-spirit-action]');
      if (!button) return;
      if (button.dataset.spiritAction === 'edit') openSpiritModal(button.dataset.id);
      if (button.dataset.spiritAction === 'delete') deleteSpirit(button.dataset.id, button.dataset.name);
    });
    document.getElementById('spirit-form').addEventListener('submit', submitSpiritForm);
    document.getElementById('btn-upload-spirit-image').addEventListener('click', () => uploadAsset('spirit-image-file', 'spirit-image', '精灵主体图'));
    document.getElementById('btn-upload-spirit-avatar').addEventListener('click', () => uploadAsset('spirit-avatar-file', 'spirit-avatar-image', '头像图'));
    document.getElementById('btn-upload-spirit-bg').addEventListener('click', () => uploadAsset('spirit-bg-file', 'spirit-bg-image', '背景图'));
    document.getElementById('btn-upload-spirit-ultimate').addEventListener('click', () => uploadAsset('spirit-ultimate-file', 'spirit-ultimate-res', '大招素材'));
  }

  window.Spirits = { initSpirits, loadSpiritList, openSpiritModal };
})();

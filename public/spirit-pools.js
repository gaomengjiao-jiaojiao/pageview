// 精灵池管理：精灵/卡牌池配置，以及精灵池与课次的全量绑定
(function () {
  const { post: appPost, toast: appToast, esc, openModal: appOpenModal, closeModal: appCloseModal } = window.App;
  const API = {
    LIST: '/api/operation/api/lesson_game/list_spirit_pools',
    GET: '/api/operation/api/lesson_game/get_spirit_pool',
    SAVE: '/api/operation/api/lesson_game/create_or_update_spirit_pool',
    BIND: '/api/operation/api/lesson_game/bind_spirit_pool_courses',
    LIST_BIND: '/api/operation/api/lesson_game/list_spirit_pool_courses',
    SPIRITS: '/api/operation/api/spirit/list_spirits',
    CARDS: '/api/operation/api/lesson_game/list_game_cards',
  };

  const state = {
    page: 1,
    pageSize: 20,
    total: 0,
    spiritPage: 1,
    spirits: [],
    cards: [],
    editingPoolId: '0',
    bindPoolId: '0',
    bindPage: 1,
    bindTotal: 0,
  };

  function normalizeId(value) { return String(value || '').trim() || '0'; }
  function formatTime(value) {
    if (!value) return '-';
    const date = new Date(Number(value) * 1000);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false });
  }

  async function loadOptions() {
    // 精灵可能刚在“精灵管理”中新增，打开配置弹窗时必须重新拉取，不能只依赖首次打开时的内存缓存。
    const [spiritResponse, cardResponse] = await Promise.all([
      appPost(API.SPIRITS, { spirit_name: '', status: 0, pagination: { offset: 0, limit: 500 } }),
      appPost(API.CARDS, { rarity: 0, card_first_type: 0, card_second_type: 0, element: 0 }),
    ]);
    state.spirits = (spiritResponse.data && spiritResponse.data.list) || [];
    state.cards = (cardResponse.data && cardResponse.data.list) || [];
  }

  async function loadPoolList() {
    const tbody = document.getElementById('pool-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="empty">加载中...</td></tr>';
    const body = {
      page: state.page,
      page_size: state.pageSize,
      name: document.getElementById('pool-filter-name').value.trim(),
      pool_id: normalizeId(document.getElementById('pool-filter-id').value),
      course_id: normalizeId(document.getElementById('pool-filter-course-id').value),
      lesson_id: normalizeId(document.getElementById('pool-filter-lesson-id').value),
    };
    try {
      const response = await appPost(API.LIST, body);
      const data = response.data || {};
      state.total = Number(data.total_count) || 0;
      renderPoolList(data.list || []);
      renderPoolPageInfo();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">${esc(error.message)}</td></tr>`;
    }
  }

  function renderPoolList(list) {
    const tbody = document.getElementById('pool-tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无数据</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((item) => `<tr>
      <td>${esc(item.pool_id)}</td><td><strong>${esc(item.name)}</strong></td>
      <td>${esc(item.description)}</td><td>${esc(item.spirit_count || 0)}</td>
      <td>${esc(item.card_count || 0)}</td><td>${esc(formatTime(item.created_at))}</td>
      <td class="row-actions"><button class="btn" data-pool-action="edit" data-id="${esc(item.pool_id)}">编辑</button><button class="btn" data-pool-action="bind" data-id="${esc(item.pool_id)}">配置课次</button></td>
    </tr>`).join('');
  }

  function renderPoolPageInfo() {
    const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
    document.getElementById('pool-page-info').textContent = `第 ${state.page} / ${pages} 页，共 ${state.total} 条`;
    document.getElementById('btn-pool-prev').disabled = state.page <= 1;
    document.getElementById('btn-pool-next').disabled = state.page >= pages;
  }

  function spiritOptions(selected) {
    return ['<option value="">请选择精灵</option>'].concat(state.spirits.map((spirit) => `<option value="${esc(spirit.spirit_id)}" ${String(spirit.spirit_id) === String(selected) ? 'selected' : ''}>${esc(spirit.spirit_name || '未命名精灵')}（${esc(spirit.spirit_id)}）</option>`)).join('');
  }

  function refreshPoolRowCards(row, selectedIds) {
    const spiritId = row.querySelector('.pool-spirit-select').value;
    const selected = new Set((selectedIds || []).map(String));
    const cards = state.cards.filter((card) => String(card.spirit_id || '0') === String(spiritId));
    const container = row.querySelector('.pool-card-checks');
    if (!spiritId) {
      container.innerHTML = '<span class="hint">请先选择精灵</span>';
      return;
    }
    if (!cards.length) {
      container.innerHTML = '<span class="hint">该精灵暂无已关联卡牌</span>';
      return;
    }
    container.innerHTML = cards.map((card) => `<label><input type="checkbox" value="${esc(card.card_id)}" ${selected.has(String(card.card_id)) ? 'checked' : ''}> ${esc(card.card_name)}（${esc(card.card_id)}）</label>`).join('');
  }

  function createPoolRow(item) {
    const row = document.createElement('div');
    row.className = 'pool-spirit-row';
    row.innerHTML = `<div class="pool-spirit-head"><select class="pool-spirit-select">${spiritOptions(item && item.spirit_id)}</select><button type="button" class="btn btn-danger pool-remove-row">移除精灵</button></div><div class="pool-card-checks check-list"></div>`;
    row.querySelector('.pool-spirit-select').addEventListener('change', () => refreshPoolRowCards(row, []));
    row.querySelector('.pool-remove-row').addEventListener('click', () => row.remove());
    refreshPoolRowCards(row, item && (item.cards || []).map((card) => card.card_id));
    return row;
  }

  function renderPoolRows(items) {
    const container = document.getElementById('pool-spirit-rows');
    container.innerHTML = '';
    (items || []).forEach((item) => container.appendChild(createPoolRow(item)));
  }

  function resetPoolForm() {
    state.editingPoolId = '0';
    document.getElementById('pool-form').reset();
    document.getElementById('pool-form-id').value = '';
    document.getElementById('modal-pool-title').textContent = '新建精灵池';
    renderPoolRows([]);
  }

  async function openPoolModal(poolId) {
    resetPoolForm();
    try {
      await loadOptions();
      if (poolId) {
        state.editingPoolId = String(poolId);
        const response = await appPost(API.GET, { pool_id: String(poolId) });
        const detail = response.data || {};
        document.getElementById('modal-pool-title').textContent = '编辑精灵池';
        document.getElementById('pool-form-id').value = detail.pool_id || poolId;
        document.getElementById('pool-name').value = detail.name || '';
        document.getElementById('pool-description').value = detail.description || '';
        renderPoolRows(detail.spirits || []);
      } else {
        renderPoolRows([]);
      }
      appOpenModal('modal-spirit-pool');
    } catch (error) {
      appToast(`加载精灵池配置失败：${error.message}`, 'error');
    }
  }

  function collectPoolBody() {
    const name = document.getElementById('pool-name').value.trim();
    if (!name) throw new Error('请输入精灵池名称');
    const spirits = Array.from(document.querySelectorAll('.pool-spirit-row')).map((row) => ({
      spirit_id: row.querySelector('.pool-spirit-select').value,
      card_ids: Array.from(row.querySelectorAll('.pool-card-checks input:checked')).map((input) => input.value),
    })).filter((item) => item.spirit_id);
    const uniqueIds = new Set(spirits.map((item) => item.spirit_id));
    if (uniqueIds.size < 3) throw new Error('精灵池至少需要 3 个不同精灵');
    if (spirits.some((item) => item.card_ids.length < 1)) throw new Error('每个精灵至少选择 1 张卡牌');
    return {
      pool_id: normalizeId(document.getElementById('pool-form-id').value),
      name,
      description: document.getElementById('pool-description').value.trim(),
      spirits,
    };
  }

  async function submitPoolForm(event) {
    event.preventDefault();
    try {
      const body = collectPoolBody();
      await appPost(API.SAVE, body);
      appCloseModal('modal-spirit-pool');
      appToast(body.pool_id === '0' ? '精灵池已创建' : '精灵池已更新');
      loadPoolList();
    } catch (error) {
      appToast(error.message, 'error');
    }
  }

  function addPoolRow() {
    const row = createPoolRow();
    document.getElementById('pool-spirit-rows').appendChild(row);
  }

  function courseRow(item) {
    const row = document.createElement('div');
    row.className = 'course-bind-row';
    row.innerHTML = `<input class="bind-course-id" type="text" placeholder="课程 ID" value="${esc(item && item.course_id || '')}"><input class="bind-lesson-id" type="text" placeholder="课次 ID" value="${esc(item && item.lesson_id || '')}"><span class="course-bind-name">${esc(item && (item.course_name || item.lesson_name) || '')}</span><button type="button" class="btn btn-danger bind-remove-row">移除</button>`;
    row.querySelector('.bind-remove-row').addEventListener('click', () => row.remove());
    return row;
  }

  async function openBindModal(poolId) {
    try {
      const response = await appPost(API.GET, { pool_id: String(poolId) });
      const detail = response.data || {};
      state.bindPoolId = String(poolId);
      document.getElementById('bind-pool-title').textContent = `配置课次：${detail.name || poolId}`;
      document.getElementById('bind-pool-id').textContent = poolId;
      const container = document.getElementById('course-bind-rows');
      container.innerHTML = '';
      (detail.courses || []).forEach((course) => container.appendChild(courseRow(course)));
      appOpenModal('modal-pool-bind');
    } catch (error) {
      appToast(error.message, 'error');
    }
  }

  async function submitBindForm(event) {
    event.preventDefault();
    const courses = Array.from(document.querySelectorAll('.course-bind-row')).map((row) => ({
      course_id: normalizeId(row.querySelector('.bind-course-id').value),
      lesson_id: normalizeId(row.querySelector('.bind-lesson-id').value),
    })).filter((item) => item.course_id !== '0' && item.lesson_id !== '0');
    try {
      await appPost(API.BIND, { pool_id: state.bindPoolId, courses });
      appCloseModal('modal-pool-bind');
      appToast(`已保存 ${courses.length} 个课次关联`);
      loadPoolList();
      loadBindList();
    } catch (error) {
      appToast(error.message, 'error');
    }
  }

  async function loadBindList() {
    const tbody = document.getElementById('pool-bind-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="empty">加载中...</td></tr>';
    const body = {
      page: state.bindPage,
      page_size: 20,
      pool_id: normalizeId(document.getElementById('bind-filter-pool-id').value),
      course_id: normalizeId(document.getElementById('bind-filter-course-id').value),
      lesson_id: normalizeId(document.getElementById('bind-filter-lesson-id').value),
    };
    try {
      const response = await appPost(API.LIST_BIND, body);
      const data = response.data || {};
      state.bindTotal = Number(data.total_count) || 0;
      const list = data.list || [];
      tbody.innerHTML = list.length ? list.map((item) => `<tr><td>${esc(item.pool_id)}</td><td>${esc(item.pool_name)}</td><td>${esc(item.course_id)}</td><td>${esc(item.course_no)}</td><td>${esc(item.course_name)}</td><td>${esc(item.lesson_id)}</td><td>${esc(item.lesson_name)}</td><td>${esc(item.lesson_type)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">暂无数据</td></tr>';
      const pages = Math.max(1, Math.ceil(state.bindTotal / 20));
      document.getElementById('pool-bind-page-info').textContent = `第 ${state.bindPage} / ${pages} 页，共 ${state.bindTotal} 条`;
      document.getElementById('btn-bind-prev').disabled = state.bindPage <= 1;
      document.getElementById('btn-bind-next').disabled = state.bindPage >= pages;
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">${esc(error.message)}</td></tr>`;
    }
  }

  function initSpiritPools() {
    document.getElementById('btn-create-pool').addEventListener('click', () => openPoolModal());
    document.getElementById('btn-pool-search').addEventListener('click', () => { state.page = 1; loadPoolList(); });
    document.getElementById('btn-pool-reset').addEventListener('click', () => {
      ['pool-filter-name', 'pool-filter-id', 'pool-filter-course-id', 'pool-filter-lesson-id'].forEach((id) => { document.getElementById(id).value = ''; });
      state.page = 1; loadPoolList();
    });
    document.getElementById('btn-pool-prev').addEventListener('click', () => { if (state.page > 1) { state.page -= 1; loadPoolList(); } });
    document.getElementById('btn-pool-next').addEventListener('click', () => { if (state.page < Math.ceil(state.total / state.pageSize)) { state.page += 1; loadPoolList(); } });
    document.getElementById('pool-page-size').addEventListener('change', (event) => { state.pageSize = Number(event.target.value) || 20; state.page = 1; loadPoolList(); });
    document.getElementById('pool-tbody').addEventListener('click', (event) => {
      const button = event.target.closest('[data-pool-action]');
      if (!button) return;
      if (button.dataset.poolAction === 'edit') openPoolModal(button.dataset.id);
      if (button.dataset.poolAction === 'bind') openBindModal(button.dataset.id);
    });
    document.getElementById('pool-form').addEventListener('submit', submitPoolForm);
    document.getElementById('btn-add-pool-spirit').addEventListener('click', addPoolRow);
    document.getElementById('pool-bind-form').addEventListener('submit', submitBindForm);
    document.getElementById('btn-add-course-bind').addEventListener('click', () => document.getElementById('course-bind-rows').appendChild(courseRow()));
    document.getElementById('btn-bind-search').addEventListener('click', () => { state.bindPage = 1; loadBindList(); });
    document.getElementById('btn-bind-reset').addEventListener('click', () => { ['bind-filter-pool-id', 'bind-filter-course-id', 'bind-filter-lesson-id'].forEach((id) => { document.getElementById(id).value = ''; }); state.bindPage = 1; loadBindList(); });
    document.getElementById('btn-bind-prev').addEventListener('click', () => { if (state.bindPage > 1) { state.bindPage -= 1; loadBindList(); } });
    document.getElementById('btn-bind-next').addEventListener('click', () => { if (state.bindPage < Math.ceil(state.bindTotal / 20)) { state.bindPage += 1; loadBindList(); } });
    document.querySelectorAll('[data-pool-tab]').forEach((tab) => tab.addEventListener('click', () => {
      document.querySelectorAll('[data-pool-tab]').forEach((item) => item.classList.toggle('active', item === tab));
      document.getElementById('pool-list-panel').classList.toggle('hidden', tab.dataset.poolTab !== 'pools');
      document.getElementById('pool-bind-panel').classList.toggle('hidden', tab.dataset.poolTab !== 'binds');
      if (tab.dataset.poolTab === 'binds') loadBindList();
    }));
  }

  window.SpiritPools = { initSpiritPools, loadPoolList, loadBindList, openPoolModal };
})();

// 超时空对话 - 历史人物配置
// 列表查询、新建/编辑（含头像、资源包、知识库文件上传到 COS）、删除
//
// 文件上传走老接口 /operation/api/cos/get_permission：
//   1. 请求签名 URL（operation_type=1 上传）
//   2. 前端 PUT 直传 COS，文件流不经后端
//   3. 表单里只提交 COS key，不提交完整 URL
//
// 整个模块包在 IIFE 里：本项目的模块都是普通 script，共享同一个全局作用域，
// 顶层 const 重名（如 appPost、APP_CONFIG）会直接 SyntaxError 让整个文件失效，
// 还会连带 app.js 抛错、所有页面路由失效。包一层彻底杜绝这类冲突。
(function () {
  'use strict';

  const {
    post: appPost,
    toast: appToast,
    esc: appEsc,
    openModal: appOpenModal,
    closeModal: appCloseModal,
  } = window.App;

  const API = {
    CREATE: '/api/operation/api/timechat/character/create',
    UPDATE: '/api/operation/api/timechat/character/update',
    DELETE: '/api/operation/api/timechat/character/delete',
    GET: '/api/operation/api/timechat/character/get',
    LIST: '/api/operation/api/timechat/character/list',
    COS_PERMISSION: '/api/operation/api/cos/get_permission',
  };

  const APP_CONFIG = window.__APP_CONFIG__ || {};

  // 知识库解析状态，与后端 timechat_character.kb_status 对应
  const KB_STATUS_LABEL = { 0: '待解析', 1: '解析中', 2: '已完成', 3: '解析失败' };
  const KB_STATUS_CLASS = { 0: 'tag-info', 1: 'tag-warn', 2: 'tag-on', 3: 'tag-off' };

  // 三类资源：表单字段 id、上传用的 file_type、可选文件类型
  const RESOURCE_KINDS = {
    avatar: {
      label: '人物图片',
      fileType: 'character_avatar',
      fieldId: 'f-tc-avatar',
    },
    res_pack: {
      label: '资源包',
      fileType: 'character_res_pack',
      fieldId: 'f-tc-res-pack',
    },
    knowledge: {
      label: '知识库文件',
      fileType: 'character_knowledge',
      fieldId: 'f-tc-knowledge',
    },
  };

  const state = {
    page: 1,
    pageSize: 20,
    total: 0,
    filter: { character_name: '', dynasty: '' },
    // 编辑中的人物 ID，为空表示新建
    editingId: '',
    // 课程解锁配置全量列表：[{ course_id, lesson_id, course_name, lesson_name }]
    courseConfigs: [],
    // 推荐问题全量列表：[{ id, content }]，id 为空表示新增
    recommendedQuestions: [],
    // 上传中的资源类型，用于禁用按钮防重复点击
    uploading: {},
  };

  // ========== 工具 ==========

  function getExtFromName(name) {
    const idx = String(name || '').lastIndexOf('.');
    if (idx < 0 || idx === name.length - 1) return '';
    const ext = name.slice(idx + 1).toLowerCase();
    return /^[a-z0-9]+$/.test(ext) ? ext : '';
  }

  // 当天日期，格式 yyyy-mm-dd
  function today() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // 拼接 COS 对象 key：前缀 + yyyy-mm-dd/ + 毫秒时间戳 + 扩展名
  // 带扩展名是为了让 COS 返回正确的 Content-Type，否则图片在浏览器里会变成下载
  function buildObjectKey(kind, file) {
    const prefixes = APP_CONFIG.TIMECHAT_COS_KEY_PREFIX || {};
    const prefix = String(prefixes[kind] || `/resource/character/${kind}/`).replace(/\/+$/, '') + '/';
    const ext = getExtFromName(file.name);
    return `${prefix}${today()}/${ext ? `${Date.now()}.${ext}` : Date.now()}`;
  }

  // 取 COS 签名地址。operationType: 1=上传，2=下载
  async function requestCosPermission(kind, filePath, operationType, fileExt) {
    const resp = await appPost(API.COS_PERMISSION, {
      file_type: (RESOURCE_KINDS[kind] || {}).fileType || kind,
      file_ext: fileExt || '',
      file_path: filePath,
      operation_type: operationType,
      bucket_type: 1,
    });
    return (resp && resp.data) || {};
  }

  // 上传文件到 COS，返回落库用的对象 key
  async function uploadToCos(kind, file) {
    const objectKey = buildObjectKey(kind, file);
    const data = await requestCosPermission(kind, objectKey, 1, getExtFromName(file.name));
    if (!data.signed_url) throw new Error('获取 COS 上传地址失败');

    const putResp = await fetch(data.signed_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!putResp.ok) {
      const text = await putResp.text();
      throw new Error(`上传 COS 失败：HTTP ${putResp.status} ${text || ''}`.trim());
    }
    return objectKey;
  }

  // 表单里既可能是接口返回的完整 URL，也可能是刚上传的 key。
  // 预览时完整 URL 直接用；key 需要换一个带签名的读取地址。
  async function resolvePreviewUrl(kind, value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    try {
      const data = await requestCosPermission(kind, raw, 2);
      return data.signed_read_url || data.signed_url || '';
    } catch (e) {
      return '';
    }
  }

  // 资源预览：头像显示图片，其余显示文件名
  async function refreshResourcePreview(kind) {
    const el = document.getElementById(`tc-preview-${kind}`);
    if (!el) return;

    const value = document.getElementById(RESOURCE_KINDS[kind].fieldId).value.trim();
    if (!value) {
      el.innerHTML = kind === 'avatar' ? '' : '<span class="hint">未上传</span>';
      return;
    }
    if (kind !== 'avatar') {
      el.innerHTML = `<span class="tag tag-info">${appEsc(value.split('/').pop())}</span>`;
      return;
    }

    el.innerHTML = '<span class="hint">加载中…</span>';
    const url = await resolvePreviewUrl(kind, value);
    if (!url) {
      el.innerHTML = `<span class="hint">已上传：${appEsc(value.split('/').pop())}</span>`;
      return;
    }
    el.innerHTML =
      `<img class="preview-img" src="${appEsc(url)}" alt="头像预览" ` +
      `onerror="this.parentElement.innerHTML='<span class=\\'img-error\\'>图片加载失败</span>'" />`;
  }

  async function handleUpload(kind, fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      appToast('请先选择文件', 'error');
      return;
    }
    if (state.uploading[kind]) return;

    state.uploading[kind] = true;
    const btn = document.getElementById(`btn-tc-upload-${kind}`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = '上传中…';
    }

    try {
      const objectKey = await uploadToCos(kind, file);
      document.getElementById(RESOURCE_KINDS[kind].fieldId).value = objectKey;
      await refreshResourcePreview(kind);
      appToast(`${RESOURCE_KINDS[kind].label}上传成功`, 'success');
    } catch (err) {
      appToast(err.message || '上传失败', 'error');
    } finally {
      state.uploading[kind] = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '上传';
      }
      fileInput.value = '';
      const hint = document.getElementById(`tc-file-hint-${kind}`);
      if (hint) hint.textContent = '';
    }
  }

  // ========== 课程解锁配置 ==========

  function renderCourseRows() {
    const tbody = document.getElementById('tc-course-tbody');
    if (!state.courseConfigs.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty">未配置，该人物不属于任何课程</td></tr>';
      return;
    }
    tbody.innerHTML = state.courseConfigs
      .map((row, index) => {
        const lessonText =
          String(row.lesson_id || '0') === '0' ? '该课程下直接解锁' : row.lesson_name || '—';
        return `
        <tr>
          <td>
            <input class="tc-course-id" data-index="${index}" type="text"
              value="${appEsc(row.course_id)}" placeholder="课程 ID" />
            <div class="hint">${appEsc(row.course_name || '')}</div>
          </td>
          <td>
            <input class="tc-lesson-id" data-index="${index}" type="text"
              value="${appEsc(row.lesson_id || '0')}" placeholder="0=直接解锁" />
            <div class="hint">${appEsc(lessonText)}</div>
          </td>
          <td>
            <button type="button" class="btn btn-ghost tc-course-remove" data-index="${index}">删除</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function syncCourseRowsFromInputs() {
    document.querySelectorAll('.tc-course-id').forEach((input) => {
      const row = state.courseConfigs[Number(input.dataset.index)];
      if (row) row.course_id = input.value.trim();
    });
    document.querySelectorAll('.tc-lesson-id').forEach((input) => {
      const row = state.courseConfigs[Number(input.dataset.index)];
      if (row) row.lesson_id = input.value.trim() || '0';
    });
  }

  function addCourseRow(courseId, lessonId) {
    state.courseConfigs.push({
      course_id: String(courseId || ''),
      lesson_id: String(lessonId || '0'),
      course_name: '',
      lesson_name: '',
    });
    renderCourseRows();
  }

  // ========== 推荐问题 ==========

  function renderQuestionRows() {
    const tbody = document.getElementById('tc-question-tbody');
    if (!state.recommendedQuestions.length) {
      tbody.innerHTML = '<tr><td colspan="2" class="empty">未配置推荐问题</td></tr>';
      return;
    }
    tbody.innerHTML = state.recommendedQuestions
      .map(
        (row, index) => `
        <tr>
          <td>
            <input class="tc-question-content" data-index="${index}" type="text"
              value="${appEsc(row.content)}" placeholder="推荐问题内容" maxlength="256" />
          </td>
          <td>
            <button type="button" class="btn btn-ghost tc-question-remove" data-index="${index}">删除</button>
          </td>
        </tr>`
      )
      .join('');
  }

  function syncQuestionRowsFromInputs() {
    document.querySelectorAll('.tc-question-content').forEach((input) => {
      const row = state.recommendedQuestions[Number(input.dataset.index)];
      if (row) row.content = input.value.trim();
    });
  }

  function addQuestionRow(id, content) {
    state.recommendedQuestions.push({ id: String(id || ''), content: String(content || '') });
    renderQuestionRows();
  }

  // ========== 列表 ==========

  async function loadList() {
    try {
      const resp = await appPost(API.LIST, {
        character_name: state.filter.character_name || '',
        dynasty: state.filter.dynasty || '',
        page: state.page,
        page_size: state.pageSize,
      });
      const data = resp.data || {};
      state.total = data.total_count || 0;
      renderList(data.list || []);
      renderPagination();
    } catch (err) {
      appToast(err.message || '加载列表失败', 'error');
    }
  }

  function renderKbStatus(status, failReason) {
    const label = KB_STATUS_LABEL[status] || '未知';
    const cls = KB_STATUS_CLASS[status] || 'tag-info';
    return `<span class="tag ${cls}" title="${appEsc(failReason || '')}">${appEsc(label)}</span>`;
  }

  function renderCourseConfigs(configs) {
    if (!configs || !configs.length) return '<span class="hint">未配置</span>';
    return configs
      .map((c) => {
        const course = appEsc(c.course_name || c.course_id || '');
        const lesson =
          String(c.lesson_id || '0') === '0' ? '直接解锁' : appEsc(c.lesson_name || c.lesson_id || '');
        return `<div class="detail-row">${course} / ${lesson}</div>`;
      })
      .join('');
  }

  function renderList(list) {
    const tbody = document.getElementById('tc-tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无数据</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map((item) => {
        const avatar = item.avatar_url
          ? `<img class="preview-img" src="${appEsc(item.avatar_url)}" alt="头像" ` +
            `onerror="this.parentElement.innerHTML='<span class=\\'img-error\\'>加载失败</span>'" />`
          : '<span class="hint">-</span>';
        return `
        <tr>
          <td class="card-id-text">${appEsc(item.id)}</td>
          <td>${avatar}</td>
          <td>${appEsc(item.character_name)}</td>
          <td>${appEsc(item.dynasty)}</td>
          <td>${renderKbStatus(item.kb_status, item.kb_fail_reason)}</td>
          <td>${renderCourseConfigs(item.course_configs)}</td>
          <td class="row-actions">
            <button class="btn btn-ghost tc-edit" data-id="${appEsc(item.id)}">编辑</button>
            <button class="btn btn-danger tc-delete" data-id="${appEsc(item.id)}"
              data-name="${appEsc(item.character_name)}">删除</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    document.getElementById('tc-page-info').textContent =
      `第 ${state.page} / ${totalPages} 页，共 ${state.total} 条`;
    document.getElementById('btn-tc-prev').disabled = state.page <= 1;
    document.getElementById('btn-tc-next').disabled = state.page >= totalPages;
  }

  // ========== 表单 ==========

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function resetForm() {
    state.editingId = '';
    state.courseConfigs = [];
    state.recommendedQuestions = [];

    setValue('f-tc-id', '');
    ['f-tc-name', 'f-tc-dynasty', 'f-tc-description', 'f-tc-system-prompt', 'f-tc-greet'].forEach((id) =>
      setValue(id, '')
    );
    Object.keys(RESOURCE_KINDS).forEach((kind) => {
      setValue(RESOURCE_KINDS[kind].fieldId, '');
      setValue(`f-tc-file-${kind}`, '');
      const hint = document.getElementById(`tc-file-hint-${kind}`);
      if (hint) hint.textContent = '';
      const preview = document.getElementById(`tc-preview-${kind}`);
      if (preview) preview.innerHTML = '';
    });

    renderCourseRows();
    renderQuestionRows();
    document.getElementById('modal-tc-title').textContent = '新建历史人物';
    document.getElementById('tc-kb-status').textContent = '';
  }

  function openCreate() {
    resetForm();
    appOpenModal('modal-timechat');
  }

  function renderKbStatusText(status, failReason) {
    const el = document.getElementById('tc-kb-status');
    if (status === undefined || status === null) {
      el.textContent = '';
      return;
    }
    const label = KB_STATUS_LABEL[status] || '未知';
    el.textContent = `知识库解析状态：${label}${failReason ? ` —— ${failReason}` : ''}`;
  }

  async function openEdit(id) {
    resetForm();
    try {
      const resp = await appPost(API.GET, { id: String(id) });
      const detail = (resp.data && resp.data.detail) || {};
      const character = detail.character || {};

      state.editingId = String(character.id || id);
      setValue('f-tc-id', state.editingId);
      setValue('f-tc-name', character.character_name);
      setValue('f-tc-dynasty', character.dynasty);
      setValue('f-tc-description', character.description);
      setValue('f-tc-system-prompt', character.system_prompt);
      setValue('f-tc-greet', character.greet);
      setValue('f-tc-avatar', character.avatar_url);
      setValue('f-tc-res-pack', character.res_pack_url);
      setValue('f-tc-knowledge', character.knowledge_file_url);

      // 课程解锁配置：保留后端返回的展示名称，输入框只让改 ID
      state.courseConfigs = (detail.course_configs || []).map((c) => ({
        course_id: String(c.course_id || ''),
        lesson_id: String(c.lesson_id || '0'),
        course_name: c.course_name || '',
        lesson_name: c.lesson_name || '',
      }));
      state.recommendedQuestions = (detail.recommended_questions || []).map((q) => ({
        id: String(q.id || ''),
        content: q.content || '',
      }));
      renderCourseRows();
      renderQuestionRows();

      document.getElementById('modal-tc-title').textContent =
        `编辑历史人物 - ${character.character_name || ''}`;
      renderKbStatusText(character.kb_status, character.kb_fail_reason);

      Object.keys(RESOURCE_KINDS).forEach((kind) => refreshResourcePreview(kind));
      appOpenModal('modal-timechat');
    } catch (err) {
      appToast(err.message || '加载人物详情失败', 'error');
    }
  }

  // ID 与时间戳按字符串传递，避免 JS 数字精度丢失
  function collectPayload() {
    syncCourseRowsFromInputs();
    syncQuestionRowsFromInputs();

    const courseConfigs = state.courseConfigs
      .filter((row) => row.course_id && row.course_id !== '0')
      .map((row) => ({
        course_id: String(row.course_id),
        lesson_id: String(row.lesson_id || '0'),
      }));

    const questions = state.recommendedQuestions
      .filter((row) => row.content)
      .map((row) => (row.id ? { id: String(row.id), content: row.content } : { content: row.content }));

    const character = {
      character_name: getValue('f-tc-name'),
      dynasty: getValue('f-tc-dynasty'),
      description: getValue('f-tc-description'),
      avatar_url: getValue('f-tc-avatar'),
      res_pack_url: getValue('f-tc-res-pack'),
      system_prompt: getValue('f-tc-system-prompt'),
      greet: getValue('f-tc-greet'),
      knowledge_file_url: getValue('f-tc-knowledge'),
      extra_config: {},
    };
    // 创建时不带 id；更新时传 id
    if (state.editingId) character.id = state.editingId;

    return { character, course_configs: courseConfigs, recommended_questions: questions };
  }

  async function submitForm(event) {
    event.preventDefault();
    const payload = collectPayload();
    if (!payload.character.character_name) {
      appToast('人物名称不能为空', 'error');
      return;
    }

    const isEdit = Boolean(state.editingId);
    try {
      await appPost(isEdit ? API.UPDATE : API.CREATE, payload);
      appToast(isEdit ? '保存成功' : '创建成功', 'success');
      appCloseModal('modal-timechat');
      await loadList();
      // 知识库是异步解析的，创建后提醒去看解析状态
      if (!isEdit && payload.character.knowledge_file_url) {
        appToast('知识库已提交解析，稍后可在列表查看解析状态', 'success');
      }
    } catch (err) {
      appToast(err.message || '保存失败', 'error');
    }
  }

  async function remove(id, name) {
    if (!window.confirm(`确认删除历史人物「${name || id}」？`)) return;
    try {
      await appPost(API.DELETE, { id: String(id) });
      appToast('删除成功', 'success');
      if (state.page > 1) state.page -= 1;
      await loadList();
    } catch (err) {
      appToast(err.message || '删除失败', 'error');
    }
  }

  // ========== 初始化 ==========

  function bind(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  function initTimechat() {
    bind('btn-tc-search', 'click', () => {
      state.filter.character_name = getValue('f-tc-filter-name');
      state.filter.dynasty = getValue('f-tc-filter-dynasty');
      state.page = 1;
      loadList();
    });

    bind('btn-tc-reset', 'click', () => {
      setValue('f-tc-filter-name', '');
      setValue('f-tc-filter-dynasty', '');
      state.filter = { character_name: '', dynasty: '' };
      state.page = 1;
      loadList();
    });

    bind('btn-tc-prev', 'click', () => {
      if (state.page > 1) {
        state.page -= 1;
        loadList();
      }
    });
    bind('btn-tc-next', 'click', () => {
      state.page += 1;
      loadList();
    });
    bind('tc-page-size', 'change', (e) => {
      state.pageSize = Number(e.target.value) || 20;
      state.page = 1;
      loadList();
    });

    bind('btn-create-timechat', 'click', openCreate);
    bind('tc-form', 'submit', submitForm);

    // 列表操作按钮（行是动态渲染的，用事件委托）
    bind('tc-tbody', 'click', (e) => {
      const editBtn = e.target.closest('.tc-edit');
      if (editBtn) {
        openEdit(editBtn.dataset.id);
        return;
      }
      const delBtn = e.target.closest('.tc-delete');
      if (delBtn) remove(delBtn.dataset.id, delBtn.dataset.name);
    });

    // 上传
    Object.keys(RESOURCE_KINDS).forEach((kind) => {
      bind(`btn-tc-upload-${kind}`, 'click', () => handleUpload(kind, `f-tc-file-${kind}`));
      bind(`f-tc-file-${kind}`, 'change', () => {
        const fileInput = document.getElementById(`f-tc-file-${kind}`);
        const file = fileInput.files && fileInput.files[0];
        const hint = document.getElementById(`tc-file-hint-${kind}`);
        if (hint) hint.textContent = file ? file.name : '';
      });
    });

    // 课程配置 / 推荐问题增删
    bind('btn-tc-add-course', 'click', () => addCourseRow('', '0'));
    bind('btn-tc-add-question', 'click', () => addQuestionRow('', ''));
    bind('tc-course-tbody', 'click', (e) => {
      const btn = e.target.closest('.tc-course-remove');
      if (!btn) return;
      syncCourseRowsFromInputs();
      state.courseConfigs.splice(Number(btn.dataset.index), 1);
      renderCourseRows();
    });
    bind('tc-question-tbody', 'click', (e) => {
      const btn = e.target.closest('.tc-question-remove');
      if (!btn) return;
      syncQuestionRowsFromInputs();
      state.recommendedQuestions.splice(Number(btn.dataset.index), 1);
      renderQuestionRows();
    });

    resetForm();
  }

  window.Timechat = {
    initTimechat,
    loadTimechatList: loadList,
    openTimechatEdit: openEdit,
  };
})();

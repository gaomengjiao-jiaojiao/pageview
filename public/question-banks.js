// 题库管理：题库 CRUD、Excel 导入、题目查看/编辑/移除/追加导入
(function () {
  const { post: appPost, toast: appToast, esc, openModal: appOpenModal, closeModal: appCloseModal } = window.App;
  const API = {
    LIST: '/api/operation/api/lesson_game/list_game_question_banks',
    GET: '/api/operation/api/lesson_game/get_game_question_bank',
    CREATE: '/api/operation/api/lesson_game/create_game_question_bank',
    UPDATE: '/api/operation/api/lesson_game/update_game_question_bank',
    DELETE: '/api/operation/api/lesson_game/delete_game_question_bank',
    QUESTIONS: '/api/operation/api/lesson_game/list_game_question_bank_questions',
    UPDATE_QUESTION: '/api/operation/api/lesson_game/update_game_question_bank_question',
    REMOVE_QUESTIONS: '/api/operation/api/lesson_game/remove_game_questions_from_bank',
    IMPORT: '/api/operation/api/lesson_game/import_game_question_bank_questions',
    COS: '/api/operation/api/cos/get_permission',
    TEMPLATE: '/api/operation/api/excel/get_excel_template',
  };
  const EXCEL_TEMPLATE_GAME_QUESTION = 13;
  const state = { page: 1, pageSize: 20, total: 0, questionPage: 1, questionTotal: 0, activeBankId: '0', activeBankName: '' };

  function formatTime(value) {
    if (!value) return '-';
    const date = new Date(Number(value) * 1000);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false });
  }
  function id(value) { return String(value || '').trim() || '0'; }
  function showErrors(errors) {
    const box = document.getElementById('bank-import-errors');
    box.textContent = (errors || []).join('\n');
    box.classList.toggle('hidden', !(errors && errors.length));
  }

  async function uploadQuestionExcel(file) {
    if (!file) throw new Error('请选择 Excel 文件');
    const ext = String(file.name).toLowerCase().endsWith('.xlsx') ? 'xlsx' : '';
    if (!ext) throw new Error('题库只支持 .xlsx 文件');
    const date = new Date().toISOString().slice(0, 10);
    const path = `/resource/cardgame/question/${date}/${Date.now()}`;
    const permission = await appPost(API.COS, { file_ext: ext, file_path: path, operation_type: 1, bucket_type: 1 });
    const signedUrl = permission.data && permission.data.signed_url;
    if (!signedUrl) throw new Error('获取 COS 上传地址失败');
    const response = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: file });
    if (!response.ok) throw new Error(`上传 Excel 失败：HTTP ${response.status}`);
    return path;
  }

  async function loadBankList() {
    const tbody = document.getElementById('bank-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="empty">加载中...</td></tr>';
    try {
      const response = await appPost(API.LIST, { page: state.page, page_size: state.pageSize, grade: Number(document.getElementById('bank-filter-grade').value) || 0, keyword: document.getElementById('bank-filter-keyword').value.trim() });
      const data = response.data || {};
      state.total = Number(data.total_count) || 0;
      renderBankList(data.list || []);
      renderBankPageInfo();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">${esc(error.message)}</td></tr>`;
    }
  }
  function renderBankList(list) {
    const tbody = document.getElementById('bank-tbody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无数据</td></tr>'; return; }
    tbody.innerHTML = list.map((item) => `<tr>
      <td>${esc(item.bank_id)}</td><td><strong>${esc(item.name)}</strong></td><td>${item.grade ? `${esc(item.grade)} 年级` : '不限年级'}</td>
      <td>${esc(item.description)}</td><td>${esc(item.question_count || 0)}</td><td>${esc(formatTime(item.updated_at))}</td>
      <td class="row-actions"><button class="btn" data-bank-action="questions" data-id="${esc(item.bank_id)}" data-name="${esc(item.name)}">查看题目</button><button class="btn" data-bank-action="edit" data-id="${esc(item.bank_id)}">编辑</button><button class="btn" data-bank-action="import" data-id="${esc(item.bank_id)}" data-name="${esc(item.name)}">追加导入</button><button class="btn btn-danger" data-bank-action="delete" data-id="${esc(item.bank_id)}" data-name="${esc(item.name)}">删除</button></td>
    </tr>`).join('');
  }
  function renderBankPageInfo() {
    const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
    document.getElementById('bank-page-info').textContent = `第 ${state.page} / ${pages} 页，共 ${state.total} 条`;
    document.getElementById('btn-bank-prev').disabled = state.page <= 1;
    document.getElementById('btn-bank-next').disabled = state.page >= pages;
  }

  function resetBankForm() {
    document.getElementById('bank-form').reset();
    document.getElementById('bank-form-id').value = '';
    document.getElementById('modal-bank-title').textContent = '新建题库';
    document.getElementById('bank-excel-row').classList.remove('hidden');
    document.getElementById('bank-description').value = '';
    showErrors([]);
  }
  async function openBankModal(bankId) {
    resetBankForm();
    if (bankId) {
      try {
        const response = await appPost(API.GET, { bank_id: id(bankId) });
        const bank = response.data && response.data.bank;
        if (!bank) throw new Error('题库详情为空');
        document.getElementById('modal-bank-title').textContent = '编辑题库';
        document.getElementById('bank-form-id').value = bank.bank_id;
        document.getElementById('bank-name').value = bank.name || '';
        document.getElementById('bank-grade').value = bank.grade || 0;
        document.getElementById('bank-description').value = bank.description || '';
        document.getElementById('bank-excel-row').classList.add('hidden');
      } catch (error) { appToast(error.message, 'error'); return; }
    }
    appOpenModal('modal-question-bank');
  }
  async function submitBankForm(event) {
    event.preventDefault();
    showErrors([]);
    const bankId = document.getElementById('bank-form-id').value.trim();
    const body = { name: document.getElementById('bank-name').value.trim(), grade: Number(document.getElementById('bank-grade').value) || 0, description: document.getElementById('bank-description').value.trim() };
    if (!body.name) { appToast('请输入题库名称', 'error'); return; }
    try {
      if (bankId) {
        await appPost(API.UPDATE, { bank_id: bankId, ...body });
      } else {
        const path = await uploadQuestionExcel(document.getElementById('bank-excel-file').files[0]);
        await appPost(API.CREATE, { ...body, excel_url: path });
      }
      appCloseModal('modal-question-bank');
      appToast(bankId ? '题库已更新' : '题库已创建');
      loadBankList();
    } catch (error) {
      if (error.data && error.data.errors) showErrors(error.data.errors);
      appToast(error.message, 'error');
    }
  }
  async function deleteBank(bankId, name) {
    if (!window.confirm(`确定删除题库“${name}”吗？只会删除题库，不会删除题目。`)) return;
    try { await appPost(API.DELETE, { bank_id: id(bankId) }); appToast('题库已删除'); loadBankList(); } catch (error) { appToast(error.message, 'error'); }
  }
  async function downloadTemplate() {
    try {
      const response = await appPost(API.TEMPLATE, { template: EXCEL_TEMPLATE_GAME_QUESTION });
      const url = response.data && response.data.template_url;
      if (!url) throw new Error('模板下载地址为空');
      window.open(url, '_blank', 'noopener');
    } catch (error) { appToast(error.message, 'error'); }
  }

  async function loadQuestions() {
    const tbody = document.getElementById('bank-question-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="empty">加载中...</td></tr>';
    try {
      const response = await appPost(API.QUESTIONS, { bank_id: state.activeBankId, page: state.questionPage, page_size: 20, stem: document.getElementById('question-filter-stem').value.trim() });
      const data = response.data || {};
      state.questionTotal = Number(data.total_count) || 0;
      renderQuestions(data.list || []);
      const pages = Math.max(1, Math.ceil(state.questionTotal / 20));
      document.getElementById('question-page-info').textContent = `第 ${state.questionPage} / ${pages} 页，共 ${state.questionTotal} 条`;
      document.getElementById('btn-bank-question-prev').disabled = state.questionPage <= 1;
      document.getElementById('btn-bank-question-next').disabled = state.questionPage >= pages;
    } catch (error) { tbody.innerHTML = `<tr><td colspan="7" class="empty">${esc(error.message)}</td></tr>`; }
  }
  function renderQuestions(list) {
    const tbody = document.getElementById('bank-question-tbody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无题目</td></tr>'; return; }
    tbody.innerHTML = list.map((item) => {
      const options = (item.options || []).map((option) => `${esc(option.option)}. ${esc(option.content)}`).join('<br>');
      return `<tr><td><input type="checkbox" class="question-checkbox" value="${esc(item.question_id)}"></td><td>${esc(item.question_id)}</td><td class="question-stem">${esc(item.stem)}</td><td>${options}</td><td>${esc(item.correct_answer)}</td><td>${esc(item.difficulty)}</td><td><button class="btn" data-question-action="edit" data-question="${encodeURIComponent(JSON.stringify(item))}">编辑</button></td></tr>`;
    }).join('');
  }
  async function openQuestionsModal(bankId, bankName) {
    state.activeBankId = id(bankId); state.activeBankName = bankName || bankId; state.questionPage = 1;
    document.getElementById('bank-question-title').textContent = `题库题目：${state.activeBankName}`;
    document.getElementById('question-filter-stem').value = '';
    appOpenModal('modal-bank-questions');
    loadQuestions();
  }
  function addQuestionOption(option) {
    const row = document.createElement('div'); row.className = 'question-option-row';
    row.innerHTML = `<input class="question-option-label" maxlength="2" value="${esc(option && option.option || '')}" placeholder="A"><input class="question-option-content" value="${esc(option && option.content || '')}" placeholder="选项内容"><button type="button" class="btn btn-danger question-remove-option">移除</button>`;
    row.querySelector('.question-remove-option').addEventListener('click', () => row.remove());
    document.getElementById('question-option-rows').appendChild(row);
  }
  function openQuestionEdit(question) {
    document.getElementById('question-edit-id').value = question.question_id || '';
    document.getElementById('question-stem').value = question.stem || '';
    document.getElementById('question-correct-answer').value = question.correct_answer || '';
    document.getElementById('question-difficulty').value = question.difficulty || 1;
    document.getElementById('question-option-rows').innerHTML = '';
    (question.options || []).forEach((option) => addQuestionOption(option));
    appOpenModal('modal-question-edit');
  }
  async function submitQuestionForm(event) {
    event.preventDefault();
    const rows = Array.from(document.querySelectorAll('.question-option-row'));
    const options = rows.map((row) => ({ option: row.querySelector('.question-option-label').value.trim(), content: row.querySelector('.question-option-content').value.trim() }));
    const labels = options.map((option) => option.option);
    const correct = document.getElementById('question-correct-answer').value.trim();
    if (!document.getElementById('question-stem').value.trim()) { appToast('题干不能为空', 'error'); return; }
    if (options.length < 2 || options.some((option) => !option.option || !option.content) || new Set(labels).size !== labels.length) { appToast('选项至少 2 个，标签不可重复且内容不能为空', 'error'); return; }
    if (!labels.includes(correct)) { appToast('正确答案必须在选项标签中', 'error'); return; }
    try {
      await appPost(API.UPDATE_QUESTION, { bank_id: state.activeBankId, question: { question_id: id(document.getElementById('question-edit-id').value), stem: document.getElementById('question-stem').value.trim(), options, correct_answer: correct, difficulty: Number(document.getElementById('question-difficulty').value) || 1 } });
      appCloseModal('modal-question-edit'); appToast('题目已更新'); loadQuestions();
    } catch (error) { appToast(error.message, 'error'); }
  }
  async function removeSelectedQuestions() {
    const ids = Array.from(document.querySelectorAll('.question-checkbox:checked')).map((input) => input.value);
    if (!ids.length) { appToast('请先选择要移除的题目', 'error'); return; }
    if (!window.confirm(`确定从题库移除 ${ids.length} 道题目吗？`)) return;
    try { await appPost(API.REMOVE_QUESTIONS, { bank_id: state.activeBankId, question_ids: ids }); appToast('题目已移除'); loadQuestions(); loadBankList(); } catch (error) { appToast(error.message, 'error'); }
  }
  function openImportModal(bankId, bankName) {
    state.activeBankId = id(bankId); state.activeBankName = bankName || bankId;
    document.getElementById('import-bank-title').textContent = `追加导入：${state.activeBankName}`;
    document.getElementById('import-bank-file').value = '';
    document.getElementById('bank-append-errors').classList.add('hidden');
    appOpenModal('modal-bank-import');
  }
  async function submitImportForm(event) {
    event.preventDefault();
    const errorBox = document.getElementById('bank-append-errors'); errorBox.classList.add('hidden'); errorBox.textContent = '';
    try {
      const path = await uploadQuestionExcel(document.getElementById('import-bank-file').files[0]);
      await appPost(API.IMPORT, { bank_id: state.activeBankId, excel_url: path });
      appCloseModal('modal-bank-import'); appToast('题目已追加导入'); loadBankList();
    } catch (error) {
      if (error.data && error.data.errors) { errorBox.textContent = error.data.errors.join('\n'); errorBox.classList.remove('hidden'); }
      appToast(error.message, 'error');
    }
  }

  function initQuestionBanks() {
    document.getElementById('btn-create-bank').addEventListener('click', () => openBankModal());
    document.getElementById('btn-bank-template').addEventListener('click', downloadTemplate);
    document.getElementById('btn-bank-search').addEventListener('click', () => { state.page = 1; loadBankList(); });
    document.getElementById('btn-bank-reset').addEventListener('click', () => { document.getElementById('bank-filter-grade').value = '0'; document.getElementById('bank-filter-keyword').value = ''; state.page = 1; loadBankList(); });
    document.getElementById('btn-bank-prev').addEventListener('click', () => { if (state.page > 1) { state.page -= 1; loadBankList(); } });
    document.getElementById('btn-bank-next').addEventListener('click', () => { if (state.page < Math.ceil(state.total / state.pageSize)) { state.page += 1; loadBankList(); } });
    document.getElementById('bank-page-size').addEventListener('change', (event) => { state.pageSize = Number(event.target.value) || 20; state.page = 1; loadBankList(); });
    document.getElementById('bank-tbody').addEventListener('click', (event) => {
      const button = event.target.closest('[data-bank-action]'); if (!button) return;
      const action = button.dataset.bankAction;
      if (action === 'questions') openQuestionsModal(button.dataset.id, button.dataset.name);
      if (action === 'edit') openBankModal(button.dataset.id);
      if (action === 'import') openImportModal(button.dataset.id, button.dataset.name);
      if (action === 'delete') deleteBank(button.dataset.id, button.dataset.name);
    });
    document.getElementById('bank-form').addEventListener('submit', submitBankForm);
    document.getElementById('bank-import-form').addEventListener('submit', submitImportForm);
    document.getElementById('btn-bank-question-search').addEventListener('click', () => { state.questionPage = 1; loadQuestions(); });
    document.getElementById('btn-bank-question-prev').addEventListener('click', () => { if (state.questionPage > 1) { state.questionPage -= 1; loadQuestions(); } });
    document.getElementById('btn-bank-question-next').addEventListener('click', () => { if (state.questionPage < Math.ceil(state.questionTotal / 20)) { state.questionPage += 1; loadQuestions(); } });
    document.getElementById('bank-question-tbody').addEventListener('click', (event) => { const button = event.target.closest('[data-question-action="edit"]'); if (button) openQuestionEdit(JSON.parse(decodeURIComponent(button.dataset.question))); });
    document.getElementById('btn-remove-bank-questions').addEventListener('click', removeSelectedQuestions);
    document.getElementById('btn-add-question-option').addEventListener('click', () => addQuestionOption());
    document.getElementById('question-edit-form').addEventListener('submit', submitQuestionForm);
  }

  window.QuestionBanks = { initQuestionBanks, loadBankList, openQuestionsModal };
})();

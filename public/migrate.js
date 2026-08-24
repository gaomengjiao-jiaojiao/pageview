// 直播课历史学习数据迁移工具

const _M = window.App;

const MIGRATE_API = {
  LIVE_STUDY_PROGRESS: '/api/operation/api/admin/migrate/live_study_progress',
};

function parseOptionalNumber(id) {
  const raw = document.getElementById(id).value.trim();
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error('字段格式错误：' + id);
  }
  return num;
}

function parseOptionalInt64String(id) {
  const raw = document.getElementById(id).value.trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) {
    throw new Error('字段格式错误：' + id);
  }
  return raw;
}

function collectLiveStudyMigrateForm() {
  const roomId = parseOptionalInt64String('lm-room-id');
  const startTimeFrom = parseOptionalNumber('lm-start-time-from');
  const startTimeTo = parseOptionalNumber('lm-start-time-to');
  const roomPage = parseOptionalNumber('lm-room-page');
  const roomLimit = parseOptionalNumber('lm-room-limit');
  const paceMs = parseOptionalNumber('lm-pace-ms');
  const dryRun = document.getElementById('lm-dry-run').checked;

  const body = { dry_run: dryRun };
  if (roomId !== null) body.room_id = roomId;
  if (startTimeFrom !== null) body.start_time_from = startTimeFrom;
  if (startTimeTo !== null) body.start_time_to = startTimeTo;
  if (roomPage !== null) body.room_page = roomPage;
  if (roomLimit !== null) body.room_limit = roomLimit;
  if (paceMs !== null) body.pace_ms = paceMs;
  return body;
}

function renderLiveStudyMigrateResult(payload) {
  const el = document.getElementById('lm-result');
  const panel = document.getElementById('lm-dry-run-panel');
  const summaryEl = document.getElementById('lm-dry-run-summary');
  const bodyEl = document.getElementById('lm-dry-run-body');

  if (panel && summaryEl && bodyEl) {
    panel.classList.add('hidden');
    summaryEl.textContent = '';
    bodyEl.innerHTML = '';
  }

  if (!payload || !payload.data) {
    el.textContent = JSON.stringify(payload, null, 2);
    return;
  }

  const data = payload.data;
  const summary = {
    code: payload.code,
    data: {
      room_page: data.room_page,
      next_room_page: data.next_room_page,
      has_more_rooms: data.has_more_rooms,
      total_rooms: data.total_rooms,
      skipped_rooms: data.skipped_rooms,
      migrated_lessons: data.migrated_lessons,
      reported_students: data.reported_students,
      dry_run_item_count: data.dry_run_item_count,
      dry_run_omitted: data.dry_run_omitted,
      errors: data.errors || [],
    },
  };
  el.textContent = JSON.stringify(summary, null, 2);

  const items = Array.isArray(data.dry_run_items) ? data.dry_run_items : [];
  if (!items.length || !panel || !summaryEl || !bodyEl) {
    return;
  }

  panel.classList.remove('hidden');
  summaryEl.textContent = `共展示 ${items.length} 条学习数据，reported_students=${data.reported_students || 0} 表示其中满足迁移条件的数量。`;
  bodyEl.innerHTML = items.map((item) => `
    <tr>
      <td>${item.room_id ?? ''}</td>
      <td>${item.lesson_id ?? ''}</td>
      <td>${item.user_id ?? ''}</td>
      <td>${item.total_duration ?? ''}</td>
      <td>${item.watch_duration ?? ''}</td>
      <td>${item.live_duration ?? ''}</td>
    </tr>
  `).join('');
}

async function submitLiveStudyMigrate(e) {
  e.preventDefault();

  let body;
  try {
    body = collectLiveStudyMigrateForm();
  } catch (err) {
    _M.toast(err.message, 'error');
    return;
  }

  if (!body.room_id && !body.start_time_from && !body.start_time_to) {
    _M.toast('room_id、start_time_from、start_time_to 至少填一个', 'error');
    return;
  }

  const submitBtn = document.getElementById('btn-live-study-migrate');
  submitBtn.disabled = true;
  renderLiveStudyMigrateResult({ loading: true, request: body });

  try {
    const resp = await _M.post(MIGRATE_API.LIVE_STUDY_PROGRESS, body);
    renderLiveStudyMigrateResult(resp);
    _M.toast(body.dry_run ? '试跑完成' : '迁移执行完成', 'success');
  } catch (err) {
    renderLiveStudyMigrateResult({
      code: -1,
      message: err.message,
      request: body,
    });
    _M.toast('执行失败：' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function initLiveStudyMigrate() {
  document.getElementById('form-live-study-migrate').addEventListener('submit', submitLiveStudyMigrate);
}

window.LiveStudyMigrate = { initLiveStudyMigrate };

// ============================================
// PomoToDo - 案件管理カンバン (kanban.js)
// イラストレーター特化版
// ============================================

const KanbanBoard = (() => {
  const STORAGE_KEY = 'pomtodo_kanban_projects';
  const POMO_TIME_KEY = 'pomtodo_kanban_pomo_time';

  const STATUSES = [
    { id: 'rough',    label: 'ラフ',   color: '#a78bfa', icon: '✏️' },
    { id: 'lineart',  label: '線画',   color: '#60a5fa', icon: '🖊️' },
    { id: 'coloring', label: '着彩',   color: '#f472b6', icon: '🎨' },
    { id: 'done',     label: '納品済', color: '#34d399', icon: '✅' },
  ];

  let projects = [];
  let dragSrcId = null;
  let activeProjectId = null; // ポモドーロ連動中の案件ID

  // ---------- データ ----------
  function load() {
    try { projects = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { projects = []; }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }
  function loadPomoTime() {
    try { return JSON.parse(localStorage.getItem(POMO_TIME_KEY)) || {}; }
    catch { return {}; }
  }
  function savePomoTime(data) {
    localStorage.setItem(POMO_TIME_KEY, JSON.stringify(data));
  }

  // ポモドーロ完了時に呼び出す（外部から）
  function addPomoSession(projectId) {
    if (!projectId) return;
    const data = loadPomoTime();
    data[projectId] = (data[projectId] || 0) + 25; // 25分追加
    savePomoTime(data);
    renderBoard();
  }

  function getPomoMinutes(projectId) {
    const data = loadPomoTime();
    return data[projectId] || 0;
  }

  function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // ---------- CRUD ----------
  function createProject(data) {
    const proj = {
      id: Date.now().toString(),
      client: data.client || '',
      title: data.title || '新規案件',
      deadline: data.deadline || '',
      price: data.price ? Number(data.price) : null,
      status: data.status || 'rough',
      revisions: data.revisions || 0,
      revisionNote: data.revisionNote || '',
      createdAt: Date.now(),
    };
    projects.push(proj);
    save();
    return proj;
  }

  function updateProject(id, data) {
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return;
    projects[idx] = { ...projects[idx], ...data };
    save();
  }

  function deleteProject(id) {
    projects = projects.filter(p => p.id !== id);
    save();
  }

  // ---------- UI ----------
  function renderBoard() {
    const container = document.getElementById('kanban-board');
    if (!container) return;

    container.innerHTML = '';

    STATUSES.forEach(status => {
      const cols = projects.filter(p => p.status === status.id);
      const col = document.createElement('div');
      col.className = 'kb-column';
      col.dataset.status = status.id;

      col.innerHTML = `
        <div class="kb-col-header">
          <span class="kb-col-icon">${status.icon}</span>
          <span class="kb-col-label">${status.label}</span>
          <span class="kb-col-count">${cols.length}</span>
        </div>
        <div class="kb-cards" data-status="${status.id}"></div>
      `;

      const cardsEl = col.querySelector('.kb-cards');

      cols.forEach(proj => {
        const card = buildCard(proj);
        cardsEl.appendChild(card);
      });

      // ドロップゾーン
      cardsEl.addEventListener('dragover', e => {
        e.preventDefault();
        cardsEl.classList.add('kb-drag-over');
      });
      cardsEl.addEventListener('dragleave', () => {
        cardsEl.classList.remove('kb-drag-over');
      });
      cardsEl.addEventListener('drop', e => {
        e.preventDefault();
        cardsEl.classList.remove('kb-drag-over');
        if (dragSrcId) {
          updateProject(dragSrcId, { status: status.id });
          dragSrcId = null;
          renderBoard();
        }
      });

      container.appendChild(col);
    });
  }

  function buildCard(proj) {
    const card = document.createElement('div');
    card.className = 'kb-card';
    card.draggable = true;
    card.dataset.id = proj.id;

    if (activeProjectId === proj.id) card.classList.add('kb-card--active');

    const days = daysUntil(proj.deadline);
    const urgency = days !== null && days <= 2 ? 'kb-deadline--urgent'
                  : days !== null && days <= 7 ? 'kb-deadline--warn' : '';

    const pomoMin = getPomoMinutes(proj.id);
    const hourlyRate = proj.price && pomoMin > 0
      ? Math.round(proj.price / (pomoMin / 60))
      : null;

    card.innerHTML = `
      <div class="kb-card-top">
        <span class="kb-client">${proj.client || '—'}</span>
        <div class="kb-card-actions">
          <button class="kb-btn-pomo ${activeProjectId === proj.id ? 'active' : ''}" title="ポモドーロ連動" data-id="${proj.id}">⏱</button>
          <button class="kb-btn-edit" data-id="${proj.id}">✏️</button>
          <button class="kb-btn-del" data-id="${proj.id}">🗑</button>
        </div>
      </div>
      <div class="kb-title">${proj.title}</div>
      <div class="kb-meta">
        ${proj.deadline ? `<span class="kb-deadline ${urgency}">📅 ${proj.deadline}${days !== null ? ` (${days >= 0 ? days + '日後' : '期限超過'})` : ''}</span>` : ''}
        ${proj.price ? `<span class="kb-price">💴 ${proj.price.toLocaleString()}円</span>` : ''}
      </div>
      <div class="kb-footer">
        <span class="kb-pomo-time" title="作業時間">⏰ ${formatTime(pomoMin)}</span>
        ${hourlyRate ? `<span class="kb-hourly">≈ ${hourlyRate.toLocaleString()}円/h</span>` : ''}
        <span class="kb-revision" title="修正回数">🔄 ${proj.revisions}回</span>
      </div>
      ${proj.revisionNote ? `<div class="kb-revision-note">📝 ${proj.revisionNote}</div>` : ''}
    `;

    // ドラッグ
    card.addEventListener('dragstart', () => { dragSrcId = proj.id; card.classList.add('kb-dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('kb-dragging'));

    // ポモドーロ連動ボタン
    card.querySelector('.kb-btn-pomo').addEventListener('click', e => {
      e.stopPropagation();
      activeProjectId = activeProjectId === proj.id ? null : proj.id;
      updateActivePomoLabel();
      renderBoard();
    });

    // 編集
    card.querySelector('.kb-btn-edit').addEventListener('click', e => {
      e.stopPropagation();
      openModal(proj);
    });

    // 削除
    card.querySelector('.kb-btn-del').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`「${proj.title}」を削除しますか？`)) {
        deleteProject(proj.id);
        renderBoard();
      }
    });

    return card;
  }

  function updateActivePomoLabel() {
    const label = document.getElementById('kb-active-pomo-label');
    if (!label) return;
    if (activeProjectId) {
      const proj = projects.find(p => p.id === activeProjectId);
      label.textContent = proj ? `⏱ 連動中: ${proj.title}` : '';
      label.style.display = 'block';
    } else {
      label.textContent = '';
      label.style.display = 'none';
    }
  }

  // ---------- モーダル ----------
  function openModal(proj = null) {
    let modal = document.getElementById('kb-modal');
    if (!modal) buildModal();
    modal = document.getElementById('kb-modal');

    const isEdit = !!proj;
    modal.querySelector('#kb-modal-title').textContent = isEdit ? '案件を編集' : '新規案件を追加';
    modal.querySelector('#kb-input-client').value = proj?.client || '';
    modal.querySelector('#kb-input-title').value = proj?.title || '';
    modal.querySelector('#kb-input-deadline').value = proj?.deadline || '';
    modal.querySelector('#kb-input-price').value = proj?.price || '';
    modal.querySelector('#kb-input-status').value = proj?.status || 'rough';
    modal.querySelector('#kb-input-revisions').value = proj?.revisions || 0;
    modal.querySelector('#kb-input-revision-note').value = proj?.revisionNote || '';

    modal.dataset.editId = proj?.id || '';
    modal.classList.add('kb-modal--open');
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'kb-modal';
    modal.className = 'kb-modal';
    modal.innerHTML = `
      <div class="kb-modal-inner">
        <h3 id="kb-modal-title">新規案件を追加</h3>
        <div class="kb-form-grid">
          <label>クライアント名<input id="kb-input-client" type="text" placeholder="例: デザイン事務所A"></label>
          <label>案件名 *<input id="kb-input-title" type="text" placeholder="例: キャラクターデザイン"></label>
          <label>納期<input id="kb-input-deadline" type="date"></label>
          <label>単価（円）<input id="kb-input-price" type="number" placeholder="例: 30000"></label>
          <label>ステータス
            <select id="kb-input-status">
              ${STATUSES.map(s => `<option value="${s.id}">${s.icon} ${s.label}</option>`).join('')}
            </select>
          </label>
          <label>修正回数<input id="kb-input-revisions" type="number" min="0" value="0"></label>
          <label class="kb-form-full">修正メモ<textarea id="kb-input-revision-note" placeholder="修正内容のメモ..."></textarea></label>
        </div>
        <div class="kb-modal-btns">
          <button id="kb-btn-cancel">キャンセル</button>
          <button id="kb-btn-save" class="kb-btn-primary">保存</button>
        </div>
      </div>
    `;

    modal.querySelector('#kb-btn-cancel').addEventListener('click', () => {
      modal.classList.remove('kb-modal--open');
    });

    modal.querySelector('#kb-btn-save').addEventListener('click', () => {
      const data = {
        client: modal.querySelector('#kb-input-client').value.trim(),
        title: modal.querySelector('#kb-input-title').value.trim(),
        deadline: modal.querySelector('#kb-input-deadline').value,
        price: modal.querySelector('#kb-input-price').value,
        status: modal.querySelector('#kb-input-status').value,
        revisions: Number(modal.querySelector('#kb-input-revisions').value),
        revisionNote: modal.querySelector('#kb-input-revision-note').value.trim(),
      };
      if (!data.title) { alert('案件名を入力してください'); return; }

      const editId = modal.dataset.editId;
      if (editId) {
        updateProject(editId, data);
      } else {
        createProject(data);
      }
      modal.classList.remove('kb-modal--open');
      renderBoard();
    });

    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.remove('kb-modal--open');
    });

    document.body.appendChild(modal);
  }

  // ---------- セクション構築 ----------
  function buildSection() {
    const section = document.createElement('div');
    section.className = 'widget kanban-widget';
    section.innerHTML = `
      <div class="kb-header">
        <h2>🎨 案件管理</h2>
        <div class="kb-header-right">
          <span id="kb-active-pomo-label" class="kb-pomo-indicator" style="display:none"></span>
          <button id="kb-add-btn" class="kb-btn-primary">＋ 新規案件</button>
        </div>
      </div>
      <div id="kanban-board" class="kanban-board"></div>
    `;

    section.querySelector('#kb-add-btn').addEventListener('click', () => openModal());

    // PomoToDo本体のポモドーロ完了イベントをフック（既存コードへの連携）
    document.addEventListener('pomodoroComplete', () => {
      if (activeProjectId) addPomoSession(activeProjectId);
    });

    return section;
  }

  // ---------- CSS ----------
  function injectCSS() {
    const style = document.createElement('style');
    style.textContent = `
      .kanban-widget {
        margin: 16px 0;
      }
      .kb-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        flex-wrap: wrap;
        gap: 8px;
      }
      .kb-header h2 {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text-primary, #e2e8f0);
        margin: 0;
      }
      .kb-header-right {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .kb-pomo-indicator {
        font-size: 0.75rem;
        color: #f472b6;
        background: rgba(244,114,182,0.12);
        border: 1px solid rgba(244,114,182,0.3);
        border-radius: 20px;
        padding: 3px 10px;
        animation: kb-pulse 2s infinite;
      }
      @keyframes kb-pulse {
        0%,100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .kb-btn-primary {
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 7px 16px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .kb-btn-primary:hover { opacity: 0.85; }

      /* ボード */
      .kanban-board {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        overflow-x: auto;
        padding-bottom: 8px;
      }
      @media (max-width: 900px) {
        .kanban-board { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 500px) {
        .kanban-board { grid-template-columns: 1fr; }
      }

      /* カラム */
      .kb-column {
        background: var(--widget-bg, rgba(30,27,60,0.7));
        border-radius: 12px;
        padding: 12px;
        min-height: 120px;
        border: 1px solid rgba(255,255,255,0.06);
      }
      .kb-col-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .kb-col-icon { font-size: 1rem; }
      .kb-col-label {
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--text-secondary, #94a3b8);
        flex: 1;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .kb-col-count {
        background: rgba(255,255,255,0.08);
        color: var(--text-secondary, #94a3b8);
        border-radius: 20px;
        padding: 1px 8px;
        font-size: 0.72rem;
        font-weight: 600;
      }
      .kb-cards {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 60px;
        border-radius: 8px;
        transition: background 0.15s;
      }
      .kb-cards.kb-drag-over {
        background: rgba(167,139,250,0.08);
        outline: 2px dashed rgba(167,139,250,0.4);
      }

      /* カード */
      .kb-card {
        background: var(--card-bg, rgba(255,255,255,0.04));
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 10px 12px;
        cursor: grab;
        transition: transform 0.15s, box-shadow 0.15s;
        user-select: none;
      }
      .kb-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 24px rgba(0,0,0,0.3);
        border-color: rgba(167,139,250,0.3);
      }
      .kb-card.kb-dragging {
        opacity: 0.4;
        cursor: grabbing;
      }
      .kb-card--active {
        border-color: rgba(244,114,182,0.5);
        background: rgba(244,114,182,0.05);
      }
      .kb-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .kb-client {
        font-size: 0.7rem;
        color: #a78bfa;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100px;
      }
      .kb-card-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.15s;
      }
      .kb-card:hover .kb-card-actions { opacity: 1; }
      .kb-card-actions button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.8rem;
        padding: 2px 4px;
        border-radius: 4px;
        transition: background 0.1s;
        line-height: 1;
      }
      .kb-card-actions button:hover { background: rgba(255,255,255,0.1); }
      .kb-btn-pomo.active { background: rgba(244,114,182,0.2) !important; }
      .kb-title {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--text-primary, #e2e8f0);
        margin-bottom: 6px;
        line-height: 1.3;
      }
      .kb-meta {
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin-bottom: 6px;
      }
      .kb-deadline, .kb-price {
        font-size: 0.72rem;
        color: var(--text-secondary, #94a3b8);
      }
      .kb-deadline--urgent { color: #f87171 !important; font-weight: 700; }
      .kb-deadline--warn { color: #fbbf24 !important; }
      .kb-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        border-top: 1px solid rgba(255,255,255,0.06);
        padding-top: 6px;
      }
      .kb-pomo-time, .kb-revision, .kb-hourly {
        font-size: 0.68rem;
        color: var(--text-secondary, #94a3b8);
        background: rgba(255,255,255,0.05);
        padding: 2px 6px;
        border-radius: 4px;
      }
      .kb-hourly { color: #34d399 !important; }
      .kb-revision-note {
        font-size: 0.7rem;
        color: #fbbf24;
        margin-top: 5px;
        padding: 4px 6px;
        background: rgba(251,191,36,0.07);
        border-radius: 4px;
        border-left: 2px solid #fbbf24;
        line-height: 1.4;
      }

      /* モーダル */
      .kb-modal {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.65);
        z-index: 9999;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
      }
      .kb-modal.kb-modal--open { display: flex; }
      .kb-modal-inner {
        background: var(--modal-bg, #1e1b3c);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 28px;
        width: 100%;
        max-width: 480px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      }
      .kb-modal-inner h3 {
        margin: 0 0 20px;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text-primary, #e2e8f0);
      }
      .kb-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .kb-form-full { grid-column: 1 / -1; }
      .kb-form-grid label {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 0.78rem;
        color: var(--text-secondary, #94a3b8);
        font-weight: 600;
      }
      .kb-form-grid input,
      .kb-form-grid select,
      .kb-form-grid textarea {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 0.85rem;
        color: var(--text-primary, #e2e8f0);
        outline: none;
        transition: border-color 0.15s;
      }
      .kb-form-grid input:focus,
      .kb-form-grid select:focus,
      .kb-form-grid textarea:focus {
        border-color: rgba(167,139,250,0.6);
      }
      .kb-form-grid textarea { resize: vertical; min-height: 70px; }
      .kb-modal-btns {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }
      .kb-modal-btns button:first-child {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        color: var(--text-secondary, #94a3b8);
        border-radius: 8px;
        padding: 8px 18px;
        font-size: 0.85rem;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- 初期化 ----------
  function init() {
    load();
    injectCSS();
    const section = buildSection();

    // メインコンテナに挿入（.main-content か body 末尾）
    const target = document.querySelector('.main-content')
      || document.querySelector('main')
      || document.querySelector('.dashboard')
      || document.body;

    // Tasks セクションの前に挿入を試みる
    const tasksSection = Array.from(document.querySelectorAll('h2, .widget'))
      .find(el => el.textContent.includes('Tasks') || el.textContent.includes('タスク'));

    if (tasksSection) {
      tasksSection.closest('.widget') 
        ? tasksSection.closest('.widget').before(section)
        : tasksSection.before(section);
    } else {
      target.appendChild(section);
    }

    renderBoard();
    updateActivePomoLabel();
  }

  return { init, addPomoSession, getActiveProjectId: () => activeProjectId };
})();

// DOMContentLoaded で自動起動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', KanbanBoard.init);
} else {
  KanbanBoard.init();
}

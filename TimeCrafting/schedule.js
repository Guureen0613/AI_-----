// ===================================================
//  タイムクラフティング — 週間スケジュールグリッド
//  Phase 1: 2時間単位ブロック + 過去日付グレーアウト
// ===================================================

'use strict';

// --------- 定数 ---------
const HOUR_HEIGHT = 60;     // px per hour
const DAY_START   = 6;      // 表示開始 6時
const DAY_END     = 25;     // 表示終了 25時（翌1時）

// --------- 状態 ---------
let cycle       = null;   // 現在のサイクルデータ
let tasks       = [];     // タスクリスト
let editingBlock = null;  // 編集中ブロック

// --------- 初期化 ---------
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderAll();
});

// --------- データ読み込み ---------
function loadData() {
  // オンボーディング完了チェック
  const settings = JSON.parse(localStorage.getItem('tc_user_settings') || '{}');
  if (!settings.onboardingCompleted) {
    window.location.href = 'onboarding.html';
    return;
  }

  // 現在のサイクル
  const cycleKey = localStorage.getItem('tc_current_cycle');
  if (cycleKey) {
    cycle = JSON.parse(localStorage.getItem(cycleKey) || 'null');
  }

  // サイクルがなければ今日から7日間で新規作成
  if (!cycle) {
    cycle = createNewCycle(1);
    saveCycle();
  }

  // タスク
  tasks = JSON.parse(localStorage.getItem('tc_tasks') || '[]');

  // 目標自由時間
  const target = settings.targetFreeHours || 3;
  document.getElementById('freeTarget').textContent = target;
}

function createNewCycle(num) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 6);

  return {
    id: `cycle_${fmtISO(today)}_${fmtISO(end)}`,
    cycleStartDate: fmtISO(today),
    cycleEndDate: fmtISO(end),
    cycleNumber: num,
    status: 'draft',
    blocks: [],
  };
}

function saveCycle() {
  if (!cycle) return;
  localStorage.setItem('tc_current_cycle', cycle.id);
  localStorage.setItem(cycle.id, JSON.stringify(cycle));
}

function saveTasks() {
  localStorage.setItem('tc_tasks', JSON.stringify(tasks));
}

// --------- 全体レンダリング ---------
function renderAll() {
  if (!cycle) return;
  renderCycleLabel();
  renderGridHeader();
  renderGridBody();
  renderBlocks();
  renderTaskList();
  updateFreeMeter();
  updateStatusBadge();
}

// --------- サイクルラベル ---------
function renderCycleLabel() {
  const start = new Date(cycle.cycleStartDate);
  const end   = new Date(cycle.cycleEndDate);
  document.getElementById('cycleLabel').textContent =
    `Week ${cycle.cycleNumber}（${fmtShort(start)} 〜 ${fmtShort(end)}）`;
}

// --------- グリッドヘッダー（日付行） ---------
function renderGridHeader() {
  const header = document.getElementById('gridHeader');
  const days = getCycleDays();
  const today = fmtISO(new Date());

  let html = '<div class="grid-time-col"></div>';
  days.forEach(d => {
    const isPast = d.iso < today;
    const isToday = d.iso === today;
    html += `
      <div class="grid-day-header ${isPast ? 'past' : ''} ${isToday ? 'today' : ''}">
        <span class="grid-day-name">${d.dayName}</span>
        <span class="grid-day-date">${d.month}/${d.day}</span>
        ${isToday ? '<span class="today-dot"></span>' : ''}
      </div>
    `;
  });
  header.innerHTML = html;
}

// --------- グリッド本体（時間セル） ---------
function renderGridBody() {
  const body = document.getElementById('gridBody');
  const days = getCycleDays();
  const today = fmtISO(new Date());

  let html = '';

  // 時間ラベル列
  let timeCol = '<div class="grid-time-col">';
  for (let h = DAY_START; h < DAY_END; h++) {
    timeCol += `<div class="grid-hour-label" style="height:${HOUR_HEIGHT}px;">${h < 24 ? h : h-24}:00</div>`;
  }
  timeCol += '</div>';
  html += timeCol;

  // 各日の列
  days.forEach(d => {
    const isPast = d.iso < today;
    html += `
      <div class="grid-day-col ${isPast ? 'col-past' : ''}" id="col_${d.iso}"
           data-date="${d.iso}">
        ${renderHourCells(d.iso, isPast)}
        <!-- ブロックはJSで上から絶対配置 -->
      </div>
    `;
  });

  body.innerHTML = html;

  // セルクリックで新規ブロック追加
  body.querySelectorAll('.grid-hour-cell').forEach(cell => {
    cell.addEventListener('click', onCellClick);
  });
}

function renderHourCells(dateStr, isPast) {
  let html = '';
  for (let h = DAY_START; h < DAY_END; h++) {
    // 2時間ごとにブロック境界線を太くする
    const isBoundary = (h - DAY_START) % 2 === 0;
    html += `
      <div class="grid-hour-cell ${isBoundary ? 'boundary' : ''} ${isPast ? 'cell-past' : ''}"
           data-date="${dateStr}" data-hour="${h}"
           style="height:${HOUR_HEIGHT}px;"></div>
    `;
  }
  return html;
}

// --------- ブロック描画 ---------
function renderBlocks() {
  // 既存のブロック要素をクリア
  document.querySelectorAll('.block-el').forEach(el => el.remove());

  cycle.blocks.forEach(b => {
    const col = document.getElementById(`col_${b.date}`);
    if (!col) return;

    const today = fmtISO(new Date());
    const isPast = b.date < today;

    const top  = (b.startH - DAY_START) * HOUR_HEIGHT;
    const height = (b.endH - b.startH) * HOUR_HEIGHT - 2;

    const el = document.createElement('div');
    el.className = `block-el block-${b.type} block-cat-${b.category || b.type} ${isPast ? 'block-past' : ''}`;
    el.id = `block_${b.id}`;
    el.style.cssText = `top:${top}px; height:${height}px;`;
    el.innerHTML = `
      <span class="block-title">${b.title}</span>
      <span class="block-time">${b.startH}:00〜${b.endH < 24 ? b.endH : b.endH-24}:00</span>
      ${b.type === 'task' && b.status === 'completed' ? '<span class="block-check">✓</span>' : ''}
    `;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditBlock(b.id);
    });

    col.appendChild(el);
  });
}

// --------- タスクリスト ---------
function renderTaskList() {
  const list = document.getElementById('taskList');
  if (tasks.length === 0) {
    list.innerHTML = '<p class="empty-hint">タスクを追加してください</p>';
    return;
  }

  list.innerHTML = tasks.map(t => `
    <div class="task-item task-pri-${t.priority}">
      <span class="task-name">${t.title}</span>
      <span class="task-meta">${t.estimatedMinutes}分</span>
    </div>
  `).join('');
}

// --------- 自由時間メーター ---------
function updateFreeMeter() {
  const settings = JSON.parse(localStorage.getItem('tc_user_settings') || '{}');
  const target = settings.targetFreeHours || 3;

  const totalHours = DAY_END - DAY_START;
  const blocked = cycle.blocks.length > 0
    ? cycle.blocks.reduce((sum, b) => {
        if (b.type === 'free') return sum;
        return sum + (b.endH - b.startH);
      }, 0) / getCycleDays().length
    : 0;

  const freeH = Math.max(0, totalHours - blocked);
  const pct = Math.min(100, (freeH / target) * 100);

  document.getElementById('freeMeterVal').textContent = `${freeH.toFixed(1)}h`;
  document.getElementById('freeMeterBar').style.width = `${pct}%`;
  document.getElementById('freeMeterBar').style.background =
    freeH >= target ? 'linear-gradient(135deg,#10B981,#34D399)' : 'linear-gradient(135deg,#F59E0B,#FCD34D)';
}

// --------- ステータスバッジ ---------
function updateStatusBadge() {
  const badge = document.getElementById('statusBadge');
  badge.className = `status-badge status-${cycle.status}`;
  badge.textContent = { draft: '下書き', locked: '確定済み', completed: '完了' }[cycle.status] || '下書き';

  document.getElementById('lockBtn').textContent =
    cycle.status === 'locked' ? '編集に戻す' : 'スケジュール確定';
}

// --------- セルクリック → 新規ブロック追加 ---------
function onCellClick(e) {
  if (cycle.status === 'locked') return;
  const date = e.currentTarget.dataset.date;
  const hour = parseInt(e.currentTarget.dataset.hour);
  openAddBlock(date, hour);
}

// --------- ブロック追加モーダル ---------
function openAddBlock(date, hour) {
  editingBlock = null;
  document.getElementById('modalTitle').textContent = 'ブロックを追加';
  document.getElementById('editBlockId').value = '';
  document.getElementById('blockTitle').value = '';
  document.getElementById('blockType').value = 'fixed';
  document.getElementById('blockStart').value = hour || '';
  document.getElementById('blockEnd').value = hour ? hour + 2 : '';
  document.getElementById('deleteBlockBtn').style.display = 'none';

  // 日付セレクト生成
  renderDaySelect(date);
  onBlockTypeChange();

  document.getElementById('blockModal').style.display = 'flex';
  setTimeout(() => document.getElementById('blockTitle').focus(), 100);
}

function openEditBlock(id) {
  const b = cycle.blocks.find(x => x.id === id);
  if (!b) return;

  editingBlock = b;
  document.getElementById('modalTitle').textContent = 'ブロックを編集';
  document.getElementById('editBlockId').value = id;
  document.getElementById('blockTitle').value = b.title;
  document.getElementById('blockType').value = b.type;
  document.getElementById('blockStart').value = b.startH;
  document.getElementById('blockEnd').value = b.endH;
  document.getElementById('deleteBlockBtn').style.display = 'inline-flex';

  renderDaySelect(b.date);
  onBlockTypeChange();
  document.getElementById('blockModal').style.display = 'flex';
}

function renderDaySelect(selectedDate) {
  const sel = document.getElementById('blockDays');
  const days = getCycleDays();
  sel.innerHTML = days.map(d => `
    <option value="${d.iso}" ${d.iso === selectedDate ? 'selected' : ''}>
      ${d.dayName} ${d.month}/${d.day}
    </option>
  `).join('');
}

function onBlockTypeChange() {
  const type = document.getElementById('blockType').value;
  const taskWrap = document.getElementById('taskLinkWrap');
  taskWrap.style.display = type === 'task' ? 'block' : 'none';

  if (type === 'task') {
    const sel = document.getElementById('linkedTask');
    sel.innerHTML = '<option value="">— タスクを選択 —</option>' +
      tasks.map(t => `<option value="${t.id}">${t.title}</option>`).join('');
  }
}

function saveBlock() {
  const title = document.getElementById('blockTitle').value.trim();
  const type  = document.getElementById('blockType').value;
  const startH = parseInt(document.getElementById('blockStart').value);
  const endH   = parseInt(document.getElementById('blockEnd').value);
  const sel = document.getElementById('blockDays');
  const selectedDates = Array.from(sel.selectedOptions).map(o => o.value);

  if (!title) { alert('タイトルを入力してください'); return; }
  if (isNaN(startH) || isNaN(endH) || endH <= startH) {
    alert('時間を正しく入力してください（終了 > 開始）');
    return;
  }
  if (selectedDates.length === 0) { alert('日付を選択してください'); return; }

  const editId = document.getElementById('editBlockId').value;

  if (editId) {
    // 編集
    cycle.blocks = cycle.blocks.filter(b => b.id !== editId);
  }

  // 選択された日付すべてにブロック追加
  selectedDates.forEach(date => {
    const id = `blk_${date}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    cycle.blocks.push({
      id,
      date,
      title,
      type,
      category: type === 'task' ? 'work' : type,
      startH,
      endH,
      estimatedMinutes: (endH - startH) * 60,
      actualMinutes: null,
      status: 'pending',
      linkedTask: document.getElementById('linkedTask').value || null,
    });
  });

  saveCycle();
  closeBlockModal();
  renderAll();
}

function deleteBlock() {
  const id = document.getElementById('editBlockId').value;
  if (!id) return;
  if (!confirm('このブロックを削除しますか？')) return;
  cycle.blocks = cycle.blocks.filter(b => b.id !== id);
  saveCycle();
  closeBlockModal();
  renderAll();
}

function closeBlockModal() {
  document.getElementById('blockModal').style.display = 'none';
  editingBlock = null;
}

// --------- タスクモーダル ---------
function openAddTaskModal() {
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskEstimate').value = '';
  document.getElementById('taskModal').style.display = 'flex';
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const category = document.getElementById('taskCategory').value;
  const estimatedMinutes = parseInt(document.getElementById('taskEstimate').value);
  const priority = document.getElementById('taskPriority').value;

  if (!title) { alert('タスク名を入力してください'); return; }

  tasks.push({
    id: `task_${Date.now()}`,
    title,
    category,
    estimatedMinutes: isNaN(estimatedMinutes) ? 60 : estimatedMinutes,
    priority,
    status: 'pending',
  });

  saveTasks();
  closeTaskModal();
  renderTaskList();
}

function closeTaskModal() {
  document.getElementById('taskModal').style.display = 'none';
}

// --------- ロック切り替え ---------
function toggleLock() {
  cycle.status = cycle.status === 'locked' ? 'draft' : 'locked';
  saveCycle();
  updateStatusBadge();
}

// --------- モーダル共通クローズ ---------
function closeModal(e, id) {
  if (e.target === document.getElementById(id)) {
    document.getElementById(id).style.display = 'none';
  }
}

// --------- ユーティリティ ---------

function getCycleDays() {
  const days = [];
  const DAY_NAMES = ['日','月','火','水','木','金','土'];
  const start = new Date(cycle.cycleStartDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push({
      iso: fmtISO(d),
      dayName: DAY_NAMES[d.getDay()],
      month: d.getMonth() + 1,
      day: d.getDate(),
    });
  }
  return days;
}

function fmtISO(date) {
  return date.toISOString().split('T')[0];
}

function fmtShort(date) {
  return `${date.getMonth()+1}/${date.getDate()}(${['日','月','火','水','木','金','土'][date.getDay()]})`;
}

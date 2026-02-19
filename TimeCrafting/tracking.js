// ===================================================
//  タイムクラフティング — 日次トラッキング
//  Phase 2: 実績記録 + 集中度/疲労度 + 週間サマリー
// ===================================================

'use strict';

let cycle      = null;
let viewDate   = null;   // 現在表示中の日付 (ISO)
let trackings  = {};     // { "2026-02-19": { blockId: { actualMinutes, status, focus, energy, note } } }
let focusVal   = 3;
let energyVal  = 3;

// --------- 初期化 ---------
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  viewDate = fmtISO(new Date());
  renderAll();
  checkReviewNudge();
});

function loadData() {
  const settings = JSON.parse(localStorage.getItem('tc_user_settings') || '{}');
  if (!settings.onboardingCompleted) {
    window.location.href = 'onboarding.html';
    return;
  }
  const cycleKey = localStorage.getItem('tc_current_cycle');
  if (cycleKey) cycle = JSON.parse(localStorage.getItem(cycleKey) || 'null');
  if (!cycle) { window.location.href = 'schedule.html'; return; }

  trackings = JSON.parse(localStorage.getItem('tc_trackings') || '{}');
}

function saveTrackings() {
  localStorage.setItem('tc_trackings', JSON.stringify(trackings));
}

// --------- 日付ナビゲーション ---------
function changeDay(delta) {
  const d = new Date(viewDate);
  d.setDate(d.getDate() + delta);
  const iso = fmtISO(d);
  // サイクル範囲内のみ
  if (iso >= cycle.cycleStartDate && iso <= cycle.cycleEndDate) {
    viewDate = iso;
    renderAll();
  }
}

// --------- 全体レンダリング ---------
function renderAll() {
  renderDateLabel();
  renderBlockCards();
  renderSummary();
  renderWeekProgress();
  updateNavButtons();
}

function renderDateLabel() {
  const d = new Date(viewDate);
  const DAY = ['日','月','火','水','木','金','土'];
  document.getElementById('trackDate').textContent =
    `${d.getMonth()+1}月${d.getDate()}日（${DAY[d.getDay()]}）`;

  document.getElementById('todayLabel').textContent =
    viewDate === fmtISO(new Date()) ? '今日の記録' : `${d.getMonth()+1}/${d.getDate()} の記録`;
}

function updateNavButtons() {
  document.getElementById('prevDayBtn').disabled = viewDate <= cycle.cycleStartDate;
  document.getElementById('nextDayBtn').disabled = viewDate >= cycle.cycleEndDate;
}

// --------- ブロックカード ---------
function renderBlockCards() {
  const container = document.getElementById('blockCards');
  const dayBlocks = cycle.blocks
    .filter(b => b.date === viewDate)
    .sort((a, b) => a.startH - b.startH);

  if (dayBlocks.length === 0) {
    container.innerHTML = `
      <div class="track-empty">
        <p>この日のブロックはありません。</p>
        <a href="schedule.html" class="btn btn-outline btn-sm">スケジュールに戻る</a>
      </div>
    `;
    return;
  }

  const dayTrack = trackings[viewDate] || {};

  container.innerHTML = dayBlocks.map(b => {
    const t = dayTrack[b.id] || {};
    const status = t.status || 'pending';
    return `
      <div class="block-track-card block-cat-${b.category || b.type} track-status-${status}"
           onclick="openTrackModal('${b.id}')">
        <div class="btc-left">
          <span class="btc-icon">${statusIcon(status)}</span>
        </div>
        <div class="btc-body">
          <p class="btc-title">${b.title}</p>
          <p class="btc-time">${b.startH}:00 〜 ${b.endH < 24 ? b.endH : b.endH-24}:00
            （見積 ${b.estimatedMinutes}分）</p>
          ${t.actualMinutes != null ? `<p class="btc-actual">実績: <strong>${t.actualMinutes}分</strong>
            <span class="btc-diff ${t.actualMinutes > b.estimatedMinutes ? 'over' : 'under'}">
              ${diffStr(t.actualMinutes, b.estimatedMinutes)}
            </span></p>` : ''}
          ${t.note ? `<p class="btc-note">💬 ${t.note}</p>` : ''}
          ${t.focus ? `<p class="btc-mood">集中 ${'★'.repeat(t.focus)}${'☆'.repeat(5-t.focus)}
            　疲労 ${'★'.repeat(t.energy||0)}${'☆'.repeat(5-(t.energy||0))}</p>` : ''}
        </div>
        <div class="btc-right">
          <span class="btc-status-label">${statusLabel(status)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function statusIcon(s) {
  return { completed:'✅', in_progress:'⏳', skipped:'⏭', pending:'○' }[s] || '○';
}
function statusLabel(s) {
  return { completed:'完了', in_progress:'進行中', skipped:'スキップ', pending:'未実施' }[s] || '未実施';
}
function diffStr(actual, est) {
  const d = actual - est;
  return d === 0 ? '±0分' : d > 0 ? `+${d}分` : `${d}分`;
}

// --------- サマリー ---------
function renderSummary() {
  const dayTrack = trackings[viewDate] || {};
  const dayBlocks = cycle.blocks.filter(b => b.date === viewDate);

  const completed = Object.values(dayTrack).filter(t => t.status === 'completed').length;
  const totalActual = Object.values(dayTrack)
    .filter(t => t.actualMinutes != null)
    .reduce((s, t) => s + t.actualMinutes, 0);
  const totalEst = dayBlocks.reduce((s, b) => s + b.estimatedMinutes, 0);
  const diff = totalActual - totalEst;

  document.getElementById('completedCount').textContent =
    `${completed} / ${dayBlocks.length} ブロック`;
  document.getElementById('totalActual').textContent =
    totalActual ? `${totalActual}分` : '—';
  document.getElementById('diffTime').innerHTML = totalActual
    ? `<span class="${diff > 0 ? 'diff-over' : 'diff-under'}">${diff > 0 ? '+' : ''}${diff}分</span>`
    : '—';
}

// --------- 週間進捗ドット ---------
function renderWeekProgress() {
  const el = document.getElementById('weekProgress');
  const days = getCycleDays();

  el.innerHTML = days.map(d => {
    const dayTrack = trackings[d.iso] || {};
    const dayBlocks = cycle.blocks.filter(b => b.date === d.iso);
    const total = dayBlocks.length;
    const done  = Object.values(dayTrack).filter(t => t.status === 'completed').length;
    const pct   = total > 0 ? done / total : 0;
    const isView = d.iso === viewDate;
    const isPast = d.iso < fmtISO(new Date());

    return `
      <div class="week-dot-wrap ${isView ? 'view' : ''}" onclick="viewDate='${d.iso}'; renderAll();">
        <div class="week-dot" style="background: ${dotColor(pct, isPast, total)}"></div>
        <span class="week-dot-label">${d.dayName}</span>
      </div>
    `;
  }).join('');
}

function dotColor(pct, isPast, total) {
  if (total === 0) return '#E5E7EB';
  if (!isPast && pct === 0) return '#E5E7EB';
  if (pct >= 1.0) return '#10B981';
  if (pct >= 0.5) return '#F59E0B';
  return '#EF4444';
}

// --------- レビュー促進 ---------
function checkReviewNudge() {
  if (!cycle) return;
  const today = fmtISO(new Date());
  if (today >= cycle.cycleEndDate) {
    document.getElementById('reviewNudge').style.display = 'block';
  }
}

// --------- トラッキングモーダル ---------
function openTrackModal(blockId) {
  const b = cycle.blocks.find(x => x.id === blockId);
  if (!b) return;

  const dayTrack = trackings[viewDate] || {};
  const t = dayTrack[blockId] || {};

  document.getElementById('trackModalTitle').textContent = b.title + ' — 実績を記録';
  document.getElementById('trackingBlockId').value = blockId;
  document.getElementById('trackStatus').value = t.status || 'completed';
  document.getElementById('trackActual').value = t.actualMinutes ?? b.estimatedMinutes;
  document.getElementById('trackNote').value = t.note || '';

  focusVal  = t.focus || 3;
  energyVal = t.energy || 3;

  renderStars('focusStars', focusVal);
  renderStars('energyStars', energyVal);

  document.getElementById('trackModal').style.display = 'flex';
  setTimeout(() => document.getElementById('trackActual').focus(), 100);
}

function renderStars(containerId, val) {
  const container = document.getElementById(containerId);
  container.innerHTML = [1,2,3,4,5].map(i =>
    `<button class="star-btn ${i <= val ? 'filled' : ''}"
             onclick="setStar('${containerId}',${i})"
             type="button">★</button>`
  ).join('');
}

function setStar(containerId, val) {
  if (containerId === 'focusStars') focusVal = val;
  else energyVal = val;
  renderStars(containerId, val);
}

function saveTracking() {
  const blockId = document.getElementById('trackingBlockId').value;
  const status  = document.getElementById('trackStatus').value;
  const actual  = parseInt(document.getElementById('trackActual').value);
  const note    = document.getElementById('trackNote').value.trim();

  if (!trackings[viewDate]) trackings[viewDate] = {};
  trackings[viewDate][blockId] = {
    status,
    actualMinutes: isNaN(actual) ? null : actual,
    focus: focusVal,
    energy: energyVal,
    note,
    recordedAt: new Date().toISOString(),
  };

  saveTrackings();
  closeBlockTrackModal();
  renderAll();
}

function closeBlockTrackModal() {
  document.getElementById('trackModal').style.display = 'none';
}

function closeTrackModal(e) {
  if (e.target === document.getElementById('trackModal')) closeBlockTrackModal();
}

// --------- ユーティリティ ---------
function getCycleDays() {
  const days = [];
  const NAMES = ['日','月','火','水','木','金','土'];
  const start = new Date(cycle.cycleStartDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push({ iso: fmtISO(d), dayName: NAMES[d.getDay()] });
  }
  return days;
}

function fmtISO(date) {
  return date.toISOString().split('T')[0];
}

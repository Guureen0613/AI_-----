// ===================================================
//  タイムクラフティング — オンボーディング
//  Phase 0: 今日の曜日から7日間サイクルを即スタート
// ===================================================

'use strict';

// --------- 状態 ---------
const state = {
  currentScreen: 1,
  totalScreens: 5,
  targetFreeHours: 3,
  blocks: [],          // 追加したブロック
  cycleStart: null,    // サイクル開始日 (Date)
  cycleEnd: null,      // サイクル終了日 (Date)
};

// --------- 初期化 ---------
document.addEventListener('DOMContentLoaded', () => {
  initCycle();
  renderCycleInfo();
  updateProgress();
});

// --------- サイクル計算（今日から7日間） ---------
function initCycle() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 6);

  state.cycleStart = today;
  state.cycleEnd = end;
}

function formatDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}(${['日','月','火','水','木','金','土'][date.getDay()]})`;
}

function renderCycleInfo() {
  const el = document.getElementById('cycleInfo');
  if (!el) return;
  el.innerHTML = `
    <span class="ob-cycle-badge">Week 1</span>
    <span class="ob-cycle-range">${formatDate(state.cycleStart)} 〜 ${formatDate(state.cycleEnd)}</span>
  `;
}

// --------- 画面遷移 ---------
function nextScreen(num) {
  // 画面2は必須（自由時間が未選択なら止める）
  if (num === 3 && !state.targetFreeHours) {
    shakeEl(document.getElementById('freeTimeChoices'));
    return;
  }

  const current = document.getElementById(`screen${state.currentScreen}`);
  const next = document.getElementById(`screen${num}`);
  if (!next) return;

  current.classList.remove('active');
  current.classList.add('exit');
  setTimeout(() => current.classList.remove('exit'), 400);

  next.classList.add('active');
  state.currentScreen = num;
  updateProgress();

  // 画面4: 自由時間サマリーを生成
  if (num === 4) renderFreeSummary();
}

function updateProgress() {
  const pct = ((state.currentScreen - 1) / (state.totalScreens - 1)) * 100;
  document.getElementById('progressBar').style.width = `${pct}%`;
}

// --------- 自由時間の選択 ---------
function selectFreeTime(btn) {
  document.querySelectorAll('.ob-choice').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.targetFreeHours = parseInt(btn.dataset.value);

  const nextBtn = document.getElementById('freeTimeNext');
  if (nextBtn) nextBtn.disabled = false;
}

// --------- テンプレートブロック追加 ---------
function addTemplate(id, title, category, startH, endH) {
  // 重複チェック
  if (state.blocks.find(b => b.id === id)) {
    shakeEl(document.querySelector(`[onclick*="'${id}'"]`));
    return;
  }

  // 終了が24時超の場合は翌日扱い（例: 睡眠 23〜7時）
  const adjEnd = endH > 24 ? endH - 24 : endH;

  const block = {
    id,
    title,
    category,
    startH,
    endH: adjEnd,
    estimatedMinutes: (endH - startH) * 60,
    type: 'life',
    applyAllDays: true,
  };
  state.blocks.push(block);
  renderBlockList();
}

function removeBlock(id) {
  state.blocks = state.blocks.filter(b => b.id !== id);
  renderBlockList();
}

function renderBlockList() {
  const list = document.getElementById('blockList');
  const count = document.getElementById('blockCount');
  if (!list) return;

  count.textContent = state.blocks.length;

  if (state.blocks.length === 0) {
    list.innerHTML = '<p class="ob-empty-hint">上のテンプレートからブロックを追加してください</p>';
    return;
  }

  list.innerHTML = state.blocks.map(b => `
    <div class="ob-block-item ob-cat-${b.category}">
      <span class="ob-block-title">${b.title}</span>
      <span class="ob-block-time">${b.startH}:00 〜 ${b.endH}:00</span>
      <button class="ob-block-remove" onclick="removeBlock('${b.id}')">✕</button>
    </div>
  `).join('');
}

// --------- カスタムブロック ---------
function openCustomBlock() {
  document.getElementById('customModal').style.display = 'flex';
}

function closeCustomModal() {
  document.getElementById('customModal').style.display = 'none';
}

function closeModal(e) {
  if (e.target === document.getElementById('customModal')) closeCustomModal();
}

function addCustomBlock() {
  const title = document.getElementById('customTitle').value.trim();
  const category = document.getElementById('customCategory').value;
  const startH = parseInt(document.getElementById('customStart').value);
  const endH = parseInt(document.getElementById('customEnd').value);

  if (!title || isNaN(startH) || isNaN(endH) || endH <= startH) {
    alert('名前と時間を正しく入力してください（終了 > 開始）');
    return;
  }

  const id = `custom_${Date.now()}`;
  state.blocks.push({
    id,
    title,
    category,
    startH,
    endH,
    estimatedMinutes: (endH - startH) * 60,
    type: 'fixed',
    applyAllDays: false,
  });

  renderBlockList();
  closeCustomModal();
  // フォームリセット
  document.getElementById('customTitle').value = '';
  document.getElementById('customStart').value = '';
  document.getElementById('customEnd').value = '';
}

// --------- 自由時間サマリー計算 ---------
function renderFreeSummary() {
  const el = document.getElementById('freeSummary');
  if (!el) return;

  // 1日の総時間 = 16時間（8:00〜24:00）と仮定
  const DAILY_HOURS = 16;
  const totalBlockedHours = state.blocks
    .filter(b => b.type !== 'sleep')
    .reduce((sum, b) => sum + (b.endH - b.startH), 0);

  const freeH = Math.max(0, DAILY_HOURS - totalBlockedHours);
  const target = state.targetFreeHours;
  const diff = freeH - target;
  const status = diff >= 0 ? 'good' : 'warn';

  el.innerHTML = `
    <div class="ob-free-card ob-free-${status}">
      <div class="ob-free-row">
        <span class="ob-free-label">推定ゆとり時間</span>
        <span class="ob-free-val">${freeH.toFixed(1)} 時間 / 日</span>
      </div>
      <div class="ob-free-row">
        <span class="ob-free-label">目標</span>
        <span class="ob-free-val">${target} 時間</span>
      </div>
      <div class="ob-free-bar-wrap">
        <div class="ob-free-bar" style="width:${Math.min(100, (freeH / target) * 100)}%"></div>
      </div>
      <p class="ob-free-msg">${
        diff >= 0
          ? `✅ 目標より <strong>${diff.toFixed(1)}時間</strong> 余裕があります`
          : `⚠️ 目標より <strong>${Math.abs(diff).toFixed(1)}時間</strong> 少ないです。ブロックを減らすか目標を調整しましょう`
      }</p>
    </div>
  `;

  // コンバイン提案チェック
  checkCombineSuggestion();
}

// --------- コンバイン提案（ルールベース） ---------
function checkCombineSuggestion() {
  const workBlocks = state.blocks.filter(b => b.category === 'work');
  if (workBlocks.length >= 2) {
    const b1 = workBlocks[0];
    const b2 = workBlocks[1];
    const totalMin = b1.estimatedMinutes + b2.estimatedMinutes;
    if (totalMin <= 120) {
      document.getElementById('combineArea').style.display = 'block';
      document.getElementById('combineBody').innerHTML =
        `「${b1.title}」と「${b2.title}」は同じカテゴリで合計 ${totalMin} 分。<br>2時間ブロックにまとめると集中しやすくなります。`;
    }
  }
}

function acceptCombine() {
  document.getElementById('combineArea').style.display = 'none';
  // TODO: Phase 1 でスケジュールグリッドに実装
}

function dismissCombine() {
  document.getElementById('combineArea').style.display = 'none';
}

// --------- オンボーディング完了 → LocalStorage 保存 ---------
function finishOnboarding() {
  // ユーザー設定を保存
  const userSettings = {
    targetFreeHours: state.targetFreeHours,
    onboardingCompleted: true,
    onboardingDate: new Date().toISOString(),
  };
  localStorage.setItem('tc_user_settings', JSON.stringify(userSettings));

  // サイクル情報を保存
  const cycleKey = `cycle_${fmtISO(state.cycleStart)}_${fmtISO(state.cycleEnd)}`;
  const cycle = {
    id: cycleKey,
    cycleStartDate: fmtISO(state.cycleStart),
    cycleEndDate: fmtISO(state.cycleEnd),
    cycleNumber: 1,
    status: 'draft',
    blocks: buildInitialBlocks(),
  };
  localStorage.setItem('tc_current_cycle', cycleKey);
  localStorage.setItem(cycleKey, JSON.stringify(cycle));

  // メイン画面（スケジュール）へ遷移
  window.location.href = 'schedule.html';
}

// --------- ユーティリティ ---------

// YYYY-MM-DD形式
function fmtISO(date) {
  return date.toISOString().split('T')[0];
}

// 7日分 × 各ブロックを展開（applyAllDays = true のものを全日に）
function buildInitialBlocks() {
  const result = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(state.cycleStart);
    date.setDate(date.getDate() + d);
    const dateStr = fmtISO(date);

    state.blocks.forEach(b => {
      if (b.applyAllDays) {
        result.push({
          ...b,
          date: dateStr,
          id: `${b.id}_${dateStr}`,
          actualMinutes: null,
          status: 'pending',
        });
      }
    });

    // applyAllDays = false のものは初日のみ
    if (d === 0) {
      state.blocks.filter(b => !b.applyAllDays).forEach(b => {
        result.push({
          ...b,
          date: dateStr,
          actualMinutes: null,
          status: 'pending',
        });
      });
    }
  }
  return result;
}

// 要素をシェイク（バリデーション失敗時）
function shakeEl(el) {
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 600);
}

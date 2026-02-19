// ===================================================
//  タイムクラフティング — 週の振り返り
//  Phase 3: 5次元評価 + AI提案 + シェアカード
// ===================================================

'use strict';

const DIMS = ['work','relationships','health','growth','freeTime'];
const DIM_LABELS = {
  work: '仕事', relationships: 'つながり', health: '体と心',
  growth: '学び', freeTime: 'ゆとり'
};
const DIM_ICONS = {
  work: '🏢', relationships: '🤝', health: '❤️', growth: '🚀', freeTime: '🌿'
};

let cycle     = null;
let trackings = {};
let scores    = { overall: 7, work: 7, relationships: 7, health: 7, growth: 7, freeTime: 7 };
let acceptedProposals = [];
const reviewStartTime = Date.now(); // Sora 指摘: 記入時間計測

// --------- 初期化 ---------
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderCycleBadge();
  renderDimStats();
  renderProposals();
  initSliders();
});

function loadData() {
  const settings = JSON.parse(localStorage.getItem('tc_user_settings') || '{}');
  if (!settings.onboardingCompleted) {
    window.location.href = 'onboarding.html'; return;
  }
  const cycleKey = localStorage.getItem('tc_current_cycle');
  if (cycleKey) cycle = JSON.parse(localStorage.getItem(cycleKey) || 'null');
  if (!cycle) { window.location.href = 'schedule.html'; return; }
  trackings = JSON.parse(localStorage.getItem('tc_trackings') || '{}');
}

function initSliders() {
  updateOverallScore(7);
  DIMS.forEach(d => updateDimScore(d, 7));
}

// --------- サイクルバッジ ---------
function renderCycleBadge() {
  if (!cycle) return;
  const s = new Date(cycle.cycleStartDate);
  const e = new Date(cycle.cycleEndDate);
  document.getElementById('cycleBadge').textContent =
    `Week ${cycle.cycleNumber}（${fmt(s)}〜${fmt(e)}）`;
}
function fmt(d) {
  return `${d.getMonth()+1}/${d.getDate()}`;
}

// --------- スライダー更新 ---------
function updateOverallScore(val) {
  val = parseInt(val);
  scores.overall = val;
  document.getElementById('overallDisplay').textContent = `${val} / 10`;
  document.getElementById('overallDisplay').style.color = scoreColor(val);
}

function updateDimScore(dim, val) {
  val = parseInt(val);
  scores[dim] = val;
  const badge = document.getElementById(`badge_${dim}`);
  if (badge) {
    badge.textContent = `${val}/10`;
    badge.style.background = scoreColor(val) + '22';
    badge.style.color = scoreColor(val);
  }
  renderProposals(); // スコアが変わるたびに提案を再生成
}

function scoreColor(v) {
  if (v >= 8) return '#10B981';
  if (v >= 6) return '#F59E0B';
  return '#EF4444';
}

// --------- 5次元: 実績データ表示 ---------
function renderDimStats() {
  if (!cycle) return;

  // 各次元の実績統計
  const blocksByDay = {};
  cycle.blocks.forEach(b => {
    if (!blocksByDay[b.date]) blocksByDay[b.date] = [];
    blocksByDay[b.date].push(b);
  });

  const allTrackEntries = Object.values(trackings).flatMap(d => Object.values(d));
  const completed = allTrackEntries.filter(t => t.status === 'completed').length;
  const total     = cycle.blocks.length;

  // 仕事
  document.getElementById('stats_work').innerHTML =
    `<span>完了ブロック: ${completed} / ${total}</span>`;

  // 体と心: 睡眠・運動ブロックを集計
  const sleepBlocks  = cycle.blocks.filter(b => b.category === 'sleep');
  const exerciseBlocks = cycle.blocks.filter(b => b.category === 'exercise');
  document.getElementById('stats_health').innerHTML =
    `<span>睡眠ブロック: ${sleepBlocks.length}件 / 運動ブロック: ${exerciseBlocks.length}件</span>`;

  // ゆとり
  const freeBlocks = cycle.blocks.filter(b => b.type === 'free');
  const freeH = freeBlocks.reduce((s, b) => s + (b.endH - b.startH), 0);
  document.getElementById('stats_freeTime').innerHTML =
    `<span>ゆとりブロック: 合計 ${freeH}時間</span>`;
}

// --------- AI提案（ルールベース） ---------
function renderProposals() {
  const proposals = generateProposals();
  const container = document.getElementById('proposalCards');
  if (!container) return;

  if (proposals.length === 0) {
    container.innerHTML = '<p class="empty-hint">スコアが全体的に良好です！来週も同じリズムを続けましょう。</p>';
    return;
  }

  container.innerHTML = proposals.map((p, i) => `
    <div class="proposal-card ${acceptedProposals.includes(i) ? 'accepted' : ''}" id="proposal_${i}">
      <div class="proposal-header">
        <span class="proposal-tag">${p.tag}</span>
        <span class="proposal-impact">効果: ${p.impact}</span>
      </div>
      <p class="proposal-body">${p.body}</p>
      <div class="proposal-actions">
        <button class="btn btn-ghost btn-sm" onclick="dismissProposal(${i})">スキップ</button>
        <button class="btn btn-primary btn-sm" onclick="acceptProposal(${i})">
          ${acceptedProposals.includes(i) ? '✅ 採用済み' : '来週に反映する'}
        </button>
      </div>
    </div>
  `).join('');
}

function generateProposals() {
  const props = [];

  if (scores.health < 6) {
    props.push({
      tag: '体と心',
      body: '睡眠ブロックを1時間増やすか、就寝時間を30分早めることを検討してみましょう。',
      impact: '体と心 +2pts',
    });
  }
  if (scores.freeTime < 6) {
    props.push({
      tag: 'ゆとり',
      body: '優先度「低」のタスクを1つ翌サイクルに先送りして、ゆとりブロックを増やしましょう。',
      impact: 'ゆとり +1.5pts',
    });
  }
  if (scores.relationships < 6) {
    props.push({
      tag: 'つながり',
      body: '週1回、30分だけ友人・家族との時間をスケジュールに入れてみましょう。',
      impact: 'つながり +2pts',
    });
  }
  if (scores.growth < 6) {
    props.push({
      tag: '学び',
      body: '毎朝15分の学習ブロックを追加するだけで、週に1.75時間の成長時間が生まれます。',
      impact: '学び +1.5pts',
    });
  }
  if (scores.work < 6) {
    props.push({
      tag: '仕事',
      body: '深い集中作業のブロックを午前中の最初の2時間に確保しましょう。午後より効率が上がります。',
      impact: '仕事 +2pts',
    });
  }
  // 全体が低いとき
  if (scores.overall < 5) {
    props.push({
      tag: '全体',
      body: '来週は「やらないこと」を1つ決めましょう。削減することも立派なクラフティングです。',
      impact: '全体 +1pts',
    });
  }

  return props;
}

function acceptProposal(i) {
  if (!acceptedProposals.includes(i)) acceptedProposals.push(i);
  renderProposals();
}

function dismissProposal(i) {
  document.getElementById(`proposal_${i}`)?.remove();
}

// --------- シェアカード生成（Leo 提案） ---------
function generateShareCard() {
  const canvas = document.getElementById('shareCanvas');
  const ctx    = canvas.getContext('2d');
  const W = 600, H = 315;

  // 背景グラデーション
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#6C63FF');
  grad.addColorStop(1, '#A78BFA');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // タイトル
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, 0, W, 56);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px "Hiragino Sans", sans-serif';
  ctx.fillText('⏳ TimeCrafting', 20, 36);
  ctx.font = '14px "Hiragino Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const badge = document.getElementById('cycleBadge').textContent;
  ctx.fillText(badge, W - ctx.measureText(badge).width - 20, 36);

  // 総合スコア
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px "Hiragino Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${scores.overall}`, W / 2, 160);
  ctx.font = 'bold 24px "Hiragino Sans", sans-serif';
  ctx.fillText('/ 10', W / 2 + 44, 152);
  ctx.font = '16px "Hiragino Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('今週の満足度', W / 2, 190);

  // 5次元ミニバー
  const barW = (W - 80) / 5;
  DIMS.forEach((dim, i) => {
    const x = 40 + i * barW + barW * 0.1;
    const bw = barW * 0.8;
    const maxH = 50;
    const h = (scores[dim] / 10) * maxH;
    const y = 255;

    // バー背景
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.roundRect(x, y - maxH, bw, maxH, 4);
    ctx.fill();

    // バー値
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.roundRect(x, y - h, bw, h, 4);
    ctx.fill();

    // ラベル
    ctx.fillStyle = '#fff';
    ctx.font = '11px "Hiragino Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(DIM_LABELS[dim], x + bw / 2, y + 16);
  });

  // ハッシュタグ
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px "Hiragino Sans", sans-serif';
  ctx.fillText('#タイムクラフティング', 20, H - 14);
}

function downloadShareCard() {
  generateShareCard();
  const canvas = document.getElementById('shareCanvas');
  const link = document.createElement('a');
  link.download = `timecrafting_week${cycle?.cycleNumber || 1}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// --------- 満足度履歴グラフ（Chart.js 遅延ロード後に呼ばれる） ---------
function initHistoryChart() {
  const reviews = JSON.parse(localStorage.getItem('tc_reviews') || '[]');
  if (reviews.length < 2) return;

  const section = document.getElementById('reviewStep1');
  const chartWrap = document.createElement('div');
  chartWrap.innerHTML = `
    <div class="history-chart-wrap">
      <p class="sidebar-label" style="margin-bottom:12px;">スコアの推移</p>
      <canvas id="historyChart" height="180"></canvas>
    </div>
  `;
  section.querySelector('.review-card').appendChild(chartWrap);

  const labels  = reviews.map((r, i) => `Week ${i + 1}`);
  const datasets = DIMS.map(dim => ({
    label: DIM_LABELS[dim],
    data: reviews.map(r => r.dimensionScores[dim]?.score || 0),
    borderWidth: 2,
    tension: 0.4,
    pointRadius: 3,
  }));

  new Chart(document.getElementById('historyChart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { min: 0, max: 10, ticks: { stepSize: 2 } } },
    },
  });
}

// --------- 保存して翌週へ ---------
function saveReview() {
  const duration = Math.round((Date.now() - reviewStartTime) / 1000);

  // Sora 指摘: <10秒はゴミデータフラグ
  const isLowQuality = duration < 10;

  const record = {
    id: `review_cycle${cycle.cycleNumber}`,
    cycleNumber: cycle.cycleNumber,
    cycleStartDate: cycle.cycleStartDate,
    cycleEndDate: cycle.cycleEndDate,
    overallScore: scores.overall,
    dimensionScores: Object.fromEntries(
      DIMS.map(d => [d, {
        score: scores[d],
        comment: document.getElementById(`comment_${d}`)?.value?.trim() || '',
      }])
    ),
    acceptedProposals,
    durationSeconds: duration,
    isLowQuality,
    recordedAt: new Date().toISOString(),
  };

  const reviews = JSON.parse(localStorage.getItem('tc_reviews') || '[]');
  reviews.push(record);
  localStorage.setItem('tc_reviews', JSON.stringify(reviews));

  // サイクルを completed に
  cycle.status = 'completed';
  localStorage.setItem(cycle.id, JSON.stringify(cycle));

  // 翌サイクル作成
  createNextCycle();

  alert('振り返りを保存しました！来週のスケジュールを作りましょう。');
  window.location.href = 'schedule.html';
}

function createNextCycle() {
  const lastEnd = new Date(cycle.cycleEndDate);
  const nextStart = new Date(lastEnd);
  nextStart.setDate(nextStart.getDate() + 1);
  const nextEnd = new Date(nextStart);
  nextEnd.setDate(nextEnd.getDate() + 6);

  const newCycle = {
    id: `cycle_${fmtISO(nextStart)}_${fmtISO(nextEnd)}`,
    cycleStartDate: fmtISO(nextStart),
    cycleEndDate: fmtISO(nextEnd),
    cycleNumber: cycle.cycleNumber + 1,
    status: 'draft',
    blocks: [],
  };

  localStorage.setItem('tc_current_cycle', newCycle.id);
  localStorage.setItem(newCycle.id, JSON.stringify(newCycle));
}

function fmtISO(date) {
  return date.toISOString().split('T')[0];
}

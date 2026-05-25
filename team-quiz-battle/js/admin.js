// =============================================
// admin.js — 관리자 뷰 (교사용 패널)
// =============================================

import { renderAdminMatchupTable } from './matchup.js';

// 관리자 뷰 초기화
export function initAdminView({
  roomCode,
  onForceLock,           // 강제 마감 버튼
  onStartMatchupTimer,   // 100초 카운트다운 시작 버튼
  onStartCountdown,      // 5초 카운트다운 시작
  onNextQuestion,        // 다음 문제
  onEndGame,             // 게임 끝내기
  onResetGame,           // 새 게임 시작 (초기화)
  onScoreAdjust          // 점수 조절 (teamNum, delta)
}) {
  document.getElementById('admin-room-badge').textContent = roomCode;

  // 100초 카운트다운 시작 버튼
  document.getElementById('btn-start-matchup-timer')?.addEventListener('click', () => {
    disableMatchupTimerButton();
    onStartMatchupTimer && onStartMatchupTimer();
  });

  document.getElementById('btn-force-lock').addEventListener('click', () => {
    if (confirm('대진표를 강제 마감하고 빈칸을 자동으로 채울까요?')) {
      onForceLock();
    }
  });

  document.getElementById('btn-start-game')?.addEventListener('click', () => {
    onNextQuestion(); // 첫 문제 시작
  });

  document.getElementById('btn-start-countdown').addEventListener('click', onStartCountdown);

  document.getElementById('btn-next-question').addEventListener('click', () => {
    onNextQuestion(); // 제출 현황 확인 후 필요 시 confirm은 app.js에서 처리
  });

  document.getElementById('btn-end-game').addEventListener('click', () => {
    if (confirm('게임을 끝내고 시상식을 진행할까요?')) {
      onEndGame();
    }
  });

  // 세션 초기화 버튼 (HTML에 항상 존재)
  document.getElementById('btn-reset-room')?.addEventListener('click', () => {
    if (confirm('방을 완전히 삭제하고 모든 참여자를 처음 화면으로 보낼까요?\n(이 작업은 되돌릴 수 없습니다)')) {
      onResetGame();
    }
  });

  // 점수 조절 버튼은 renderAdminScorePanel에서 이벤트 등록
  window._adminScoreAdjust = onScoreAdjust;
}

// 대기실 ↔ 게임 단계 전환
export function switchAdminSection(section) {
  document.getElementById('admin-lobby').classList.toggle('hidden', section !== 'lobby');
  document.getElementById('admin-game').classList.toggle('hidden',  section !== 'game');
}

// =============================================
// =============================================
// 대진표 카운트다운 시작 버튼 비활성화
// =============================================
export function disableMatchupTimerButton() {
  const btn = document.getElementById('btn-start-matchup-timer');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ 카운트다운 진행 중';
}

// =============================================
// 대진표 타이머 업데이트
// =============================================
export function updateAdminMatchupTimer(remaining) {
  const el = document.getElementById('admin-matchup-timer');
  if (!el) return;
  el.textContent = Math.max(0, Math.ceil(remaining));
  if (remaining <= 10) el.style.color = 'var(--c-red)';
}

// =============================================
// 대진표 테이블 렌더링
// =============================================
export function renderAdminMatchup({ questions, teamCount, allMatchups }) {
  renderAdminMatchupTable({
    container:  document.getElementById('admin-matchup-table'),
    questions,
    teamCount,
    allMatchups
  });
}

// =============================================
// 현재 문제 미리보기
// =============================================
export function updateAdminQuestionPreview(q, qIndex, total) {
  document.getElementById('admin-q-index').textContent =
    `문제 ${qIndex + 1} / ${total}`;
  document.getElementById('admin-q-preview').textContent =
    `[${q.type}] ${q.content || '(내용 없음)'}  ← 정답: ${q.rawAnswer}`;
}

// =============================================
// 점수 조절 패널
// teams: { 1: { score }, 2: ... }
// =============================================
export function renderAdminScorePanel(teams) {
  const panel = document.getElementById('admin-score-panel');
  panel.innerHTML = '';

  Object.entries(teams).sort(([a],[b]) => a-b).forEach(([num, t]) => {
    const card = document.createElement('div');
    card.className = 'admin-score-card';
    card.id = `admin-score-card-${num}`;

    const nameEl  = document.createElement('div');
    nameEl.className = 'admin-score-name';
    nameEl.textContent = `${num}모둠`;

    const valEl   = document.createElement('div');
    valEl.className = 'admin-score-val';
    valEl.textContent = t.score || 0;

    const btnsEl  = document.createElement('div');
    btnsEl.className = 'admin-score-btns';

    ['+1', '-1', '+5', '-5'].forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'admin-score-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        const delta = parseInt(label);
        window._adminScoreAdjust && window._adminScoreAdjust(parseInt(num), delta);
      });
      btnsEl.appendChild(btn);
    });

    card.append(nameEl, valEl, btnsEl);
    panel.appendChild(card);
  });
}

// 점수 패널 값만 업데이트 (전체 리렌더 없이)
export function updateAdminScoreCard(teamNum, score) {
  const card = document.getElementById(`admin-score-card-${teamNum}`);
  if (!card) return;
  const valEl = card.querySelector('.admin-score-val');
  if (valEl) valEl.textContent = score;
}

// =============================================
// 실시간 제출 현황 (게임 중)
// =============================================
export function renderAdminLiveAnswers(teams, answers) {
  const wrap = document.getElementById('admin-live-answers');
  wrap.innerHTML = '';

  Object.entries(teams).sort(([a],[b]) => a-b).forEach(([num]) => {
    const card = document.createElement('div');
    card.className = 'live-answer-card';
    card.id = `live-card-${num}`;

    const nameEl = document.createElement('div');
    nameEl.className = 'live-team-name';
    nameEl.textContent = `${num}모둠`;

    const ansEl  = document.createElement('div');
    ansEl.className = 'live-answer-val';

    const scoreEl = document.createElement('div');
    scoreEl.className = 'live-score-val';

    const ans = answers && answers[num];
    if (ans) {
      card.classList.add(ans.correct ? 'correct' : ans.value ? 'wrong' : 'submitted');
      ansEl.textContent  = ans.value || '제출됨';
      scoreEl.textContent = ans.correct ? `+${ans.score}점` : '0점';
    } else {
      ansEl.textContent  = '—';
      scoreEl.textContent = '';
    }

    card.append(nameEl, ansEl, scoreEl);
    wrap.appendChild(card);
  });
}

// 실시간 답변 카드 단건 업데이트
export function updateAdminLiveCard(teamNum, ansData) {
  const card = document.getElementById(`live-card-${teamNum}`);
  if (!card) return;
  card.className = 'live-answer-card ' + (ansData.correct ? 'correct' : 'wrong');
  const ansEl   = card.querySelector('.live-answer-val');
  const scoreEl = card.querySelector('.live-score-val');
  if (ansEl)   ansEl.textContent   = ansData.value || '제출됨';
  if (scoreEl) scoreEl.textContent = ansData.correct ? `+${ansData.score}점` : '0점';
}

// 게임 시작 버튼 표시
export function showStartGameButton() {
  const btn = document.getElementById('btn-start-game');
  if (btn) btn.classList.remove('hidden');
}

// 카운트다운 버튼 비활성화 — 게임 진행 중 (텍스트 유지)
export function disableCountdownButton() {
  const btn = document.getElementById('btn-start-countdown');
  if (!btn) return;
  btn.disabled = true;
}

// 카운트다운 버튼 비활성화 — 전체 모둠 제출 완료 표시
export function markCountdownComplete() {
  const btn = document.getElementById('btn-start-countdown');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '✅ 모든 모둠 제출 완료';
}

// 카운트다운 버튼 재활성화 (idle 단계 진입 시)
export function enableCountdownButton() {
  const btn = document.getElementById('btn-start-countdown');
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = '▶ 5초 카운트다운';
}

// =============================================
// 테스트용 링크 패널 표시
// 방 생성 직후 호출 — 각 역할별 URL을 복사할 수 있게 제공
// =============================================
export function showTestLinks(roomCode, teamCount) {
  // 이미 있으면 제거 후 재생성
  const existing = document.getElementById('test-links-panel');
  if (existing) existing.remove();

  const base = window.location.href.split('?')[0];

  const panel = document.createElement('div');
  panel.id = 'test-links-panel';
  panel.style.cssText = `
    background: #0f2d0f; border: 1px solid #22c55e;
    border-radius: 12px; padding: 16px; margin-top: 16px;
    font-size: .85rem;
  `;

  const title = document.createElement('p');
  title.style.cssText = 'font-weight:900;color:#22c55e;margin-bottom:10px;';
  title.textContent = '🔗 멀티탭 테스트 링크 (클릭하면 새 탭에서 열립니다)';
  panel.appendChild(title);

  const links = [
    { label: '📺 교실 상황판', url: `${base}?role=board&room=${roomCode}` },
    ...Array.from({ length: teamCount }, (_, i) => ({
      label: `👤 학생 (${i + 1}모둠)`,
      url:   `${base}?role=student&room=${roomCode}&team=${i + 1}`
    }))
  ];

  links.forEach(({ label, url }) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';

    const labelEl = document.createElement('span');
    labelEl.style.cssText = 'min-width:150px;color:#94a3b8;';
    labelEl.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = url;
    input.style.cssText = `
      flex:1; background:#1e293b; border:1px solid #334155;
      color:#f1f5f9; border-radius:6px; padding:6px 10px;
      font-size:.8rem; cursor:pointer;
    `;
    input.addEventListener('click', () => {
      navigator.clipboard.writeText(url).catch(() => input.select());
      input.style.borderColor = '#22c55e';
      setTimeout(() => input.style.borderColor = '#334155', 1000);
    });

    const openBtn = document.createElement('button');
    openBtn.textContent = '↗';
    openBtn.title = '새 탭에서 열기';
    openBtn.style.cssText = `
      background:#1e293b; border:1px solid #334155; color:#f1f5f9;
      border-radius:6px; padding:6px 10px; cursor:pointer; font-size:1rem;
    `;
    openBtn.addEventListener('click', () => window.open(url, '_blank'));

    row.append(labelEl, input, openBtn);
    panel.appendChild(row);
  });

  // 새 게임 시작 버튼도 여기에 배치
  const resetBtn = document.createElement('button');
  resetBtn.id = 'btn-reset-game';
  resetBtn.className = 'btn btn-warning';
  resetBtn.style.cssText = 'margin-top:12px;width:100%;';
  resetBtn.textContent = '🔄 새 게임 시작 (점수·대진표 초기화)';
  // 이벤트는 initAdminView에서 등록
  panel.appendChild(resetBtn);

  document.querySelector('.admin-wrap').appendChild(panel);

  // initAdminView 이벤트 재등록 (동적 생성이므로)
  resetBtn.addEventListener('click', () => {
    if (confirm('게임을 초기화하고 새 게임을 시작할까요?\n(점수·대진표·답변이 모두 초기화됩니다)')) {
      window._adminResetGame && window._adminResetGame();
    }
  });
}

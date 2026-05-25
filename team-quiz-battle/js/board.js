// =============================================
// board.js — 상황판 뷰 (교실 스크린용)
// =============================================

import * as Sound from './sound.js';
import { ITEM_INFO, MYSTERY_INFO } from './config.js';

// =============================================
// 모둠 패널 렌더링 (상단 30%)
// teams: { 1: { name, score, item, itemUsed, shieldActive, connected }, ... }
// =============================================
export function renderBoardTeams(teams) {
  const container = document.getElementById('board-teams');
  container.innerHTML = '';

  const sorted = Object.entries(teams).sort(([a], [b]) => a - b);

  for (const [num, t] of sorted) {
    const panel = document.createElement('div');
    panel.className = 'board-team-panel' + (t.connected ? ' connected' : '');
    panel.id = `board-team-${num}`;

    // 접속 상태 표시
    const connDot = document.createElement('div');
    connDot.className = 'board-team-conn' + (t.connected ? ' online' : '');

    // 모둠 이름
    const nameEl = document.createElement('div');
    nameEl.className = 'board-team-name';
    nameEl.textContent = `${num}모둠`;

    // 점수
    const scoreEl = document.createElement('div');
    scoreEl.className = 'board-team-score';
    scoreEl.innerHTML = `${t.score || 0}<span>점</span>`;

    // 아이템 (새 구조: items 객체)
    const itemEl = document.createElement('div');
    const availItems = Object.entries(t.items || {}).filter(([, v]) => v).map(([k]) => ITEM_INFO[k]?.name || k);
    const hasItem = availItems.length > 0;
    itemEl.className = 'board-team-item' + (hasItem ? ' has-item' : '');
    itemEl.textContent = t.shieldActive ? '🛡️ 쉴드 ' + (hasItem ? `+${availItems.join(' ')}` : '') :
      hasItem ? availItems.join(' / ') : '아이템 없음';

    panel.append(connDot, nameEl, scoreEl, itemEl);
    container.appendChild(panel);
  }
}

// =============================================
// 특정 모둠 점수만 업데이트 (전체 리렌더 없이)
// =============================================
export function updateBoardTeamScore(teamNum, score) {
  const panel = document.getElementById(`board-team-${teamNum}`);
  if (!panel) return;
  const scoreEl = panel.querySelector('.board-team-score');
  if (scoreEl) scoreEl.innerHTML = `${score}<span>점</span>`;
}

// =============================================
// 상황판 단계 표시 업데이트
// =============================================
export function setBoardPhase(phase) {
  const label = document.getElementById('board-phase-label');
  const phaseMap = {
    idle:        '대기 중',
    matchup:     '대진표 작성 중',
    countdown:   '카운트다운',
    answering:   '정답 입력 중',
    result:      '결과 확인',
    mystery:     '미스터리 카드',
    ended:       '게임 종료'
  };
  if (label) label.textContent = phaseMap[phase] || phase;
}

// =============================================
// 문제 표시 (중단 30%)
// =============================================
export function showBoardQuestion(q) {
  const textEl  = document.getElementById('board-question-text');
  const imgEl   = document.getElementById('board-question-img');
  const optArea = document.getElementById('board-options-display');

  textEl.textContent = q.content || '';

  // 이미지 표시
  if (q.imageUrl) {
    imgEl.src = q.imageUrl;
    imgEl.classList.remove('hidden');
    imgEl.onclick = () => showFullscreenImage(q.imageUrl);
  } else {
    imgEl.classList.add('hidden');
    imgEl.src = '';
  }

  // 유형별 보기 표시
  optArea.innerHTML = '';
  if (q.type === '객관식' && q.options?.length) {
    q.options.forEach((opt, i) => {
      const chip = document.createElement('div');
      chip.className = 'board-option-chip';
      chip.textContent = `${i + 1}. ${opt}`;
      optArea.appendChild(chip);
    });
  } else if (q.type === '선잇기') {
    const hint = document.createElement('div');
    hint.style.color = 'var(--c-sub)';
    hint.style.fontSize = '1rem';
    hint.textContent = '선 잇기 문제 — 각 항목을 올바르게 연결하세요';
    optArea.appendChild(hint);
  }
}

// =============================================
// 카운트다운 표시 (5~1)
// =============================================
let countdownInterval = null;

export function startBoardCountdown(seconds, onEnd) {
  const cdEl    = document.getElementById('board-countdown-display');
  const timerWrap = document.getElementById('board-timer-bar-wrap');

  cdEl.classList.remove('hidden');
  timerWrap.classList.add('hidden');

  let remaining = seconds;
  cdEl.textContent = remaining;

  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      cdEl.classList.add('hidden');
      onEnd && onEnd();
    } else {
      cdEl.textContent = remaining;
      Sound.playTick();
    }
  }, 1000);
}

export function stopBoardCountdown() {
  clearInterval(countdownInterval);
  const cdEl = document.getElementById('board-countdown-display');
  if (cdEl) cdEl.classList.add('hidden');
}

// =============================================
// 타이머 바 업데이트 (숫자 표시 제거 — 바만 표시)
// =============================================
export function updateBoardTimerBar(elapsed, total) {
  const wrap = document.getElementById('board-timer-bar-wrap');
  const bar  = document.getElementById('board-timer-bar');
  const num  = document.getElementById('board-timer-num');

  wrap.classList.remove('hidden');
  const pct = Math.max(0, Math.min(100, (1 - elapsed / total) * 100));
  bar.style.setProperty('--pct', pct + '%');
  // 숫자 카운트다운 숨김 (요청: 상황판에서 카운트다운 제거)
  if (num) num.classList.add('hidden');
}

export function hideBoardTimerBar() {
  const wrap = document.getElementById('board-timer-bar-wrap');
  if (wrap) wrap.classList.add('hidden');
}

// =============================================
// 결과 칩 표시 (하단 40%)
// results: [{ teamNum, teamName, answer, score, correct }]
// =============================================
export function showBoardResults(results, questionType) {
  const area = document.getElementById('board-result-area');
  area.innerHTML = '';

  const sorted = [...results].sort((a, b) => b.score - a.score);

  for (const r of sorted) {
    const chip = document.createElement('div');
    chip.className = 'board-result-chip ' + (r.correct ? 'correct' : 'wrong');

    const teamEl = document.createElement('div');
    teamEl.className = 'board-result-team';
    teamEl.textContent = `${r.teamNum}모둠`;

    const answerEl = document.createElement('div');
    answerEl.className = 'board-result-answer';

    if (r.correct) {
      answerEl.textContent = '✅ 정답';
    } else if (!r.answer) {
      answerEl.textContent = '❌ 미제출';
    } else if ((questionType || '').replace(/\s+/g, '') === '선잇기') {
      // 선잇기는 JSON 배열이므로 입력 내용 대신 결과만 표시
      answerEl.textContent = '❌ 오답';
    } else {
      answerEl.textContent = `❌ ${r.answer}`;
    }

    const scoreEl = document.createElement('div');
    scoreEl.className = 'board-result-score';
    if (r.correct && r.boostApplied) {
      scoreEl.textContent = `${r.baseScore}점×1.5배=${r.score}점`;
    } else {
      scoreEl.textContent = r.correct ? `+${r.score}점` : '0점';
    }

    chip.append(teamEl, answerEl, scoreEl);
    area.appendChild(chip);
  }
}

export function clearBoardResults() {
  const area = document.getElementById('board-result-area');
  if (area) area.innerHTML = '';
  const optArea = document.getElementById('board-options-display');
  if (optArea) optArea.innerHTML = '';
}

// 문제 텍스트·이미지 영역 지우기
export function clearBoardQuestion() {
  const textEl = document.getElementById('board-question-text');
  if (textEl) textEl.textContent = '';
  const imgEl = document.getElementById('board-question-img');
  if (imgEl) { imgEl.src = ''; imgEl.classList.add('hidden'); }
}

// =============================================
// 다음 문제 참전자 표시 (idle 단계에서 호출)
// allMatchups: { teamNum: { qIndex: name } }
// =============================================
export function showNextFighters(qIndex, questions, allMatchups, teamCount) {
  const q = questions[qIndex];
  if (!q) return;

  const textEl  = document.getElementById('board-question-text');
  const optArea = document.getElementById('board-options-display');

  if (textEl) {
    textEl.textContent = `다음 문제: Q${q.num}  [${q.type} / ${q.difficulty}]`;
    textEl.style.fontSize = 'clamp(1rem, 2.5vw, 1.6rem)';
    textEl.style.color = 'var(--c-sub)';
  }

  if (!optArea) return;
  optArea.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;justify-content:center;width:100%;';

  for (let t = 1; t <= teamCount; t++) {
    const fighter = allMatchups[t] && allMatchups[t][String(qIndex)];
    const chip = document.createElement('div');
    chip.style.cssText = `
      background:var(--c-surface2);
      border:2px solid var(--c-primary);
      border-radius:var(--radius);
      padding:12px 20px; text-align:center; min-width:100px;
    `;
    chip.innerHTML = `
      <div style="font-size:.85rem;color:var(--c-sub);margin-bottom:4px">${t}모둠</div>
      <div style="font-size:1.3rem;font-weight:900;color:var(--c-gold)">${fighter || '—'}</div>
    `;
    wrap.appendChild(chip);
  }

  optArea.appendChild(wrap);
}

// =============================================
// 미스터리 카드 영역 (하단 40%)
// deck: 8장 카드 배열 ['꽝', '쉴드', ...]
// choosingTeam: 선택권 가진 모둠 번호
// =============================================
// 상황판 미스터리 카드 덱 표시 (클릭 불가 — 클라이언트 선택에 연동됨)
export function showBoardMysteryDeck(deck, choosingTeam) {
  const area      = document.getElementById('board-mystery-area');
  const title     = document.getElementById('board-mystery-title');
  const cardsWrap = document.getElementById('board-mystery-cards');

  title.textContent = `🎴 ${choosingTeam}모둠 — 카드를 선택 중...`;
  cardsWrap.innerHTML = '';
  area.classList.remove('hidden');

  deck.forEach((cardName, i) => {
    const card = document.createElement('div');
    card.className = 'b-mystery-card';
    card.id = `board-mystery-card-${i}`;
    card.textContent = '🃏';
    card.dataset.cardName = cardName;
    card.style.cursor = 'default';
    cardsWrap.appendChild(card);
  });
}

// 클라이언트가 선택한 카드를 상황판에서 공개 + 효과 애니메이션
export function revealBoardMysteryCard(idx, cardName, effectData, message) {
  const card = document.getElementById(`board-mystery-card-${idx}`);
  if (!card || card.classList.contains('flipped')) return;

  card.classList.add('flipped');
  const info = MYSTERY_INFO[cardName] || { emoji: '❓', desc: '' };

  setTimeout(() => {
    card.classList.add('revealed');
    card.textContent = '';
    const emojiEl = document.createElement('div');
    emojiEl.style.fontSize = '1.4rem';
    emojiEl.textContent = info.emoji;
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:.65rem;margin-top:2px;';
    nameEl.textContent = cardName;
    card.append(emojiEl, nameEl);
    Sound.playMysteryReveal();

    // 카드 플립 후 효과 오버레이 표시
    setTimeout(() => showMysteryEffect(cardName, effectData, message), 500);
  }, 300);
}

// =============================================
// 미스터리 카드 효과 오버레이 (상황판)
// =============================================
export function showMysteryEffect(cardName, effectData, message) {
  // 오버레이 동적 생성 (중복 방지)
  let overlay = document.getElementById('board-mystery-effect');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'board-mystery-effect';
    overlay.style.cssText = `
      position:absolute; inset:0; z-index:50;
      background:rgba(0,0,0,.88);
      display:flex; align-items:center; justify-content:center;
      flex-direction:column; gap:16px;
      animation:fadeIn .4s;
    `;
    document.getElementById('view-board').appendChild(overlay);
  }
  overlay.innerHTML = '';
  overlay.style.display = 'flex';

  const info = MYSTERY_INFO[cardName] || { emoji: '❓' };

  // 카드 이름 타이틀
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-size:2.5rem;font-weight:900;color:#c084fc;';
  titleEl.textContent = `${info.emoji} ${cardName}`;
  overlay.appendChild(titleEl);

  // 카드별 애니메이션
  switch (cardName) {
    case '주사위 벼락':
      _buildDiceEffect(overlay, effectData);
      break;
    case '흡수':
      _buildAbsorptionEffect(overlay, effectData);
      break;
    case '패자의 역습':
      _buildRevengEffect(overlay, effectData);
      break;
    case '쉴드': {
      const el = document.createElement('div');
      el.style.cssText = 'font-size:5rem;animation:pulse 1s infinite;';
      el.textContent = '🛡️';
      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size:1.4rem;color:#f1f5f9;';
      descEl.textContent = message || '';
      overlay.append(el, descEl);
      break;
    }
    case '아이템 회복': {
      const el = document.createElement('div');
      el.style.cssText = 'font-size:4rem;animation:spin 1s linear infinite;';
      el.textContent = '🔄';
      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size:1.4rem;color:#f1f5f9;';
      descEl.textContent = message || '';
      overlay.append(el, descEl);
      break;
    }
    case '꽝': {
      const el = document.createElement('div');
      el.style.cssText = 'font-size:5rem;animation:pulse .5s 3;';
      el.textContent = '💨';
      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size:1.6rem;color:#94a3b8;';
      descEl.textContent = '아무 효과 없습니다';
      overlay.append(el, descEl);
      break;
    }
    default: {
      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size:1.4rem;color:#f1f5f9;text-align:center;padding:0 20px;';
      descEl.textContent = message || '';
      overlay.appendChild(descEl);
    }
  }

  // 닫기 버튼 (클릭 시 오버레이 숨김)
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ 닫기';
  closeBtn.style.cssText = `
    margin-top:24px; padding:12px 36px;
    background:#334155; color:#f1f5f9;
    border:2px solid #64748b; border-radius:12px;
    font-size:1.1rem; font-weight:700; cursor:pointer;
    transition:background .2s, border-color .2s;
  `;
  closeBtn.addEventListener('mouseover', () => {
    closeBtn.style.background = '#475569';
    closeBtn.style.borderColor = '#94a3b8';
  });
  closeBtn.addEventListener('mouseout', () => {
    closeBtn.style.background = '#334155';
    closeBtn.style.borderColor = '#64748b';
  });
  closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
  overlay.appendChild(closeBtn);
}

// 주사위 벼락 애니메이션
function _buildDiceEffect(container, effectData) {
  const diceEl = document.createElement('div');
  diceEl.style.cssText = 'font-size:6rem;animation:diceRoll .4s linear infinite;';
  diceEl.textContent = '🎲';
  container.appendChild(diceEl);

  // 2초 후 결과 표시
  setTimeout(() => {
    diceEl.style.animation = 'none';
    const resultEl = document.createElement('div');
    resultEl.style.cssText = 'font-size:2rem;font-weight:900;color:#fbbf24;animation:fadeIn .5s;text-align:center;';
    if (effectData?.hit) {
      resultEl.innerHTML = `<span style="font-size:2.5rem">⚡</span><br>${effectData.targetTeam}모둠!<br>-${effectData.penalty}점 벼락!`;
    } else {
      resultEl.textContent = `${effectData?.roll}번 — 해당 없음 (무효)`;
    }
    container.appendChild(resultEl);
  }, 2000);
}

// 흡수 애니메이션
function _buildAbsorptionEffect(container, effectData) {
  if (!effectData) return;
  const listEl = document.createElement('div');
  listEl.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-items:center;';

  (effectData.thefts || []).forEach((theft, i) => {
    const row = document.createElement('div');
    row.style.cssText = `font-size:1.3rem;color:#ef4444;font-weight:700;
      animation:fadeIn .4s ${i * 0.2}s both;`;
    row.textContent = `${theft.from}모둠  -${theft.amount}점 ➜`;
    listEl.appendChild(row);
  });

  const totalEl = document.createElement('div');
  totalEl.style.cssText = `font-size:2rem;color:#22c55e;font-weight:900;margin-top:8px;
    animation:fadeIn .5s ${(effectData.thefts?.length || 0) * 0.2 + 0.2}s both;`;
  totalEl.textContent = `${effectData.to}모둠  +${effectData.total}점 획득!`;

  container.append(listEl, totalEl);
}

// 패자의 역습 애니메이션
function _buildRevengEffect(container, effectData) {
  if (!effectData) return;
  const listEl = document.createElement('div');
  listEl.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-items:center;';

  (effectData.gains || []).forEach((gain, i) => {
    const row = document.createElement('div');
    row.style.cssText = `font-size:1.4rem;color:#22c55e;font-weight:700;
      animation:fadeIn .4s ${i * 0.25}s both;`;
    row.textContent = `${gain.team}모둠  +${gain.amount}점 ⬆`;
    listEl.appendChild(row);
  });

  container.appendChild(listEl);
}

export function hideBoardMysteryArea() {
  const area = document.getElementById('board-mystery-area');
  if (area) area.classList.add('hidden');
}

// =============================================
// 이미지 전체화면 (클릭 시 확대)
// =============================================
function showFullscreenImage(url) {
  const overlay = document.getElementById('fullscreen-info');
  const body    = document.getElementById('fullscreen-body');
  body.innerHTML = '';
  const img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'max-width:95vw;max-height:90vh;border-radius:12px;';
  body.appendChild(img);
  overlay.classList.remove('hidden');
}

// =============================================
// 시상식 포디움 (게임 종료 시)
// rankOrder: [{ teamNum, score }] — 내림차순 (1등이 [0])
// =============================================
// 동점 처리: 같은 점수면 같은 등수, 이후 등수는 건너뜀
// 예: [15, 15, 10] → rank: [1, 1, 3]
function _assignRanks(arr) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i === 0 || arr[i].score !== arr[i - 1].score) {
      result.push({ ...arr[i], rank: i + 1 });
    } else {
      result.push({ ...arr[i], rank: result[i - 1].rank });
    }
  }
  return result;
}

export function startCeremony(rankOrder) {
  const overlay = document.getElementById('ceremony-overlay');
  const content = document.getElementById('ceremony-content');
  const nextBtn = document.getElementById('ceremony-next');

  overlay.classList.remove('hidden');
  nextBtn.classList.add('hidden');
  content.innerHTML = '';

  // 동점 처리된 순위 계산
  const ranked = _assignRanks(rankOrder);

  // 동점 인원 수 (공동 N위 표시에 사용)
  const rankCounts = {};
  for (const t of ranked) { rankCounts[t.rank] = (rankCounts[t.rank] || 0) + 1; }

  function getRankLabel(rank, isFirst = false) {
    const shared = (rankCounts[rank] || 1) > 1;
    const prefix = shared ? '공동 ' : '';
    if (rank === 1) return `${prefix}🏆 1위!`;
    const emojis = { 2: '🥈 ', 3: '🥉 ' };
    return `${prefix}${emojis[rank] || ''}${rank}위`;
  }

  // 포디움 (상위 3슬롯)
  const podium = document.createElement('div');
  podium.className = 'ceremony-podium';

  const top3 = ranked.slice(0, Math.min(3, ranked.length));

  const podiumLayout = [];
  if (top3.length >= 1) podiumLayout.push({ team: top3[0], cls: 'podium-first',  delay: 1.4 });
  if (top3.length >= 2) podiumLayout.push({ team: top3[1], cls: 'podium-second', delay: 0.8 });
  if (top3.length >= 3) podiumLayout.push({ team: top3[2], cls: 'podium-third',  delay: 0.3 });

  const domOrder = [...podiumLayout].sort((a, b) => {
    const pos = { 'podium-second': 0, 'podium-first': 1, 'podium-third': 2 };
    return pos[a.cls] - pos[b.cls];
  });

  domOrder.forEach(({ team, cls, delay }) => {
    const slot = document.createElement('div');
    slot.className = `podium-slot ${cls}`;
    slot.style.animationDelay = `${delay}s`;

    const emojiEl = document.createElement('div');
    emojiEl.className = 'podium-emoji';
    emojiEl.textContent = team.rank === 1 ? '🏆' : team.rank === 2 ? '🥈' : '🥉';

    const rankEl = document.createElement('div');
    rankEl.className = 'podium-rank-label';
    rankEl.textContent = getRankLabel(team.rank);

    const teamEl = document.createElement('div');
    teamEl.className = 'podium-team-name';
    teamEl.textContent = `${team.teamNum}모둠`;

    const scoreEl = document.createElement('div');
    scoreEl.className = 'podium-score';
    scoreEl.textContent = `${team.score}점`;

    const baseEl = document.createElement('div');
    baseEl.className = `podium-base podium-base-${cls.replace('podium-', '')}`;
    baseEl.textContent = team.rank;

    slot.append(emojiEl, rankEl, teamEl, scoreEl, baseEl);
    podium.appendChild(slot);
  });

  content.appendChild(podium);

  // 4위 이하 팀 표시 (동점 반영)
  if (ranked.length > 3) {
    const othersEl = document.createElement('div');
    othersEl.className = 'ceremony-others';
    ranked.slice(3).forEach(team => {
      const row = document.createElement('div');
      row.className = 'ceremony-other-row';
      const shared = (rankCounts[team.rank] || 1) > 1;
      row.textContent = `${shared ? '공동 ' : ''}${team.rank}위 — ${team.teamNum}모둠 (${team.score}점)`;
      othersEl.appendChild(row);
    });
    content.appendChild(othersEl);
  }

  setTimeout(() => { launchConfetti(); Sound.playFanfare(); }, 2100);
  setTimeout(() => {
    nextBtn.textContent = '완료 ✓';
    nextBtn.classList.remove('hidden');
    nextBtn.onclick = () => overlay.classList.add('hidden');
  }, 3500);
}


// 컨페티 애니메이션
function launchConfetti() {
  const div = document.createElement('div');
  div.className = 'ceremony-confetti';
  document.body.appendChild(div);

  const colors = ['#fbbf24', '#6366f1', '#22c55e', '#ef4444', '#c084fc', '#fb7185'];
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left        = Math.random() * 100 + 'vw';
    piece.style.background  = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    piece.style.animationDelay   = (Math.random() * 0.8) + 's';
    div.appendChild(piece);
  }

  setTimeout(() => div.remove(), 4000);
}

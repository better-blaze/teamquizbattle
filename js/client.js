// =============================================
// client.js — 클라이언트 뷰 (학생 기기)
// =============================================

import { ITEM_INFO, ITEM_TYPES, MYSTERY_INFO } from './config.js';
import { MatchingCanvas, calcScore, checkShortAnswer, checkMultipleChoice, checkMatching } from './quiz.js';
import { buildItemUpdate } from './items.js';
import { renderMatchupGrid, renderMemberButtons, countParticipation, wouldViolateRule, calcMaxAllowed } from './matchup.js';
import { buildInfoCards } from './data.js';
import * as Sound from './sound.js';

// 현재 활성 클라이언트 섹션 전환
export function showClientSection(id) {
  document.querySelectorAll('.client-section').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

// =============================================
// 1단계: 모둠 선택 UI
// =============================================
export function renderTeamSelect({ roomCode, teamCount, takenTeams, onSelect }) {
  document.getElementById('cs-room-code-label').textContent = `방 코드: ${roomCode}`;
  const wrap = document.getElementById('cs-team-buttons');
  wrap.innerHTML = '';

  for (let i = 1; i <= teamCount; i++) {
    const btn = document.createElement('button');
    btn.className = 'cs-team-btn' + (takenTeams.includes(i) ? ' taken' : '');
    btn.textContent = `${i}모둠`;
    btn.disabled = takenTeams.includes(i);
    btn.addEventListener('click', () => {
      if (!btn.disabled) onSelect(i);
    });
    wrap.appendChild(btn);
  }

  showClientSection('cs-team-select');
}

// =============================================
// 2단계: 대진표 작성 UI
// =============================================
export function renderMatchupPhase({
  teamNum, members, questions, matchup, onMatchupUpdate, onSubmit
}) {
  document.getElementById('cs-team-badge').textContent = `${teamNum}모둠`;

  let selectedQIdx = null;
  let currentMatchup = { ...matchup };
  let submitted = false;

  // 그리드 렌더링 함수
  function refreshGrid() {
    renderMatchupGrid({
      container:   document.getElementById('cs-matchup-grid'),
      questions,
      matchup:     currentMatchup,
      selectedIdx: selectedQIdx,
      onSelect:    (i) => {
        if (submitted) return;
        selectedQIdx = i;
        refreshGrid();
        refreshMemberBtns();
      }
    });
  }

  // 멤버 버튼 렌더링
  function refreshMemberBtns() {
    const counts     = countParticipation(currentMatchup, members);
    const maxAllowed = calcMaxAllowed(questions.length, members.length);
    renderMemberButtons({
      container:      document.getElementById('cs-member-buttons'),
      members,
      counts,
      totalQuestions: questions.length,
      onAssign:  (name) => {
        if (submitted || selectedQIdx === null) return;
        const latestCounts = countParticipation(currentMatchup, members);
        if (wouldViolateRule(latestCounts, name, maxAllowed)) return;

        currentMatchup[String(selectedQIdx)] = name;
        selectedQIdx = null;
        refreshGrid();
        refreshMemberBtns();
        onMatchupUpdate(currentMatchup);
      }
    });
  }

  refreshGrid();
  refreshMemberBtns();

  // 정보 카드
  const infoCards = buildInfoCards(questions);
  renderInfoCards(infoCards);

  // 대진표 제출 버튼 등록
  const submitBtn = document.getElementById('btn-submit-matchup');
  if (submitBtn) {
    submitBtn.disabled  = false;
    submitBtn.className = 'btn btn-green btn-large';
    submitBtn.textContent = '대진표 제출 ✓';
    submitBtn.onclick = () => {
      if (submitted) return;
      if (!confirm('대진표를 제출하시겠습니까?\n제출 후에는 수정할 수 없습니다.')) return;
      submitted = true;
      submitBtn.disabled  = true;
      submitBtn.textContent = '✓ 제출 완료';
      // 편집 잠금
      document.querySelectorAll('.matchup-row').forEach(r => { r.style.pointerEvents = 'none'; r.style.opacity = '.7'; });
      document.querySelectorAll('.member-btn').forEach(b => b.disabled = true);
      onSubmit && onSubmit(currentMatchup);
    };
  }

  showClientSection('cs-matchup');
}

// =============================================
// 대진표 마감 화면
// =============================================
export function showMatchupClosed() {
  document.getElementById('cs-wait-msg').textContent = '대진표 작성이 마감되었습니다~';
  showClientSection('cs-waiting');
}

// 정보 카드 렌더링
function renderInfoCards(cards) {
  const wrap = document.getElementById('cs-info-cards');
  wrap.innerHTML = '';

  cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'info-card';

    const iconEl  = document.createElement('div');
    iconEl.className = 'info-card-icon';
    iconEl.textContent = card.icon;

    const labelEl = document.createElement('div');
    labelEl.className = 'info-card-label';
    labelEl.textContent = card.label;

    el.append(iconEl, labelEl);
    el.addEventListener('click', () => showInfoCardFullscreen(card));
    wrap.appendChild(el);
  });
}

// 정보 카드 전체화면 표시
function showInfoCardFullscreen(card) {
  const overlay = document.getElementById('fullscreen-info');
  const body    = document.getElementById('fullscreen-body');
  body.innerHTML = '';

  const titleEl = document.createElement('div');
  titleEl.className = 'fs-card-title';
  titleEl.textContent = `${card.icon} ${card.label}`;

  body.appendChild(titleEl);

  if (card.data.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.style.color = 'var(--c-sub)';
    emptyEl.textContent = '해당 문제 없음';
    body.appendChild(emptyEl);
  } else {
    const listEl = document.createElement('div');
    listEl.className = 'fs-question-list';
    card.data.forEach(q => {
      const row = document.createElement('div');
      row.className = 'fs-question-row';
      const numEl  = document.createElement('span');
      numEl.className = 'fs-q-num';
      numEl.textContent = `Q${q.num}`;
      const typeEl = document.createElement('span');
      typeEl.className = 'fs-q-type';
      typeEl.textContent = `${q.type} / ${q.difficulty}`;
      row.append(numEl, typeEl);
      listEl.appendChild(row);
    });
    body.appendChild(listEl);
  }

  overlay.classList.remove('hidden');
  document.getElementById('fullscreen-close').onclick = () => overlay.classList.add('hidden');
}

// =============================================
// 3단계: 대기 화면
// =============================================
export function showWaiting(msg = '게임 시작 대기 중...') {
  document.getElementById('cs-wait-msg').textContent = msg;
  showClientSection('cs-waiting');
}

// =============================================
// 4단계: 퀴즈 진행
// =============================================

let _matchingCanvas  = null;  // 선 잇기 캔버스 인스턴스
let _itemErasedTime  = 0;     // 지우개 사용으로 얻은 보너스 시간(초)
let _boostActive     = false; // 1.5배 아이템 활성 여부
let _eraserPending   = false; // 지우개 카운트다운 중 사전 활성화 여부
let _questionStartMs = 0;     // 문제 시작 타임스탬프

export function showQuizPhase({
  teamNum, fighterName, score, question,
  curseInfo, // { active, delayMs } 또는 null
  onSubmit,  // (answerValue, elapsedSec) => {}
  onUseItem  // 문제 출제 후에는 사용 불가 (빈 함수 전달)
}) {
  // 헤더 업데이트
  document.getElementById('cq-team-badge').textContent    = `${teamNum}모둠`;
  document.getElementById('cq-fighter-name').textContent  = fighterName;
  document.getElementById('cq-score').textContent         = `${score}점`;

  // 이전 캔버스 정리
  if (_matchingCanvas) { _matchingCanvas.destroy(); _matchingCanvas = null; }
  _itemErasedTime = 0;
  // _boostActive / _eraserPending은 카운트다운 시작(showCountdownWithItems)에서만 초기화
  // 여기서 초기화하면 카운트다운 중 사용한 아이템이 문제 시작 직후 무효화됨

  // 결과 영역 초기화
  const resultEl = document.getElementById('cq-result');
  resultEl.className = 'cq-result hidden';
  resultEl.innerHTML = '';

  // 문제 정보 표시
  document.getElementById('cq-q-type-badge').textContent = question.type;
  document.getElementById('cq-q-text').textContent       = question.content;

  const imgEl = document.getElementById('cq-q-img');
  if (question.imageUrl) {
    imgEl.src = question.imageUrl;
    imgEl.classList.remove('hidden');
    imgEl.onclick = () => {
      const overlay = document.getElementById('fullscreen-info');
      const body    = document.getElementById('fullscreen-body');
      body.innerHTML = `<img src="${question.imageUrl}" style="max-width:95vw;max-height:90vh;border-radius:12px;">`;
      overlay.classList.remove('hidden');
      document.getElementById('fullscreen-close').onclick = () => overlay.classList.add('hidden');
    };
  } else {
    imgEl.classList.add('hidden');
  }
  document.getElementById('cq-question-info').classList.remove('hidden');

  // 문제 출제 후에는 아이템 버튼 숨김 (카운트다운에서만 사용 가능)
  document.getElementById('cq-item-bar').classList.add('hidden');

  showClientSection('cs-quiz');

  // 저주 처리: 지연 후 입력 영역 표시
  const delayMs = (curseInfo?.active && curseInfo.delayMs) ? curseInfo.delayMs : 0;
  if (delayMs > 0) {
    showCurseOverlay(delayMs, () => showAnswerArea(question, onSubmit));
    Sound.playCurse();
  } else {
    showAnswerArea(question, onSubmit);
  }
}

// 저주 오버레이 표시
function showCurseOverlay(delayMs, onEnd) {
  const overlay = document.getElementById('curse-overlay');
  const numEl   = document.getElementById('curse-delay-num');
  overlay.classList.remove('hidden');

  let remaining = delayMs / 1000;
  numEl.textContent = remaining.toFixed(1);

  const interval = setInterval(() => {
    remaining -= 0.1;
    if (remaining <= 0) {
      clearInterval(interval);
      overlay.classList.add('hidden');
      onEnd();
    } else {
      numEl.textContent = remaining.toFixed(1);
    }
  }, 100);
}

// 정답 입력 영역 표시 (저주 지연 후, 즉시, 또는 지우개 재시도 시)
function showAnswerArea(question, onSubmit) {
  // 이전 캔버스 정리 (지우개 재시도로 재호출될 때 필요)
  if (_matchingCanvas) { _matchingCanvas.destroy(); _matchingCanvas = null; }
  _questionStartMs = Date.now();
  const answerArea = document.getElementById('cq-answer-area');
  answerArea.classList.remove('hidden');

  // 모든 하위 영역 숨기기
  document.getElementById('cq-mc-options').classList.add('hidden');
  document.getElementById('cq-sa-area').classList.add('hidden');
  document.getElementById('cq-match-area').classList.add('hidden');

  // 유형명 공백 제거 후 비교 (스프레드시트 오입력 대응: "선 잇기" → "선잇기")
  const qType = (question.type || '').replace(/\s+/g, '');
  switch (qType) {
    case '객관식': showMCOptions(question, onSubmit);    break;
    case '단답형': showShortAnswer(question, onSubmit);  break;
    case '선잇기': showMatching(question, onSubmit);     break;
    default:
      console.error('[showAnswerArea] 알 수 없는 유형:', JSON.stringify(question.type));
  }

}

// 객관식 보기
function showMCOptions(question, onSubmit) {
  const wrap = document.getElementById('cq-mc-options');
  wrap.innerHTML = '';
  wrap.classList.remove('hidden');

  question.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className  = 'mc-option-btn';
    btn.textContent = `${i + 1}. ${opt}`;
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.mc-option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const elapsed = (Date.now() - _questionStartMs) / 1000 + _itemErasedTime;
      submitAnswer(String(i + 1), elapsed, question, onSubmit);
    });
    wrap.appendChild(btn);
  });
}

// 단답형 입력
function showShortAnswer(question, onSubmit) {
  const area  = document.getElementById('cq-sa-area');
  const input = document.getElementById('cq-sa-input');
  const btn   = document.getElementById('btn-sa-submit');
  area.classList.remove('hidden');
  input.value = '';
  input.focus();

  const doSubmit = () => {
    const val = input.value.trim();
    if (!val) return;
    const elapsed = (Date.now() - _questionStartMs) / 1000 + _itemErasedTime;
    submitAnswer(val, elapsed, question, onSubmit);
  };

  btn.onclick = doSubmit;
  input.onkeydown = e => { if (e.key === 'Enter') doSubmit(); };
}

// 선 잇기
function showMatching(question, onSubmit) {
  const area = document.getElementById('cq-match-area');
  const btn  = document.getElementById('btn-match-submit');
  area.classList.remove('hidden');
  btn.disabled = true;

  // matchPairs가 비어 있으면 파싱 실패 안내 표시
  if (!question.matchPairs || question.matchPairs.length === 0) {
    const leftCol = document.getElementById('cq-left-col');
    if (leftCol) {
      leftCol.innerHTML = '<div style="color:var(--c-red);padding:12px;font-size:.9rem;">⚠️ 선잇기 데이터 오류<br>스프레드시트 정답 형식을 확인하세요<br>(예: 사자:맹수 | 고양이:애완동물)</div>';
    }
    console.error('[선잇기] question.matchPairs 비어 있음 — type:', JSON.stringify(question.type), 'rawAnswer:', question.rawAnswer);
    return;
  }

  _matchingCanvas = new MatchingCanvas({
    canvasEl:   document.getElementById('cq-match-canvas'),
    leftColEl:  document.getElementById('cq-left-col'),
    rightColEl: document.getElementById('cq-right-col'),
    pairs:      question.matchPairs
  });

  _matchingCanvas.onAllConnected = () => { btn.disabled = false; };

  btn.onclick = () => {
    // 클릭 시점의 캔버스 인스턴스를 캡처
    // 지우개 재시도 시 submitAnswer 내부에서 _matchingCanvas가 새 인스턴스로 교체되므로
    // 교체 후에는 submit()을 호출하지 않도록 동일 인스턴스인지 확인
    const canvas    = _matchingCanvas;
    const userPairs = canvas.getUserPairs();
    const elapsed   = (Date.now() - _questionStartMs) / 1000 + _itemErasedTime;
    submitAnswer(userPairs, elapsed, question, onSubmit);
    if (_matchingCanvas === canvas) canvas.submit();
  };
}

// 정답 제출 처리
function submitAnswer(value, elapsedSec, question, onSubmit) {
  // 지우개 아이템: 오답 제출 시 타이머 초기화 후 재도전 기회 1회
  if (_eraserPending) {
    const correct = checkAnswerCorrect(question, value);
    if (!correct) {
      _eraserPending   = false;
      _questionStartMs = Date.now(); // 타이머 초기화
      _itemErasedTime  = 0;
      showItemEffect('🩹 지우개! 다시 도전하세요!');
      Sound.playItemUse();
      showAnswerArea(question, onSubmit); // 답입력 영역 재표시
      return;
    }
  }

  // 일반 제출
  document.getElementById('cq-answer-area').classList.add('hidden');
  document.getElementById('cq-item-bar').classList.add('hidden');
  onSubmit(value, elapsedSec);
}

// 정답 여부 판정 — submitAnswer 내 지우개 처리용
function checkAnswerCorrect(question, value) {
  const qType = (question.type || '').replace(/\s+/g, '');
  if (qType === '객관식') return checkMultipleChoice(value, question.answers[0]);
  if (qType === '단답형') return checkShortAnswer(value, question.answers);
  if (qType === '선잇기') return checkMatching(value, question.matchPairs);
  return false;
}

// =============================================
// 결과 표시 (정답/오답)
// =============================================
export function showQuizResult({ correct, score, correctAnswer, boostApplied, baseScore }) {
  const el = document.getElementById('cq-result');
  el.className = 'cq-result ' + (correct ? 'correct' : 'wrong');
  el.innerHTML = '';

  const iconEl  = document.createElement('div');
  iconEl.className = 'cq-result-icon';
  iconEl.textContent = correct ? '✅' : '❌';

  const msgEl   = document.createElement('div');
  msgEl.className = 'cq-result-msg';
  msgEl.textContent = correct ? '정답!' : '오답!';

  const scoreEl = document.createElement('div');
  scoreEl.className = 'cq-result-score';
  if (correct && boostApplied) {
    // "10점×1.5배=15점" 형식으로 표시
    scoreEl.textContent = `${baseScore}점×1.5배=${score}점`;
  } else {
    scoreEl.textContent = correct ? `+${score}점` : '0점';
  }

  el.append(iconEl, msgEl, scoreEl);
  el.classList.remove('hidden');

  if (correct) Sound.playCorrect();
  else         Sound.playWrong();
}

// =============================================
// 아이템 사용 처리
// =============================================
function handleItemUse(itemType, myTeam, onUseItem) {
  switch (itemType) {
    case ITEM_TYPES.BOOST:
      _boostActive = true;
      showItemEffect('⚡ 점수 1.5배 활성화! 문제 시작 후 빨리 맞히세요!');
      Sound.playItemUse();
      onUseItem(itemType);
      break;

    case ITEM_TYPES.CURSE:
      // 대상 선택 팝업 표시
      onUseItem(itemType); // app.js에서 팀 목록 전달 후 처리
      break;

    case ITEM_TYPES.ERASER:
      _eraserPending = true; // 틀리면 재도전 기회 부여
      showItemEffect('🩹 지우개 준비! 틀리면 한 번 더 도전할 수 있습니다.');
      Sound.playItemUse();
      onUseItem(itemType);
      break;
  }
}


function showItemEffect(msg) {
  const el = document.getElementById('cq-item-effect');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// =============================================
// 5단계: 미스터리 카드 선택 (내 팀이 선택권)
// =============================================
export function showMysteryCardPicker({ deck, onPick }) {
  const wrap = document.getElementById('cs-mystery-cards');
  wrap.innerHTML = '';

  deck.forEach((cardName, i) => {
    const card = document.createElement('div');
    card.className = 'c-mystery-card';
    card.textContent = '🃏';

    card.addEventListener('click', () => {
      if (card.classList.contains('chosen')) return;
      // 모든 카드 선택 비활성화
      wrap.querySelectorAll('.c-mystery-card').forEach(c => c.style.pointerEvents = 'none');
      card.classList.add('chosen');

      const info = MYSTERY_INFO[cardName] || { emoji: '❓' };
      setTimeout(() => {
        card.classList.add('revealed');
        card.innerHTML = `<div style="font-size:1.8rem">${info.emoji}</div><div style="font-size:.7rem;margin-top:4px">${cardName}</div>`;
        Sound.playMysteryReveal();
        onPick(i, cardName);
      }, 300);
    });

    wrap.appendChild(card);
  });

  showClientSection('cs-mystery');
}

// =============================================
// 6단계: 시상식 (클라이언트 화면)
// =============================================
export function showClientCeremony(myTeamRank, myScore, isShared = false) {
  const prefix = isShared ? '공동 ' : '';
  const baseMsg = [
    `🏆 ${prefix}1등! 최고의 모둠!`,
    `🥈 ${prefix}2등! 훌륭해요!`,
    `🥉 ${prefix}3등! 잘했어요!`
  ];
  const msg = baseMsg[myTeamRank - 1] || `${prefix}${myTeamRank}등! 수고했어요!`;
  document.getElementById('cs-ceremony-msg').textContent = msg + `\n${myScore}점`;
  showClientSection('cs-ceremony');
}

// boostActive 상태 반환 (app.js에서 접근)
export function isBoostActive()  { return _boostActive; }
export function clearBoost()     { _boostActive = false; }
export function _activateBoost() { _boostActive = true; }

// =============================================
// 쉴드가 저주를 막았을 때 클라이언트 화면에 초록 빛 효과 2초 표시
// =============================================
export function showShieldBlockEffect() {
  const existing = document.getElementById('shield-block-effect');
  if (existing) return; // 중복 방지

  const el = document.createElement('div');
  el.id = 'shield-block-effect';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// =============================================
// 카운트다운 단계: 아이템 버튼 표시
// items: { boost: true, curse: true, eraser: true } — true = 사용 가능
// =============================================
export function showCountdownWithItems({ teamNum, score, items, onUseItem }) {
  document.getElementById('cq-team-badge').textContent   = `${teamNum}모둠`;
  document.getElementById('cq-fighter-name').textContent = '⏳ 카운트다운';
  document.getElementById('cq-score').textContent        = `${score}점`;

  // 문제 정보 및 정답 영역 숨기기
  document.getElementById('cq-question-info').classList.add('hidden');
  document.getElementById('cq-answer-area').classList.add('hidden');
  document.getElementById('cq-result').className = 'cq-result hidden';
  document.getElementById('cq-result').innerHTML = '';
  document.getElementById('curse-overlay').classList.add('hidden');

  // 이전 캔버스 정리 및 상태 초기화
  if (_matchingCanvas) { _matchingCanvas.destroy(); _matchingCanvas = null; }
  _itemErasedTime = 0;
  _boostActive    = false;  // 새 라운드 시작 시 아이템 상태 초기화
  _eraserPending  = false;

  // 아이템 버튼 영역 구성
  const itemBar = document.getElementById('cq-item-bar');
  itemBar.innerHTML = '';

  const availableItems = Object.entries(items || {}).filter(([, avail]) => avail);
  if (availableItems.length > 0) {
    itemBar.classList.remove('hidden');
    availableItems.forEach(([type]) => {
      const info = ITEM_INFO[type] || { name: type };
      const btn = document.createElement('button');
      btn.className = 'btn btn-item';
      btn.textContent = info.name;
      btn.style.margin = '4px';
      btn.addEventListener('click', () => {
        // 아이템 1개 사용 시 나머지 아이템도 모두 비활성화 (중복 사용 방지)
        itemBar.querySelectorAll('.btn-item').forEach(b => b.disabled = true);
        handleItemUse(type, teamNum, onUseItem);
      });
      itemBar.appendChild(btn);
    });
  } else {
    itemBar.classList.add('hidden');
  }

  showClientSection('cs-quiz');
}

// =============================================
// =============================================
// 튜토리얼 슬라이드 데이터
// =============================================
const TUTORIAL_SLIDES = [
  {
    emoji: '🏆',
    title: '팀전 퀴즈배틀이란?',
    color: '#f59e0b',
    lines: [
      '모둠이 함께 퀴즈를 풀어서',
      '점수를 많이 쌓는 팀이 이기는 게임이에요!',
      '빨리 맞힐수록 점수가 높아집니다.'
    ]
  },
  {
    emoji: '📋',
    title: '① 대진표 작성',
    color: '#3b82f6',
    lines: [
      '게임을 시작하기 전, 각 문제마다',
      '우리 모둠에서 누가 풀지 정해요.',
      '100초 안에 모두 배정하고 제출하세요!'
    ]
  },
  {
    emoji: '❓',
    title: '② 문제 풀기 & 점수',
    color: '#8b5cf6',
    lines: [
      '선생님이 카운트다운을 시작하면 문제가 시작돼요.',
      '빨리 맞힐수록 점수가 높아요! (최대 10점)',
      '늦게 맞혀도 최소 3점은 받을 수 있어요.'
    ]
  },
  {
    emoji: '⚡',
    title: '③ 아이템 — 1.5배',
    color: '#f59e0b',
    lines: [
      '카운트다운 5초 동안 사용할 수 있어요.',
      '이번 문제 점수가 1.5배로 올라가요!',
      '예) 10점 → 15점, 8점 → 12점'
    ]
  },
  {
    emoji: '💀',
    title: '③ 아이템 — 저주',
    color: '#ef4444',
    lines: [
      '다른 모둠에게 사용하는 공격 아이템이에요.',
      '저주를 받은 모둠은 문제 시작이 잠깐 늦어져요.',
      '그 시간도 점수 계산에 포함되니까 불리해요!'
    ]
  },
  {
    emoji: '🩹',
    title: '③ 아이템 — 지우개',
    color: '#06b6d4',
    lines: [
      '카운트다운 중에 사용하는 아이템이에요.',
      '틀렸을 때 한 번 더 도전할 수 있어요!',
      '단, 다시 도전할 때 타이머는 처음부터 시작해요.'
    ]
  },
  {
    emoji: '🛡️',
    title: '③ 아이템 — 쉴드',
    color: '#22c55e',
    lines: [
      '저주로부터 우리 모둠을 지켜주는 아이템이에요.',
      '쉴드가 있으면 저주를 한 번 막을 수 있어요!',
      '막은 뒤에는 쉴드가 사라지니 조심하세요.'
    ]
  },
  {
    emoji: '🎴',
    title: '④ 미스터리 문제 (★)',
    color: '#a855f7',
    lines: [
      '문제 목록에 ★ 표시가 있는 문제는 특별해요!',
      '가장 먼저 맞힌 모둠이 미스터리 카드를 뽑아요.',
      '카드를 뒤집어 어떤 효과가 나올지 확인하세요!'
    ]
  },
  {
    emoji: '🃏',
    title: '④ 미스터리 카드 종류',
    color: '#ec4899',
    cards: [
      { icon: '⚔️', name: '패자의 역습', desc: '꼴찌 모둠이 점수 보너스!' },
      { icon: '🎲', name: '주사위 벼락', desc: '선택한 모둠 점수 감점!' },
      { icon: '🎁', name: '아이템 회복', desc: '사용한 아이템을 다시 충전!' },
      { icon: '🌀', name: '흡수', desc: '다른 모둠 점수를 빼앗아와요!' },
      { icon: '🛡️', name: '쉴드', desc: '저주를 한 번 막아주는 보호막!' },
      { icon: '💨', name: '꽝', desc: '아무 일도 일어나지 않아요.' }
    ]
  },
  {
    emoji: '🎉',
    title: '이제 시작해봐요!',
    color: '#22c55e',
    lines: [
      '규칙을 잘 기억했나요?',
      '모둠원과 힘을 합쳐 1등을 노려보세요!',
      '궁금한 점은 선생님께 질문하세요! 😊'
    ]
  }
];

// =============================================
// 튜토리얼 오버레이 표시
// =============================================
export function showTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  let current = 0;

  function renderSlide(idx) {
    const slide = TUTORIAL_SLIDES[idx];
    const slideEl = document.getElementById('tutorial-slide');

    // 슬라이드 내용 생성
    let html = `
      <div class="ts-emoji" style="color:${slide.color}">${slide.emoji}</div>
      <div class="ts-title" style="color:${slide.color}">${slide.title}</div>
    `;

    if (slide.cards) {
      // 미스터리 카드 목록 슬라이드
      html += '<div class="ts-card-list">';
      slide.cards.forEach(c => {
        html += `<div class="ts-card-item"><span class="ts-card-icon">${c.icon}</span><span class="ts-card-name">${c.name}</span><span class="ts-card-desc">${c.desc}</span></div>`;
      });
      html += '</div>';
    } else {
      // 일반 텍스트 슬라이드
      html += '<div class="ts-lines">';
      slide.lines.forEach(line => {
        html += `<p class="ts-line">${line}</p>`;
      });
      html += '</div>';
    }

    slideEl.innerHTML = html;

    // 진행 도트 업데이트
    const dotsEl = document.getElementById('tutorial-dots');
    dotsEl.innerHTML = '';
    TUTORIAL_SLIDES.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'tutorial-dot' + (i === idx ? ' active' : '');
      dot.addEventListener('click', () => { current = i; renderSlide(i); });
      dotsEl.appendChild(dot);
    });

    // 버튼 상태
    document.getElementById('tutorial-prev').disabled = idx === 0;
    const nextBtn = document.getElementById('tutorial-next');
    if (idx === TUTORIAL_SLIDES.length - 1) {
      nextBtn.textContent = '✓ 닫기';
      nextBtn.classList.add('finish');
    } else {
      nextBtn.textContent = '다음 ▶';
      nextBtn.classList.remove('finish');
    }
  }

  // 이벤트 (매번 새로 등록하지 않기 위해 클론으로 교체)
  const prevBtn = document.getElementById('tutorial-prev');
  const nextBtn = document.getElementById('tutorial-next');
  const closeBtn = document.getElementById('tutorial-close');

  const newPrev  = prevBtn.cloneNode(true);
  const newNext  = nextBtn.cloneNode(true);
  const newClose = closeBtn.cloneNode(true);
  prevBtn.parentNode.replaceChild(newPrev, prevBtn);
  nextBtn.parentNode.replaceChild(newNext, nextBtn);
  closeBtn.parentNode.replaceChild(newClose, closeBtn);

  document.getElementById('tutorial-prev').addEventListener('click', () => {
    if (current > 0) { current--; renderSlide(current); }
  });
  document.getElementById('tutorial-next').addEventListener('click', () => {
    if (current < TUTORIAL_SLIDES.length - 1) {
      current++;
      renderSlide(current);
    } else {
      overlay.classList.add('hidden');
    }
  });
  document.getElementById('tutorial-close').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
  // 배경 클릭으로 닫기
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  current = 0;
  renderSlide(0);
  overlay.classList.remove('hidden');
}

// 저주 당함 즉시 알림 토스트 (카운트다운 중 표시)
// =============================================
export function showCurseWarning() {
  // 기존 토스트가 있으면 제거
  const existing = document.getElementById('curse-warning-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'curse-warning-toast';
  toast.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 600; background: rgba(0,0,0,.92);
    border: 3px solid #ef4444; border-radius: 20px;
    padding: 32px 48px; text-align: center;
    animation: fadeIn .3s;
  `;
  toast.innerHTML = `
    <div style="font-size:4rem">💀</div>
    <div style="font-size:1.8rem;font-weight:900;color:#ef4444;margin-top:8px;">저주 당함!</div>
    <div style="font-size:1rem;color:#94a3b8;margin-top:6px;">문제 시작이 지연됩니다</div>
  `;
  document.body.appendChild(toast);

  Sound.playCurse();
  setTimeout(() => toast.remove(), 3000);
}

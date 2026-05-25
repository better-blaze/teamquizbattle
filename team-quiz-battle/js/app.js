// =============================================
// app.js — 메인 앱 (Firebase, 라우팅, 게임 오케스트레이션)
// =============================================

import { initializeApp }                         from 'firebase/app';
import { getDatabase, ref, set, get, update,
         onValue, serverTimestamp, remove }       from 'firebase/database';

import { firebaseConfig, LS, GAME, ITEM_TYPES,
         ITEM_INFO, MYSTERY_INFO,
         DEFAULT_MYSTERY_SETTINGS }              from './config.js';
import { loadQuestions, loadStudents }            from './data.js';
import { autoFillMatchup, countParticipation }   from './matchup.js';
import { calcScore, checkShortAnswer,
         checkMultipleChoice, checkMatching }     from './quiz.js';
import { applyMysteryCard, buildItemUpdate,
         createMysteryDeck } from './items.js';
import * as Sound                                 from './sound.js';

import { initSettingView }                        from './setting.js';
import * as Board                                 from './board.js';
import * as Client                                from './client.js';
import * as Admin                                 from './admin.js';

// 동점 처리 등수 계산 (app.js 내 공용)
function assignRanks(arr) {
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

// =============================================
// Firebase 초기화
// =============================================
const fbApp = initializeApp(firebaseConfig);
const db    = getDatabase(fbApp);

// =============================================
// 전역 상태
// =============================================
let state = {
  roomCode:   null,
  role:       null,   // 'student' | 'admin' | 'board'
  myTeam:     null,   // 숫자 (학생용)
  questions:  [],
  students:   {},     // { 1: ['김민준', ...], ... }
  teamCount:  4,
  // Firebase 리스너 해제 함수 목록
  unsubscribers: []
};

// 현재 표시 중인 문제 인덱스 (중복 렌더링 방지)
let _currentQIndex = -1;

// Firebase 경로 헬퍼
const R = {
  room:       (code)        => ref(db, `rooms/${code}`),
  meta:       (code)        => ref(db, `rooms/${code}/meta`),
  teams:      (code)        => ref(db, `rooms/${code}/teams`),
  team:       (code, t)     => ref(db, `rooms/${code}/teams/${t}`),
  matchup:    (code, t)     => ref(db, `rooms/${code}/matchup/${t}`),
  allMatchup: (code)        => ref(db, `rooms/${code}/matchup`),
  game:       (code)        => ref(db, `rooms/${code}/game`),
  answers:    (code, q)     => ref(db, `rooms/${code}/answers/${q}`),
  answer:     (code, q, t)  => ref(db, `rooms/${code}/answers/${q}/${t}`),
  curse:      (code, t)     => ref(db, `rooms/${code}/curse/${t}`),
  mystery:         (code, q) => ref(db, `rooms/${code}/mystery/${q}`),
  mysterySettings: (code)    => ref(db, `rooms/${code}/mysterySettings`),
};

// 미스터리 설정을 Firebase에서 읽어옴 (없으면 기본값 반환)
async function getMysterySettings(code) {
  const snap = await get(R.mysterySettings(code));
  return snap.exists() ? { ...DEFAULT_MYSTERY_SETTINGS, ...snap.val() } : { ...DEFAULT_MYSTERY_SETTINGS };
}

// =============================================
// 뷰 전환
// =============================================
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const v = document.getElementById(id);
  if (v) v.classList.add('active');
}

// =============================================
// 음소거 초기화
// =============================================
function initMuteButtons() {
  const muted = localStorage.getItem(LS.MUTED) === '1';
  Sound.setMuted(muted);

  document.querySelectorAll('.mute-btn').forEach(btn => {
    btn.textContent = muted ? '🔇' : '🔊';
    btn.addEventListener('click', () => {
      const nowMuted = !Sound.isMuted();
      Sound.setMuted(nowMuted);
      localStorage.setItem(LS.MUTED, nowMuted ? '1' : '0');
      document.querySelectorAll('.mute-btn').forEach(b => {
        b.textContent = nowMuted ? '🔇' : '🔊';
      });
    });
  });
}

// =============================================
// URL 파라미터 파싱
// 예: ?role=board&room=ABC123&team=2
// URL 파라미터가 있으면 localStorage보다 우선 적용
// =============================================
function parseURLParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    role: p.get('role'),   // admin | board | student
    room: p.get('room'),
    team: p.get('team') ? parseInt(p.get('team')) : null
  };
}

// =============================================
// 앱 시작점
// =============================================
async function main() {
  initMuteButtons();

  // fullscreen-close 버튼 연결
  document.getElementById('fullscreen-close')?.addEventListener('click', () => {
    document.getElementById('fullscreen-info').classList.add('hidden');
  });

  // ★ 긴급 탈출: ?reset 파라미터로 강제 초기화
  //   주소창에 ?reset 을 붙이면 localStorage를 지우고 세팅 화면으로 이동
  if (new URLSearchParams(window.location.search).has('reset')) {
    clearLocalSession();
    window.history.replaceState({}, '', window.location.pathname);
    showView('view-setting');
    initSettingView({
      onCreateRoom:        handleCreateRoom,
      onJoinStudent:       (code) => handleJoin(code, 'student'),
      onJoinBoard:         (code) => handleJoin(code, 'board'),
      onJoinAdmin:         (code) => handleJoin(code, 'admin'),
      onClearSession:      clearLocalSession,
      onResetAllSessions:  resetAllSessions
    });
    showResetSuccessMsg();
    return;
  }

  // ① URL 파라미터 우선 처리 (멀티탭 테스트용)
  //    ?role=board&room=ABC123 처럼 직접 역할을 지정하면
  //    localStorage와 무관하게 해당 역할로 바로 진입
  const urlParams = parseURLParams();
  if (urlParams.role && urlParams.room) {
    const snap = await get(R.meta(urlParams.room));
    if (snap.exists()) {
      state.roomCode  = urlParams.room;
      state.role      = urlParams.role;
      state.myTeam    = urlParams.team;
      state.teamCount = snap.val().teamCount;
      await loadGameData(urlParams.room);
      enterRole(urlParams.role, urlParams.room, urlParams.team);
      return;
    }
  }

  // ② localStorage 자동 재접속 (새로고침/튕김 복구)
  const savedRoom = localStorage.getItem(LS.ROOM);
  const savedRole = localStorage.getItem(LS.ROLE);
  const savedTeam = localStorage.getItem(LS.TEAM);

  if (savedRoom && savedRole) {
    const snap = await get(R.meta(savedRoom));
    if (snap.exists()) {
      state.roomCode  = savedRoom;
      state.role      = savedRole;
      state.myTeam    = savedTeam ? parseInt(savedTeam) : null;
      state.teamCount = snap.val().teamCount;
      await loadGameData(savedRoom);
      enterRole(savedRole, savedRoom, state.myTeam);
      return;
    }
    // 방이 없으면 localStorage 초기화
    clearLocalSession();
  }

  // ③ 세팅 뷰 진입
  showView('view-setting');
  initSettingView({
    onCreateRoom:       handleCreateRoom,
    onJoinStudent:      (code) => handleJoin(code, 'student'),
    onJoinBoard:        (code) => handleJoin(code, 'board'),
    onJoinAdmin:        (code) => handleJoin(code, 'admin'),
    onClearSession:     clearLocalSession,
    onResetAllSessions: resetAllSessions
  });
}

// localStorage 세션 초기화
function clearLocalSession() {
  localStorage.removeItem(LS.ROOM);
  localStorage.removeItem(LS.ROLE);
  localStorage.removeItem(LS.TEAM);
  localStorage.removeItem(LS.RESET_COUNT);
}

// Firebase의 모든 방(rooms) 삭제 → 접속 중인 모든 클라이언트의 리스너가
// 방 삭제를 감지하고 자동으로 세팅 화면으로 복귀됨
// rooms/ 전체 삭제는 권한 거부될 수 있으므로 각 방을 개별 삭제
async function resetAllSessions() {
  try {
    const snap = await get(ref(db, 'rooms'));
    if (snap.exists()) {
      const deletions = Object.keys(snap.val()).map(code =>
        remove(ref(db, `rooms/${code}`))
      );
      await Promise.all(deletions);
    }
    clearLocalSession();
    showView('view-setting');
    const msg = document.getElementById('setting-message');
    if (msg) {
      msg.textContent = '✅ 모든 세션이 초기화됐습니다.';
      msg.style.borderColor = 'var(--c-green)';
      msg.style.color       = 'var(--c-text)';
      msg.classList.remove('hidden');
    }
  } catch (e) {
    alert('초기화 실패: ' + e.message);
  }
}

// 리스너 해제 + 세션 초기화 + 세팅 뷰로 복귀 (공통 헬퍼)
function navigateToSetting() {
  state.unsubscribers.forEach(fn => fn());
  state.unsubscribers = [];
  clearLocalSession();
  showView('view-setting');
  initSettingView({
    onCreateRoom:       handleCreateRoom,
    onJoinStudent:      (c) => handleJoin(c, 'student'),
    onJoinBoard:        (c) => handleJoin(c, 'board'),
    onJoinAdmin:        (c) => handleJoin(c, 'admin'),
    onClearSession:     clearLocalSession,
    onResetAllSessions: resetAllSessions
  });
}

// ?reset 성공 메시지 표시
function showResetSuccessMsg() {
  const msg = document.getElementById('setting-message');
  if (!msg) return;
  msg.textContent = '✅ 세션이 초기화됐습니다. 새로 방을 만들거나 참여하세요.';
  msg.style.borderColor = 'var(--c-green)';
  msg.style.color       = 'var(--c-text)';
  msg.classList.remove('hidden');
}

// =============================================
// 방 만들기 (교사)
// =============================================
async function handleCreateRoom(code, teamCount) {
  // 기본 팀 구조 생성 — 모든 모둠이 저주·1.5배·지우개 아이템 1개씩 보유
  const teams = {};
  for (let i = 1; i <= teamCount; i++) {
    teams[i] = {
      score:        0,
      items:        { boost: true, curse: true, eraser: true },
      shieldActive: false,
      connected:    false
    };
  }

  await set(R.room(code), {
    meta: {
      teamCount,
      status:           'matchup',
      createdAt:        Date.now(),
      matchupTimerStart: null,  // 관리자가 버튼 누를 때 설정
      matchupLocked:    false,
      resetCount:       0
    },
    teams,
    game: {
      qIndex:  0,
      phase:   'idle',
      countdownStart: null,
      questionStart:  null,
      fullDuration:   30,
      perfectTime:    5
    },
    mysterySettings: { ...DEFAULT_MYSTERY_SETTINGS }
  });

  state.roomCode  = code;
  state.role      = 'admin';
  state.teamCount = teamCount;
  localStorage.setItem(LS.ROOM, code);
  localStorage.setItem(LS.ROLE, 'admin');

  await loadGameData(code);
  enterRole('admin', code, null);

  // 관리자 진입 후 테스트용 링크 표시
  setTimeout(() => Admin.showTestLinks(code, teamCount), 500);
}

// =============================================
// 방 참여 (학생 / 상황판 / 관리자)
// =============================================
async function handleJoin(code, role) {
  const snap = await get(R.meta(code));
  if (!snap.exists()) {
    alert('방을 찾을 수 없습니다. 코드를 확인해주세요.');
    return;
  }

  state.roomCode  = code;
  state.role      = role;
  state.teamCount = snap.val().teamCount;
  localStorage.setItem(LS.ROOM, code);
  localStorage.setItem(LS.ROLE, role);

  await loadGameData(code);
  enterRole(role, code, null);
}

// =============================================
// 구글 시트 데이터 로드
// =============================================
async function loadGameData(code) {
  try {
    [state.questions, state.students] = await Promise.all([
      loadQuestions(),
      loadStudents()
    ]);
  } catch (e) {
    console.error('데이터 로드 오류:', e);
  }
}

// =============================================
// 역할별 진입
// =============================================
function enterRole(role, code, teamNum) {
  // 기존 리스너 해제
  state.unsubscribers.forEach(fn => fn());
  state.unsubscribers = [];

  switch (role) {
    case 'board':   enterBoardView(code);           break;
    case 'admin':   enterAdminView(code);           break;
    case 'student': enterClientView(code, teamNum); break;
  }
}

// =============================================
// 상황판 뷰 진입
// =============================================
function enterBoardView(code) {
  showView('view-board');
  document.getElementById('board-room-code').textContent = `방 코드: ${code}`;

  let boardAllMatchups = {}; // 대진표 캐시

  const unsubMeta = onValue(R.meta(code), snap => {
    if (!snap.exists()) { navigateToSetting(); }
  });

  const unsubTeams = onValue(R.teams(code), snap => {
    if (!snap.exists()) return;
    Board.renderBoardTeams(snap.val());
  });

  // 대진표 리스너 (fighters 표시용)
  const unsubMatchup = onValue(R.allMatchup(code), snap => {
    boardAllMatchups = snap.exists() ? snap.val() : {};
  });

  const unsubGame = onValue(R.game(code), async snap => {
    if (!snap.exists()) return;
    const game = snap.val();
    handleBoardGameUpdate(code, game, boardAllMatchups);
  });

  state.unsubscribers.push(unsubMeta, unsubTeams, unsubMatchup, unsubGame);
}

// 상황판: 게임 상태 변화 처리
let boardTimerInterval = null;
let _diceConfirmShown  = false; // 주사위 확인 오버레이 중복 방지

async function handleBoardGameUpdate(code, game, boardAllMatchups = {}) {
  Board.setBoardPhase(game.phase);

  // 미스터리가 아닌 단계에서는 미스터리 영역 숨김
  if (game.phase !== 'mystery') {
    Board.hideBoardMysteryArea();
  }

  if (game.phase === 'idle') {
    clearInterval(boardTimerInterval);
    Board.stopBoardCountdown();
    Board.hideBoardTimerBar();
    Board.clearBoardQuestion();
    Board.clearBoardResults();
    // 다음 문제 참전자 표시
    Board.showNextFighters(game.qIndex, state.questions, boardAllMatchups, state.teamCount);
    return;
  }

  if (game.phase === 'countdown') {
    clearInterval(boardTimerInterval);
    const remaining = GAME.COUNTDOWN_SECONDS - Math.floor((Date.now() - game.countdownStart) / 1000);
    if (remaining > 0) {
      Board.startBoardCountdown(remaining, () => {});
    }
  }

  if (game.phase === 'answering') {
    Board.stopBoardCountdown();
    Board.hideBoardTimerBar(); // 상황판 타이머 숫자 제거
    const q = state.questions[game.qIndex];
    if (q) Board.showBoardQuestion(q);

    // 타이머 바만 표시 (숫자 없이)
    clearInterval(boardTimerInterval);
    boardTimerInterval = setInterval(() => {
      const elapsed = (Date.now() - game.questionStart) / 1000;
      Board.updateBoardTimerBar(elapsed, game.fullDuration || 30);
      if (elapsed >= (game.fullDuration || 30)) {
        clearInterval(boardTimerInterval);
        Board.hideBoardTimerBar();
      }
    }, 500);

    const unsubAns = onValue(R.answers(code, game.qIndex), snap => {
      if (!snap.exists()) return;
      const answers = snap.val();
      const q = state.questions[game.qIndex];
      const results = Object.entries(answers).map(([t, a]) => ({
        teamNum: t, answer: a.value, score: a.score, correct: a.correct,
        boostApplied: a.boostApplied, baseScore: a.baseScore
      }));
      Board.showBoardResults(results, q?.type);
    });
    state.unsubscribers.push(unsubAns);
  }

  if (game.phase === 'result') {
    clearInterval(boardTimerInterval);
    Board.hideBoardTimerBar();
  }

  if (game.phase === 'mystery') {
    _diceConfirmShown = false; // 새 mystery 단계마다 리셋

    // 주사위 벼락 확인 핸들러 (상황판에서 교사가 예/아니오)
    const handleDiceConfirm = async (data, confirmed) => {
      Board.hideDiceConfirmOverlay();
      if (!confirmed) {
        // 아니오: 효과 없이 결과 단계로
        await update(ref(db), {
          [`rooms/${code}/mystery/${game.qIndex}/pendingDice`]: false,
          [`rooms/${code}/mystery/${game.qIndex}/rejected`]:    true
        });
        await update(R.game(code), { phase: 'result' });
        return;
      }
      // 예: 효과 적용
      const [teamsSnap, settings] = await Promise.all([
        get(R.teams(code)),
        getMysterySettings(code)
      ]);
      const teams = teamsSnap.exists() ? teamsSnap.val() : {};
      const { updates, message, effectData } = applyMysteryCard(
        '주사위 벼락', teams, state.teamCount, data.choosingTeam, settings
      );
      const batch = { [`rooms/${code}/mystery/${game.qIndex}/pendingDice`]: false,
                      [`rooms/${code}/mystery/${game.qIndex}/message`]:     message,
                      [`rooms/${code}/mystery/${game.qIndex}/effectData`]:  effectData };
      for (const [k, v] of Object.entries(updates)) batch[`rooms/${code}/${k}`] = v;
      await update(ref(db), batch);
      await update(R.game(code), { phase: 'result' });
    };

    const mystSnap = await get(R.mystery(code, game.qIndex));
    if (mystSnap.exists()) {
      const mystData = mystSnap.val();
      Board.showBoardMysteryDeck(mystData.deck, mystData.choosingTeam);

      if (mystData.pendingDice && !_diceConfirmShown) {
        _diceConfirmShown = true;
        Board.showDiceConfirmOverlay({
          onConfirm: () => handleDiceConfirm(mystData, true),
          onReject:  () => handleDiceConfirm(mystData, false)
        });
      } else if (mystData.chosenIndex >= 0 && !mystData.pendingDice && !mystData.rejected &&
                 !(mystData.result === '주사위 벼락' && !mystData.effectData)) {
        Board.revealBoardMysteryCard(mystData.chosenIndex, mystData.result, mystData.effectData, mystData.message);
      }
    }

    const unsubMyst = onValue(R.mystery(code, game.qIndex), snap => {
      if (!snap.exists()) return;
      const data = snap.val();

      if (data.pendingDice && !_diceConfirmShown) {
        _diceConfirmShown = true;
        Board.showDiceConfirmOverlay({
          onConfirm: () => handleDiceConfirm(data, true),
          onReject:  () => handleDiceConfirm(data, false)
        });
      }

      const shouldReveal = data.chosenIndex >= 0 && !data.pendingDice && !data.rejected &&
        !(data.result === '주사위 벼락' && !data.effectData);
      if (shouldReveal) {
        Board.revealBoardMysteryCard(data.chosenIndex, data.result, data.effectData, data.message);
      }
    });
    state.unsubscribers.push(unsubMyst);
  }

  if (game.phase === 'ended') {
    clearInterval(boardTimerInterval);
    const teamsSnap = await get(R.teams(code));
    if (teamsSnap.exists()) {
      const teams  = teamsSnap.val();
      const sorted = Object.entries(teams)
        .map(([num, t]) => ({ teamNum: num, score: t.score || 0 }))
        .sort((a, b) => b.score - a.score);
      Board.startCeremony(sorted);
    }
  }
}

// =============================================
// 관리자 뷰 진입
// =============================================
function enterAdminView(code) {
  showView('view-admin');

  Admin.initAdminView({
    roomCode: code,
    onForceLock:         () => forceLockMatchup(code),
    onStartMatchupTimer: () => startMatchupTimer(code),
    onStartCountdown:    () => startCountdown(code),
    onNextQuestion:      () => nextQuestionWithCheck(code),
    onEndGame:           () => endGame(code),
    onResetGame:         () => resetGame(code),
    onScoreAdjust:       (teamNum, delta) => adjustScore(code, teamNum, delta)
  });

  // 미스터리 설정 저장 핸들러
  Admin.initMysterySettings(async (newSettings) => {
    await set(R.mysterySettings(code), newSettings);
  });

  // 미스터리 설정 리스너 (Firebase에서 변경 시 UI 반영)
  const unsubMystSettings = onValue(R.mysterySettings(code), snap => {
    const settings = snap.exists() ? snap.val() : DEFAULT_MYSTERY_SETTINGS;
    Admin.updateMysterySettingsUI(settings);
  });
  // 테스트 링크 패널의 초기화 버튼이 접근하는 전역 핸들러
  window._adminResetGame = () => resetGame(code);

  // meta 리스너 (상태 변화)
  const unsubMeta = onValue(R.meta(code), async snap => {
    if (!snap.exists()) return;
    const meta = snap.val();
    if (meta.status === 'matchup') {
      Admin.switchAdminSection('lobby');
      if (meta.matchupTimerStart) {
        // 타이머가 이미 시작된 경우 버튼 비활성화 + 타이머 표시
        Admin.disableMatchupTimerButton();
        startAdminMatchupTimer(code, meta.matchupTimerStart);
      }
      // matchupTimerStart가 null이면 타이머 시작 버튼 유효 상태 유지
    } else if (meta.status === 'playing') {
      Admin.switchAdminSection('game');
    }
  });

  // teams 리스너
  const unsubTeams = onValue(R.teams(code), snap => {
    if (!snap.exists()) return;
    Admin.renderAdminScorePanel(snap.val());
  });

  // 전체 제출 감지용 answers 리스너 (qIndex가 바뀔 때마다 재구독)
  let unsubAdminAnswers = null;
  let watchingQIndex    = -1;

  function subscribeAdminAnswers(qIndex, teamNums) {
    if (unsubAdminAnswers) { unsubAdminAnswers(); unsubAdminAnswers = null; }
    watchingQIndex = qIndex;

    unsubAdminAnswers = onValue(R.answers(code, qIndex), snap => {
      const answers = snap.exists() ? snap.val() : {};
      // 모든 모둠이 제출했으면 카운트다운 버튼 비활성화
      const allSubmitted = teamNums.length > 0 && teamNums.every(n => answers[n]);
      if (allSubmitted) Admin.markCountdownComplete();
    });
  }

  // game 리스너
  const unsubGame = onValue(R.game(code), async snap => {
    if (!snap.exists()) return;
    const game = snap.val();
    const q = state.questions[game.qIndex];
    if (q) Admin.updateAdminQuestionPreview(q, game.qIndex, state.questions.length);

    // idle 단계 진입 시 카운트다운 버튼 재활성화 + answers 리스너 해제
    if (game.phase === 'idle') {
      Admin.enableCountdownButton();
      Admin.hideRestartBanner();
      if (unsubAdminAnswers) { unsubAdminAnswers(); unsubAdminAnswers = null; }
      watchingQIndex = -1;
    } else if (game.phase === 'ended') {
      // 게임 종료 → 다시하기 배너 표시
      Admin.showRestartBanner(() => {
        if (confirm('점수와 대진표를 초기화하고 대진표 작성부터 다시 시작할까요?')) {
          restartGame(code);
        }
      });
    } else {
      // 카운트다운/풀이중/결과/미스터리 등 비-idle 단계에서는 버튼 비활성화
      Admin.disableCountdownButton();
      Admin.hideRestartBanner();
    }

    // answering 단계 진입 또는 qIndex 변경 시 answers 리스너 재구독
    if (game.phase === 'answering' && game.qIndex !== watchingQIndex) {
      const teamsSnap = await get(R.teams(code));
      const teamNums  = teamsSnap.exists() ? Object.keys(teamsSnap.val()) : [];
      subscribeAdminAnswers(game.qIndex, teamNums);
    }

    // 실시간 답변 현황
    const teamsSnap = await get(R.teams(code));
    const ansSnap   = await get(R.answers(code, game.qIndex));
    if (teamsSnap.exists()) {
      Admin.renderAdminLiveAnswers(teamsSnap.val(), ansSnap.exists() ? ansSnap.val() : {});
    }
  });

  // matchup 리스너 (대진표 현황)
  const unsubMatchup = onValue(R.allMatchup(code), snap => {
    const allMatchups = snap.exists() ? snap.val() : {};
    Admin.renderAdminMatchup({
      questions:   state.questions,
      teamCount:   state.teamCount,
      allMatchups
    });
  });

  state.unsubscribers.push(unsubMeta, unsubTeams, unsubGame, unsubMatchup, unsubMystSettings);
}

// 관리자: 대진표 타이머
let adminMatchupTimer = null;

function clearAdminMatchupTimer() {
  clearInterval(adminMatchupTimer);
  adminMatchupTimer = null;
}

// 관리자 패널 타이머 시작 (Firebase matchupTimerStart 기반)
function startAdminMatchupTimer(code, startTime) {
  clearInterval(adminMatchupTimer);
  adminMatchupTimer = setInterval(async () => {
    const elapsed   = (Date.now() - startTime) / 1000;
    const remaining = GAME.MATCHUP_SECONDS - elapsed;
    Admin.updateAdminMatchupTimer(remaining);

    if (remaining <= 0) {
      clearInterval(adminMatchupTimer);
      await forceLockMatchup(code);
    }
  }, 1000);
}

// 100초 카운트다운 시작 (관리자 버튼 클릭 시)
async function startMatchupTimer(code) {
  await update(R.meta(code), { matchupTimerStart: Date.now() });
}

// 강제 마감
async function forceLockMatchup(code) {
  clearInterval(adminMatchupTimer);
  const teamsSnap   = await get(R.teams(code));
  const matchupSnap = await get(R.allMatchup(code));
  const allMatchups = matchupSnap.exists() ? matchupSnap.val() : {};
  const teams       = teamsSnap.exists() ? teamsSnap.val() : {};

  const batchUpdate = {};
  for (const teamNum of Object.keys(teams)) {
    const members     = state.students[teamNum] || [`${teamNum}모둠원`];
    const teamMatchup = allMatchups[teamNum] || {};
    const filled      = autoFillMatchup(state.questions, members, teamMatchup);
    batchUpdate[`rooms/${code}/matchup/${teamNum}`] = filled;
  }
  batchUpdate[`rooms/${code}/meta/status`]       = 'playing';
  batchUpdate[`rooms/${code}/meta/matchupLocked`] = true; // 클라이언트에 마감 신호

  await update(ref(db), batchUpdate);
  Admin.switchAdminSection('game');
  Admin.showStartGameButton();
}

// 카운트다운 시작
async function startCountdown(code) {
  await update(R.game(code), {
    phase:          'countdown',
    countdownStart: Date.now()
  });

  // 5초 후 자동으로 answering 단계로
  setTimeout(async () => {
    const gameSnap = await get(R.game(code));
    if (!gameSnap.exists()) return;
    const game = gameSnap.val();
    if (game.phase !== 'countdown') return; // 이미 변경됐으면 무시

    const q = state.questions[game.qIndex];
    await update(R.game(code), {
      phase:         'answering',
      questionStart: Date.now(),
      fullDuration:  60, // 최대 60초
      perfectTime:   q?.perfTime || 5
    });
  }, GAME.COUNTDOWN_SECONDS * 1000);
}

// 다음 문제 (제출 현황 체크 후 — 미제출 모둠 있을 때만 confirm)
async function nextQuestionWithCheck(code) {
  const gameSnap = await get(R.game(code));
  if (!gameSnap.exists()) return;
  const game = gameSnap.val();

  // idle/countdown 상태에서는 확인 없이 바로 진행
  if (game.phase === 'idle' || game.phase === 'countdown') {
    nextQuestion(code);
    return;
  }

  // 제출 현황 확인
  const [teamsSnap, ansSnap] = await Promise.all([
    get(R.teams(code)),
    get(R.answers(code, game.qIndex))
  ]);
  const teamNums   = Object.keys(teamsSnap.exists() ? teamsSnap.val() : {});
  const answers    = ansSnap.exists() ? ansSnap.val() : {};
  const allSubmitted = teamNums.every(num => answers[num]);

  if (allSubmitted || confirm('제출하지 않은 모둠이 있습니다. 다음 문제로 넘어갈까요?')) {
    nextQuestion(code);
  }
}

// 다음 문제
async function nextQuestion(code) {
  const gameSnap = await get(R.game(code));
  if (!gameSnap.exists()) return;
  const game = gameSnap.val();

  // 미스터리 카드 처리 완료 여부 확인 후 넘어감
  const nextIdx = game.phase === 'idle' ? 0 : game.qIndex + 1;

  if (nextIdx >= state.questions.length) {
    await endGame(code);
    return;
  }

  // 저주, curseActive, statusThisQ 초기화 (문제 간 상태 리셋)
  const curseTeamsSnap = await get(R.teams(code));
  const clearCurseBatch = { [`rooms/${code}/curse`]: null };
  if (curseTeamsSnap.exists()) {
    for (const num of Object.keys(curseTeamsSnap.val())) {
      clearCurseBatch[`rooms/${code}/teams/${num}/curseActive`]   = false;
      clearCurseBatch[`rooms/${code}/teams/${num}/statusThisQ`]   = null; // 이번 문제 아이템 태그 초기화
    }
  }
  await update(ref(db), clearCurseBatch);

  await update(R.game(code), {
    qIndex:        nextIdx,
    phase:         'idle',
    countdownStart: null,
    questionStart:  null
  });

  Board.clearBoardResults();
  Board.hideBoardMysteryArea();
}

// 점수 조절
async function adjustScore(code, teamNum, delta) {
  const snap = await get(R.team(code, teamNum));
  if (!snap.exists()) return;
  const current = snap.val().score || 0;
  await update(R.team(code, teamNum), { score: Math.max(0, current + delta) });
  Admin.updateAdminScoreCard(teamNum, Math.max(0, current + delta));
}

// 게임 종료
async function endGame(code) {
  await update(R.game(code),  { phase: 'ended' });
  await update(R.meta(code),  { status: 'ended' });
}

// =============================================
// 게임 재시작 — 같은 방·팀 유지, 점수·대진표만 초기화해 대진표 단계부터 재시작
// =============================================
async function restartGame(code) {
  const teamsSnap = await get(R.teams(code));
  const teams = teamsSnap.exists() ? teamsSnap.val() : {};

  const batch = {};

  // meta 리셋 (대진표 단계로)
  batch[`rooms/${code}/meta/status`]            = 'matchup';
  batch[`rooms/${code}/meta/matchupLocked`]     = false;
  batch[`rooms/${code}/meta/matchupTimerStart`] = null;

  // game 리셋
  batch[`rooms/${code}/game/qIndex`]        = 0;
  batch[`rooms/${code}/game/phase`]         = 'idle';
  batch[`rooms/${code}/game/countdownStart`] = null;
  batch[`rooms/${code}/game/questionStart`]  = null;

  // 각 팀 데이터 리셋
  for (const num of Object.keys(teams)) {
    batch[`rooms/${code}/teams/${num}/score`]           = 0;
    batch[`rooms/${code}/teams/${num}/items`]           = { boost: true, curse: true, eraser: true };
    batch[`rooms/${code}/teams/${num}/shieldActive`]    = false;
    batch[`rooms/${code}/teams/${num}/curseActive`]     = false;
    batch[`rooms/${code}/teams/${num}/statusThisQ`]     = null;
    batch[`rooms/${code}/teams/${num}/shieldBlockedAt`] = null;
  }

  // 대진표·답변·미스터리·저주 초기화
  batch[`rooms/${code}/matchup`]  = null;
  batch[`rooms/${code}/answers`]  = null;
  batch[`rooms/${code}/mystery`]  = null;
  batch[`rooms/${code}/curse`]    = null;

  // 관리자 UI 리셋 (버튼 상태)
  clearAdminMatchupTimer();
  Admin.resetLobbyUI();
  Admin.hideRestartBanner();

  await update(ref(db), batch);
}

// =============================================
// 세션 초기화 — 방을 DB에서 완전 삭제
// Firebase 삭제 이벤트가 모든 참여자의 onValue 리스너를 트리거해
// 학생·상황판이 자동으로 초기 화면으로 복귀함
// =============================================
async function resetGame(code) {
  // 방 전체 삭제 — 삭제 이벤트가 모든 참여자 리스너를 트리거함
  await remove(R.room(code));

  // 관리자 타이머 정리 후 초기 화면으로 복귀
  clearAdminMatchupTimer();
  navigateToSetting();
}

// =============================================
// 클라이언트 뷰 진입
// =============================================
async function enterClientView(code, savedTeam) {
  showView('view-client');

  // 튜토리얼 버튼 연결 (중복 등록 방지)
  const tutBtn = document.getElementById('client-tutorial-btn');
  if (tutBtn && !tutBtn._tutorialBound) {
    tutBtn._tutorialBound = true;
    tutBtn.addEventListener('click', () => Client.showTutorial());
  }

  // 팀 현황 가져오기
  const teamsSnap = await get(R.teams(code));
  const teams     = teamsSnap.exists() ? teamsSnap.val() : {};

  // 이미 팀이 저장됐으면 바로 매칭업 단계로
  if (savedTeam && teams[savedTeam]) {
    state.myTeam = savedTeam;
    localStorage.setItem(LS.TEAM, savedTeam);
    await update(R.team(code, savedTeam), { connected: true });
    startClientGameListener(code, savedTeam);
    return;
  }

  // 팀 선택 UI
  Client.renderTeamSelect({
    roomCode:   code,
    teamCount:  state.teamCount,
    takenTeams: [], // 실시간으로 갱신
    onSelect:   (teamNum) => selectTeam(code, teamNum)
  });
}

// 팀 선택
async function selectTeam(code, teamNum) {
  state.myTeam = teamNum;
  localStorage.setItem(LS.TEAM, teamNum);

  // 현재 리셋 카운터를 저장 → 이후 증가 시 초기 화면으로 복귀
  const metaSnap   = await get(R.meta(code));
  const resetCount = metaSnap.exists() ? (metaSnap.val().resetCount || 0) : 0;
  localStorage.setItem(LS.RESET_COUNT, String(resetCount));

  await update(R.team(code, teamNum), { connected: true });
  startClientGameListener(code, teamNum);
}

// =============================================
// 클라이언트: 게임 전체 리스너
// =============================================
function startClientGameListener(code, teamNum) {
  const members = state.students[teamNum] || [`${teamNum}모둠원`];
  let clientInMatchupPhase = false; // 대진표 UI 중복 렌더 방지 플래그

  // 대진표 단계 리스너
  const unsubMeta = onValue(R.meta(code), snap => {
    if (!snap.exists()) { navigateToSetting(); return; }

    const meta = snap.val();

    const storedResetCount = parseInt(localStorage.getItem(LS.RESET_COUNT) || '0');
    if ((meta.resetCount || 0) > storedResetCount) { navigateToSetting(); return; }

    // 강제 마감 → 마감 화면 전환
    if (meta.matchupLocked && clientInMatchupPhase) {
      clientInMatchupPhase = false;
      clearInterval(clientMatchupTimer);
      clientMatchupTimer = null;
      Client.showMatchupClosed();
      return;
    }

    if (meta.status === 'matchup') {
      if (!clientInMatchupPhase) {
        clientInMatchupPhase = true;
        startClientMatchupPhase(code, teamNum, members, meta.matchupTimerStart);
      } else if (meta.matchupTimerStart && !clientMatchupTimer) {
        // 관리자가 타이머를 막 시작한 경우 — 타이머 표시만 추가
        startClientMatchupTimerDisplay(meta.matchupTimerStart);
      }
    }
  });

  // 게임 진행 리스너
  const unsubGame = onValue(R.game(code), snap => {
    if (!snap.exists()) return;
    const game = snap.val();
    handleClientGameUpdate(code, teamNum, game, members);
  });

  // 저주 리스너 — 저주가 걸리면 즉시 카운트다운 화면에 알림 표시
  const unsubCurse = onValue(R.curse(code, teamNum), snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    if (data.active) Client.showCurseWarning();
  });

  // 내 팀 데이터 리스너 — shieldBlockedAt 감지 시 쉴드 막음 효과 표시
  let _lastShieldBlockAt = 0;
  const unsubMyTeam = onValue(R.team(code, teamNum), snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    if (data.shieldBlockedAt && data.shieldBlockedAt !== _lastShieldBlockAt &&
        (Date.now() - data.shieldBlockedAt < 2500)) {
      _lastShieldBlockAt = data.shieldBlockedAt;
      Client.showShieldBlockEffect();
    }
  });

  state.unsubscribers.push(unsubMeta, unsubGame, unsubCurse, unsubMyTeam);
}

// =============================================
// 클라이언트: 대진표 단계
// =============================================
let clientMatchupTimer = null;

function startClientMatchupPhase(code, teamNum, members, initialTimerStart) {
  get(R.matchup(code, teamNum)).then(snap => {
    const currentMatchup = snap.exists() ? snap.val() : {};

    Client.renderMatchupPhase({
      teamNum,
      members,
      questions:    state.questions,
      matchup:      currentMatchup,
      onMatchupUpdate: async (updated) => {
        await set(R.matchup(code, teamNum), updated);
      },
      onSubmit: async (finalMatchup) => {
        // 대진표 제출: Firebase 저장 + 제출 상태 기록
        await set(R.matchup(code, teamNum), finalMatchup);
        await update(ref(db), {
          [`rooms/${code}/matchupSubmissions/${teamNum}`]: true
        });
        clearInterval(clientMatchupTimer);
        clientMatchupTimer = null;
        Client.showWaiting('대진표를 제출했습니다. 선생님이 시작하면 자동으로 넘어갑니다.');
      }
    });

    // 타이머: 관리자가 시작 버튼을 누른 경우에만 표시
    const timerEl = document.getElementById('cs-matchup-timer');
    if (timerEl) timerEl.textContent = '—';

    if (initialTimerStart) {
      startClientMatchupTimerDisplay(initialTimerStart);
    }
  });
}

// 클라이언트 대진표 타이머 표시 (별도 함수 — 동적으로 시작 가능)
function startClientMatchupTimerDisplay(startTime) {
  clearInterval(clientMatchupTimer);
  clientMatchupTimer = setInterval(() => {
    const elapsed   = (Date.now() - startTime) / 1000;
    const remaining = GAME.MATCHUP_SECONDS - elapsed;
    const timerEl   = document.getElementById('cs-matchup-timer');
    if (timerEl) {
      timerEl.textContent = Math.max(0, Math.ceil(remaining));
      timerEl.classList.toggle('urgent', remaining <= 10);
    }
    if (remaining <= 0) {
      clearInterval(clientMatchupTimer);
      clientMatchupTimer = null;
    }
  }, 500);
}

// =============================================
// 클라이언트: 게임 진행 상태 처리
// =============================================
async function handleClientGameUpdate(code, teamNum, game, members) {
  if (game.phase === 'idle') {
    _currentQIndex = -1; // 문제 인덱스 초기화
    Client.showWaiting('다음 문제를 기다리는 중...');
    return;
  }

  if (game.phase === 'countdown') {
    Sound.playTick();
    // 카운트다운 중 아이템 버튼 표시
    const teamSnap = await get(R.team(code, teamNum));
    const teamData = teamSnap.exists() ? teamSnap.val() : {};
    Client.showCountdownWithItems({
      teamNum,
      score:    teamData.score || 0,
      items:    teamData.items || {},
      onUseItem: (itemType) => handleClientItemUse(code, teamNum, itemType, teamData)
    });
    return;
  }

  if (game.phase === 'answering') {
    await showClientQuestion(code, teamNum, game, members);
    return;
  }

  if (game.phase === 'result') {
    // 결과 표시는 답변 제출 시 이미 표시됨
    Client.showWaiting('결과 확인 중...');
    return;
  }

  if (game.phase === 'mystery') {
    const mystSnap = await get(R.mystery(code, game.qIndex));
    if (!mystSnap.exists()) return;
    const mystData = mystSnap.val();
    if (mystData.choosingTeam === teamNum) {
      // 내 팀이 카드 선택
      Client.showMysteryCardPicker({
        deck:   mystData.deck,
        onPick: async (idx, cardName) => {
          await handleMysteryCardPicked(code, idx, cardName, teamNum, game.qIndex);
        }
      });
    } else {
      Client.showWaiting('미스터리 카드 선택 중...');
    }
    return;
  }

  if (game.phase === 'ended') {
    const teamsSnap = await get(R.teams(code));
    if (!teamsSnap.exists()) return;
    const teams  = teamsSnap.val();
    const sorted = Object.entries(teams)
      .map(([n, t]) => ({ teamNum: parseInt(n), score: t.score || 0 }))
      .sort((a, b) => b.score - a.score);
    const ranked   = assignRanks(sorted);
    const myEntry  = ranked.find(r => r.teamNum === teamNum);
    const myRank   = myEntry ? myEntry.rank : ranked.length;
    const rankCounts = {};
    for (const r of ranked) rankCounts[r.rank] = (rankCounts[r.rank] || 0) + 1;
    const isShared = (rankCounts[myRank] || 1) > 1;
    Client.showClientCeremony(myRank, teams[teamNum]?.score || 0, isShared);
  }
}

// =============================================
// 클라이언트: 문제 표시
// =============================================
async function showClientQuestion(code, teamNum, game, members) {
  // 이미 같은 문제를 표시 중이면 중복 렌더링 방지 (선잇기 캔버스 보호)
  if (game.qIndex === _currentQIndex) return;
  _currentQIndex = game.qIndex;

  const q = state.questions[game.qIndex];
  if (!q) return;

  // 이 문제 내 팀 참전자 확인
  const matchupSnap = await get(R.matchup(code, teamNum));
  const teamMatchup = matchupSnap.exists() ? matchupSnap.val() : {};
  const fighter     = teamMatchup[String(game.qIndex)] || members[0];

  // 팀 정보
  const teamSnap = await get(R.team(code, teamNum));
  const teamData = teamSnap.exists() ? teamSnap.val() : {};

  // 저주 확인
  const curseSnap = await get(R.curse(code, teamNum));
  const curseData = curseSnap.exists() ? curseSnap.val() : { active: false };

  Client.showQuizPhase({
    teamNum,
    fighterName: fighter,
    score:       teamData.score || 0,
    question:    q,
    curseInfo:   curseData,
    onSubmit: (value, elapsedSec) => handleClientSubmit(code, teamNum, q, game, value, elapsedSec, teamData),
    onUseItem: () => {}  // 문제 출제 후에는 아이템 사용 불가
  });

  // 저주 사용 후 Firebase 초기화 + 상태 태그 제거
  if (curseData.active) {
    await Promise.all([
      update(R.curse(code, teamNum), { active: false, delayMs: 0 }),
      update(R.team(code, teamNum),  { curseActive: false })
    ]);
  }
}

// =============================================
// 클라이언트: 정답 제출
// =============================================
async function handleClientSubmit(code, teamNum, q, game, value, elapsedSec, teamData) {
  // 정답 판정
  let isCorrect = false;
  if (q.type === '객관식') {
    isCorrect = checkMultipleChoice(value, q.answers[0]);
  } else if (q.type === '단답형') {
    isCorrect = checkShortAnswer(value, q.answers);
  } else if (q.type === '선잇기') {
    isCorrect = checkMatching(value, q.matchPairs);
  }

  // 점수 계산 (미스터리 문제는 최대 1점 — 카드 효과가 메인 보상)
  let score = 0;
  let baseScore    = 0;
  let boostApplied = false;
  if (isCorrect) {
    score     = q.isMystery ? 1 : calcScore(elapsedSec, q.perfTime);
    baseScore = score;
    // 1.5배 아이템 적용
    if (Client.isBoostActive()) {
      boostApplied = true;
      score        = Math.ceil(score * 1.5);
      Client.clearBoost();
    }
  }

  // Firebase에 답변 저장
  const answerData = {
    value:        Array.isArray(value) ? JSON.stringify(value) : String(value),
    submittedAt:  Date.now(),
    elapsedSec,
    score,
    baseScore:    boostApplied ? baseScore : score,
    boostApplied,
    correct:      isCorrect
  };
  await set(R.answer(code, game.qIndex, teamNum), answerData);

  // 팀 점수 업데이트
  if (isCorrect && score > 0) {
    const newScore = (teamData.score || 0) + score;
    await update(R.team(code, teamNum), { score: newScore });
  }

  // 결과 표시
  const displayAnswer = q.type === '선잇기'
    ? q.matchPairs.map(p => `${p.left}:${p.right}`).join(' | ')
    : q.rawAnswer;

  Client.showQuizResult({
    correct:      isCorrect,
    score,
    baseScore,
    correctAnswer: displayAnswer,
    boostApplied
  });

  // 미스터리 문제 && 정답 → 가장 먼저 맞힌 모둠이 카드 선택권 획득
  if (q.isMystery && isCorrect) {
    const freshGameSnap = await get(R.game(code));
    if (freshGameSnap.val()?.phase === 'answering') {
      const settings = await getMysterySettings(code);
      const deck = createMysteryDeck(settings.deckCounts);
      await set(R.mystery(code, game.qIndex), {
        deck,
        choosingTeam: teamNum,
        chosenIndex:  -1,
        result:       null
      });
      await update(R.game(code), { phase: 'mystery' });
    }
  }
}

// =============================================
// 클라이언트: 아이템 사용
// =============================================
async function handleClientItemUse(code, teamNum, itemType, teamData) {
  if (itemType === ITEM_TYPES.CURSE) {
    // 저주: 자기 모둠 제외 모든 모둠에 동시 적용
    const [teamsSnap, settings] = await Promise.all([
      get(R.teams(code)),
      getMysterySettings(code)
    ]);
    const teams = teamsSnap.exists() ? teamsSnap.val() : {};

    const batchUpdate = {};
    batchUpdate[`rooms/${code}/teams/${teamNum}/items/curse`]          = false; // 저주 아이템 사용 표시
    batchUpdate[`rooms/${code}/teams/${teamNum}/statusThisQ/curse`]    = true;  // 이번 문제 사용 태그

    const minMs = settings.curseMinMs ?? 1500;
    const maxMs = settings.curseMaxMs ?? 2500;

    for (const [num, targetData] of Object.entries(teams)) {
      if (parseInt(num) === teamNum) continue; // 자기 모둠 제외

      if (targetData?.shieldActive) {
        // 쉴드가 있으면 저주 차단 + 쉴드 소모 + 플래시 트리거
        batchUpdate[`rooms/${code}/teams/${num}/shieldActive`]   = false;
        batchUpdate[`rooms/${code}/teams/${num}/shieldBlockedAt`] = Date.now();
        // alert 없음 — 상황판/클라이언트 시각 효과로 대체
        continue;
      }

      // 저주 적용 (각 모둠마다 설정 범위 내 랜덤 지연)
      const delayMs = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
      batchUpdate[`rooms/${code}/curse/${num}/active`]      = true;
      batchUpdate[`rooms/${code}/curse/${num}/delayMs`]     = delayMs;
      batchUpdate[`rooms/${code}/curse/${num}/by`]          = teamNum;
      batchUpdate[`rooms/${code}/teams/${num}/curseActive`]  = true; // 상황판 상태 태그용
    }

    await update(ref(db), batchUpdate);
    Sound.playCurse();
  } else {
    // 부스트: 클라이언트 내부 상태 활성화 + Firebase 사용 표시
    if (itemType === ITEM_TYPES.BOOST) {
      Client._activateBoost(); // client.js에서 export된 내부 상태 활성화 함수
    }
    // Firebase에 아이템 사용 표시 + 이번 문제 사용 태그 기록
    await update(ref(db), {
      [`rooms/${code}/teams/${teamNum}/items/${itemType}`]:          false,
      [`rooms/${code}/teams/${teamNum}/statusThisQ/${itemType}`]:    true
    });
  }
}

// =============================================
// 미스터리 카드 선택 처리
// =============================================
async function handleMysteryCardPicked(code, idx, cardName, teamNum, qIndex) {
  // 주사위 벼락: 상황판에서 교사 확인 후 진행
  if (cardName === '주사위 벼락') {
    await update(ref(db), {
      [`rooms/${code}/mystery/${qIndex}/chosenIndex`]: idx,
      [`rooms/${code}/mystery/${qIndex}/result`]:      cardName,
      [`rooms/${code}/mystery/${qIndex}/pendingDice`]: true
    });
    Client.showWaiting('⚡ 주사위 벼락 — 상황판에서 진행 여부를 확인 중...');
    return; // 상황판에서 예/아니오 선택 후 처리
  }

  // 그 외 카드: 즉시 효과 적용
  const [teamsSnap, settings] = await Promise.all([
    get(R.teams(code)),
    getMysterySettings(code)
  ]);
  const teams = teamsSnap.exists() ? teamsSnap.val() : {};

  const { updates, message, effectData } = applyMysteryCard(
    cardName, teams, state.teamCount, teamNum, settings
  );

  const batchUpdate = {};
  for (const [k, v] of Object.entries(updates)) {
    batchUpdate[`rooms/${code}/${k}`] = v;
  }
  batchUpdate[`rooms/${code}/mystery/${qIndex}/chosenIndex`] = idx;
  batchUpdate[`rooms/${code}/mystery/${qIndex}/result`]      = cardName;
  batchUpdate[`rooms/${code}/mystery/${qIndex}/message`]     = message;
  if (effectData) {
    batchUpdate[`rooms/${code}/mystery/${qIndex}/effectData`] = effectData;
  }
  await update(ref(db), batchUpdate);

  Client.showWaiting(message);
  await update(R.game(code), { phase: 'result' });
}

// 앱 시작
main().catch(console.error);

'use strict';

// =============================================
// 설정값
// =============================================
const CFG = {
  SEED          : 42,
  MAP_LEN       : 300,  // 총 계단 수 (STEPS_PER_M으로 나누면 최대 높이 m)
  UNIT          : 70,    // 가로 이동 단위 (px)
  STEP_W        : 96,    // 발판 너비
  STEP_TOP      : 18,    // 발판 윗면 두께
  STEP_SIDE     : 8,     // 발판 앞면 높이 (입체감)
  STEP_GAP      : 60,    // 계단 수직 간격
  PLAYER_W      : 28,
  PLAYER_H      : 36,
  FALL_LOCK_MS  : 600,   // 추락 직후 입력 잠금 시간 (ms)
  DRIFT_SECONDS : 5,     // 착지 허용 시간 (초)
  STEPS_PER_M   : 10,
  LAND_TOL      : 12,    // 착지 허용 오차 (px) — 발판 윗면에서 아래로 이 범위 안에만 착지 인정
  WHIP_N_START    : 2000, // 채찍 게이지 1 증가까지 허용 무입력 시간 (ms) — 0m 기준
  WHIP_N_END      : 200,  // 채찍 허용 시간 최솟값 (ms) — 500m 이상
  WHIP_HEIGHT_MAX : 500,  // n이 최솟값에 도달하는 높이 (m)
  WHIP_MAX        : 10,   // 채찍 게이지 최댓값 (도달 시 랜덤 키 발동)
  QUIZ_INTERVAL_MS: 30000, // 퀴즈 출제 간격 (ms)
  QUIZ_BATCH_SIZE : 3,     // 한 번에 출제하는 문제 수
  QUIZ_FREEZE_MS  : 3000,  // 0개 정답 시 정지 시간 (ms)
};

// 엑셀 컬럼 인덱스 (quiz-battle-royale와 동일 양식)
const Q_COL = { NUM: 0, TYPE: 1, CONTENT: 2, IMAGE: 3, ANSWER: 4, OPT_START: 5 };

// =============================================
// 난이도 구간 파라미터 — 숫자만 바꾸면 난이도 조정 가능
//
// fromM       : 구간 시작 높이 (m). 오름차순으로 정렬할 것.
// jumpChance  : 점프 키(2=좌점프, 3=우점프) 등장 확률 (0.0~1.0)
// changeChance: 이전 방향과 다른 방향이 나올 확률 (0.0~1.0)
//               낮을수록 같은 키가 길게 이어짐.
//               평균 연속 칸 수 ≈ 1 / changeChance
//               (예: 0.20 → 평균 5칸 연속, 0.90 → 평균 1.1칸 연속)
// =============================================
const MAP_ZONES = [
  { fromM:   0, jumpChance: 0.00, changeChance: 0.20 }, // 0~10m  : 점프 없음, 평균 5칸 연속
  { fromM:  10, jumpChance: 0.15, changeChance: 0.30 }, // 10~20m : 점프 가끔, 평균 3칸 연속
  { fromM:  20, jumpChance: 0.30, changeChance: 0.45 }, // 20~50m : 점프 보통, 평균 2칸 연속
  { fromM:  50, jumpChance: 0.45, changeChance: 0.60 }, // 50~100m: 점프 많음
  { fromM: 100, jumpChance: 0.60, changeChance: 0.75 }, // 100~200m
  { fromM: 200, jumpChance: 0.70, changeChance: 0.90 }, // 200m+  : 거의 매 칸 바뀜
];

// =============================================
// 시드 기반 의사난수 생성기 (mulberry32)
// 같은 seed → 항상 동일한 수열
// =============================================
function createRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// 현재 높이(m)에 따른 채찍 무입력 허용 간격 (ms)
// 0m → 2000ms, 500m → 200ms 선형 감소, 200ms 하한
function getWhipInterval() {
  const height = state.player.stepIndex / CFG.STEPS_PER_M;
  const t = Math.min(height / CFG.WHIP_HEIGHT_MAX, 1);
  return CFG.WHIP_N_START - (CFG.WHIP_N_START - CFG.WHIP_N_END) * t;
}

// 주어진 높이(m)에 해당하는 난이도 구간 파라미터 반환
function getZoneParams(heightM) {
  let zone = MAP_ZONES[0];
  for (const z of MAP_ZONES) {
    if (heightM >= z.fromM) zone = z;
  }
  return zone;
}

// 0=좌1칸  1=우1칸  2=좌점프  3=우점프
// 구간(MAP_ZONES)별로 점프 확률과 연속성을 조절해 난이도 상승
// rng()를 계단마다 정확히 2번 호출하므로 같은 시드 → 항상 같은 맵
function generateMap(seed, length) {
  const rng = createRNG(seed);
  const map = [];
  let prevDir = 0; // 이전 방향: 0=왼쪽, 1=오른쪽

  for (let i = 0; i < length; i++) {
    const zone = getZoneParams(i / CFG.STEPS_PER_M);

    const r1 = rng(); // 점프 여부 결정
    const r2 = rng(); // 방향 변경 여부 결정

    const isJump = r1 < zone.jumpChance;
    const newDir = (r2 < zone.changeChance) ? 1 - prevDir : prevDir;

    // 방향(newDir) × 거리(isJump) → 키 코드
    map.push(newDir === 0 ? (isJump ? 2 : 0) : (isJump ? 3 : 1));
    prevDir = newDir;
  }

  return map;
}

// 구간별 맵 샘플을 콘솔에 출력 (의도대로 생성됐는지 확인용)
function logMapSample(map) {
  const LABEL = ['←1', '→1', '←←', '→→'];
  const ZONES_TO_CHECK = [
    { label: ' 0~10m (쉬움)',    from:   0 },
    { label: '10~20m (보통)',    from: 100 },
    { label: '20~30m (어려움)', from: 200 },
  ];
  console.log('[천국의 계단] 구간별 맵 샘플 (시드=' + CFG.SEED + '):');
  for (const s of ZONES_TO_CHECK) {
    if (s.from >= map.length) {
      console.log('  ' + s.label + ': (해당 구간 없음 — MAP_LEN 부족)');
      continue;
    }
    const slice = map.slice(s.from, s.from + 15);
    const keys  = slice.map(k => LABEL[k]).join(' ');
    // 점프 비율 계산
    const jumpCount = slice.filter(k => k >= 2).length;
    console.log('  ' + s.label + ': ' + keys + '  [점프 ' + jumpCount + '/15]');
  }
}

function buildSteps(map) {
  const DX = [-CFG.UNIT, +CFG.UNIT, -CFG.UNIT * 2, +CFG.UNIT * 2];
  const steps = [{ x: 0, y: 0, code: -1 }];
  let x = 0, y = 0;
  for (const code of map) {
    y -= CFG.STEP_GAP;
    x += DX[code];
    steps.push({ x, y, code });
  }
  return steps;
}

// =============================================
// 전체 게임 상태 — 단일 state 객체
// phase: 'normal' | 'falling_locked' | 'drifting' | 'gameover'
// =============================================
const state = {
  map   : generateMap(CFG.SEED, CFG.MAP_LEN),
  steps : [],
  player: {
    stepIndex         : 0,
    phase             : 'normal',
    fallFromY         : 0,   // 추락 시작 world-y (발판 y)
    fallFromStepIndex : -1,  // 추락 시작 발판 인덱스 (착지 즉시 복귀 방지)
    fallLockEndsAt    : 0,   // 추락 잠금 종료 만료 시각
    driftX            : 0,   // 표류 x world 좌표
    driftY            : 0,   // 표류 시작 발바닥 y
    driftStartAt      : 0,   // 표류 시작 시각
    driftEndsAt       : 0,   // 표류 종료 만료 시각 (5초 후)
    whipGauge         : 0,   // 채찍 게이지 (0 ~ WHIP_MAX)
    whipTickAt        : 0,   // 다음 게이지 증가 만료 시각 (0 = 미초기화)
    whipFlashAt       : 0,   // 채찍 발동 플래시 시작 시각
  },
  camera: { x: 0, y: 0 },
  quiz: {
    questions   : [],   // 파싱된 전체 문제 배열
    queue       : [],   // 남은 출제 큐 (셔플 순서)
    nextAt      : 0,    // 다음 퀴즈 만료 시각 (0 = 비활성)
    active      : false,
    batch       : [],   // 현재 출제된 문제들
    batchIdx    : 0,    // 현재 문제 인덱스
    correctCount: 0,    // 현재 배치 정답 수
    freezeUntil : 0,    // 0개 정답 패널티 정지 만료 시각
  },
};
state.steps = buildSteps(state.map);

logMapSample(state.map);

// =============================================
// 플레이어 발바닥 world-y (phase별)
// =============================================
function getPlayerWorldY() {
  const { player, steps } = state;

  if (player.phase === 'normal') {
    return steps[player.stepIndex].y - CFG.STEP_TOP; // 발판 윗면
  }
  if (player.phase === 'falling_locked') {
    const elapsed = CFG.FALL_LOCK_MS - Math.max(player.fallLockEndsAt - Date.now(), 0);
    const t = elapsed / CFG.FALL_LOCK_MS;
    return (player.fallFromY - CFG.STEP_TOP) + t * 50; // 잠금 동안 50px 낙하
  }
  if (player.phase === 'drifting') {
    const s = (Date.now() - player.driftStartAt) / 1000;
    return player.driftY + 50 * s + 15 * s * s; // 가속 낙하 (px)
  }
  // gameover: driftY에 최종 위치가 저장돼 있음
  return player.driftY;
}

// 플레이어 x world 좌표 (표류/게임오버엔 driftX 사용)
function getPlayerWorldX() {
  const { player, steps } = state;
  if (player.phase === 'drifting' || player.phase === 'gameover') return player.driftX;
  return steps[player.stepIndex].x;
}

// =============================================
// 입력 처리 — 키보드/터치 버튼 공용
// code: 0=좌1칸  1=우1칸  2=좌점프  3=우점프
// =============================================
function handleInput(code) {
  const { player, steps, map } = state;

  // 퀴즈 진행 중 또는 0점 패널티 정지 중 — 모든 입력 차단
  if (state.quiz.active) return;
  if (state.quiz.freezeUntil > Date.now()) return;

  // 게임오버: 아무 입력이나 재시작
  if (player.phase === 'gameover') {
    player.phase             = 'normal';
    player.stepIndex         = 0;
    player.fallFromStepIndex = -1;
    player.whipGauge         = 0;
    player.whipTickAt        = 0;
    player.whipFlashAt       = 0;
    state.camera.x           = 0;
    state.camera.y           = 0;
    state.quiz.active        = false;
    state.quiz.freezeUntil   = 0;
    state.quiz.nextAt        = state.quiz.questions.length > 0
      ? Date.now() + CFG.QUIZ_INTERVAL_MS : 0;
    return;
  }

  // 표류 중: 좌1칸(0)·우1칸(1)만 허용, 1칸씩 이동
  if (player.phase === 'drifting') {
    if (code === 0) player.driftX -= CFG.UNIT;
    if (code === 1) player.driftX += CFG.UNIT;
    return;
  }

  if (player.phase !== 'normal') return;
  if (player.stepIndex >= steps.length - 1) return;

  // 키 누름: 채찍 게이지 -1, 무입력 타이머 리셋
  player.whipGauge  = Math.max(0, player.whipGauge - 1);
  player.whipTickAt = Date.now() + getWhipInterval();

  const expected = map[player.stepIndex];
  if (code === expected) {
    player.stepIndex++;
  } else {
    // 오답: 추락 잠금 시작
    player.phase              = 'falling_locked';
    player.fallFromY          = steps[player.stepIndex].y;
    player.fallFromStepIndex  = player.stepIndex; // 추락 시작 발판 기록
    player.fallLockEndsAt     = Date.now() + CFG.FALL_LOCK_MS;
  }
}

// =============================================
// 키보드 → handleInput 연결
// =============================================
const KEY_MAP = {
  'ArrowLeft' : 0, 'a': 0, 'A': 0,
  'ArrowRight': 1, 'd': 1, 'D': 1,
  'q': 2, 'Q': 2, 'z': 2, 'Z': 2,
  'e': 3, 'E': 3, 'x': 3, 'X': 3,
};

window.addEventListener('keydown', (e) => {
  if (state.player.phase === 'gameover') { handleInput(-1); return; }
  if (e.key in KEY_MAP) { e.preventDefault(); handleInput(KEY_MAP[e.key]); }
});

// =============================================
// 캔버스
// =============================================
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// =============================================
// 렌더링
// =============================================
const DIR_LABELS = ['←', '→', '←←', '→→'];

function render() {
  const W = canvas.width;
  const H = canvas.height;
  const { steps, player, camera, map } = state;

  // 배경
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#07071a');
  bg.addColorStop(1, '#12123a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 별
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 80; i++) {
    const sz = (i % 5 === 0) ? 2 : 1;
    ctx.fillRect((i * 173 + 61) % W, (i * 293 + 37) % H, sz, sz);
  }

  // 표류/추락 중엔 화면을 위로 당겨 아래쪽 계단을 더 보여줌
  const isDrifting = player.phase === 'drifting' || player.phase === 'falling_locked';
  const yFrac  = isDrifting ? 0.35 : 0.75;
  const originX = W / 2 - camera.x;
  const originY = H * yFrac - camera.y;
  const toSx = (wx) => originX + wx;
  const toSy = (wy) => originY + wy;

  const SW = CFG.STEP_W;
  const ST = CFG.STEP_TOP;
  const SS = CFG.STEP_SIDE;

  // 경로선
  ctx.lineWidth = 1;
  for (let i = 0; i + 1 < steps.length; i++) {
    const a = steps[i], b = steps[i + 1];
    const ay = toSy(a.y) - ST, by = toSy(b.y) - ST;
    if (Math.min(ay, by) > H + 80 || Math.max(ay, by) < -80) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(toSx(a.x), ay);
    ctx.lineTo(toSx(b.x), by);
    ctx.stroke();
  }

  // 계단 발판
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const sx = toSx(step.x);
    const sy = toSy(step.y);
    if (sy < -80 || sy > H + 80) continue;

    const isCurrent = (i === player.stepIndex && player.phase === 'normal');
    const isGoal    = (i === steps.length - 1);
    const isJump    = (step.code === 2 || step.code === 3);

    let topColor  = isJump ? '#e8803a' : '#4a9eff';
    let sideColor = isJump ? '#9a4f1e' : '#1e5fa8';
    if (i === 0) { topColor = '#f0c030'; sideColor = '#a07010'; }
    if (isGoal)  { topColor = '#b06eff'; sideColor = '#6030b0'; }

    // 현재 계단 강조 테두리
    if (isCurrent) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth   = 2;
      ctx.strokeRect(sx - SW / 2 - 2, sy - ST - 2, SW + 4, ST + 4);
    }

    ctx.fillStyle = topColor;
    ctx.fillRect(sx - SW / 2, sy - ST, SW, ST);
    ctx.fillStyle = sideColor;
    ctx.fillRect(sx - SW / 2, sy, SW, SS);

    // 레이블: 이 계단에서 눌러야 할 방향
    const label = isGoal ? 'GOAL' : DIR_LABELS[map[i]];
    ctx.font         = isCurrent ? 'bold 15px sans-serif' : 'bold 13px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = isCurrent ? '#fff' : 'rgba(255,255,255,0.75)';
    ctx.fillText(label, sx, sy - ST / 2);
  }

  // 플레이어
  const worldX = getPlayerWorldX();
  const feetY  = getPlayerWorldY();
  const px     = toSx(worldX);
  const PW     = CFG.PLAYER_W;
  const PH     = CFG.PLAYER_H;
  const top    = toSy(feetY) - PH;

  const PLAYER_COLOR = { normal: '#ff4757', falling_locked: '#888', drifting: '#ffb347', gameover: '#666' };
  ctx.fillStyle = PLAYER_COLOR[player.phase] || '#ff4757';
  ctx.fillRect(px - PW / 2, top, PW, PH);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(px - PW / 2, top, PW, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(px - 10, top + 8, 6, 6);
  ctx.fillRect(px + 4,  top + 8, 6, 6);

  // --- 채찍 게이지 바 (좌상단) ---
  if (player.phase === 'normal' || player.phase === 'falling_locked') {
    const gx = 16, gy = 16;
    const segW = 16, segH = 20, segGap = 3;

    ctx.font         = 'bold 12px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = 'rgba(255,255,255,0.5)';
    ctx.fillText('채찍 게이지', gx, gy);

    // 현재 간격 표시 (작게)
    const intervalSec = (getWhipInterval() / 1000).toFixed(1);
    ctx.font      = '11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(`(${intervalSec}s)`, gx + 80, gy + 1);

    const barY = gy + 18;
    for (let i = 0; i < CFG.WHIP_MAX; i++) {
      const filled = i < player.whipGauge;
      const bx = gx + i * (segW + segGap);
      // 빈칸 배경
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(bx, barY, segW, segH);
      // 채워진 칸
      if (filled) {
        const danger = player.whipGauge >= 8;
        const warm   = player.whipGauge >= 5;
        ctx.fillStyle = danger ? '#ff4757' : (warm ? '#ffb347' : '#4ae0a0');
        ctx.fillRect(bx, barY, segW, segH);
      }
    }
  }

  // HUD: 높이 표시 (우상단)
  const height = (player.stepIndex / CFG.STEPS_PER_M).toFixed(1);
  ctx.font         = 'bold 30px monospace';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle    = '#fff';
  ctx.fillText(`${height}m`, W - 20, 20);
  ctx.font      = '13px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(`${player.stepIndex} / ${steps.length - 1} 계단`, W - 20, 58);

  // 키 안내 (좌하단) — 표류 중엔 좌우 키만 표시
  ctx.font         = '13px monospace';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  if (player.phase === 'drifting') {
    ctx.fillStyle = 'rgba(255,180,60,0.85)';
    ctx.fillText('A / ←  왼쪽    D / →  오른쪽  (계단 위로!)', 16, H - 10);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('A / ←  좌 1칸    D / →  우 1칸', 16, H - 28);
    ctx.fillText('Q / Z  좌 점프   E / X  우 점프', 16, H - 10);
  }

  // --- 추락 잠금 오버레이 ---
  if (player.phase === 'falling_locked') {
    const elapsed   = CFG.FALL_LOCK_MS - Math.max(player.fallLockEndsAt - Date.now(), 0);
    const remaining = Math.max(player.fallLockEndsAt - Date.now(), 0);
    const alpha     = Math.min(elapsed / 180, remaining / 180, 1);
    ctx.fillStyle   = `rgba(0,0,0,${alpha * 0.5})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = alpha;
    ctx.font         = 'bold 72px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ff4757';
    ctx.fillText('추락!', W / 2, H / 2);
    ctx.globalAlpha  = 1;
  }

  // --- 표류 중: 착지 카운트다운 ---
  if (player.phase === 'drifting') {
    const remaining = Math.max(player.driftEndsAt - Date.now(), 0);
    const secs      = (remaining / 1000).toFixed(1);
    const urgent    = remaining < 2000;
    ctx.font         = 'bold 22px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = urgent ? '#ff4757' : '#ffb347';
    ctx.fillText(`착지까지  ${secs}s`, 16, 20);
    // 타이머 바
    const barW = 180;
    const pct  = remaining / (CFG.DRIFT_SECONDS * 1000);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(16, 52, barW, 8);
    ctx.fillStyle = urgent ? '#ff4757' : '#ffb347';
    ctx.fillRect(16, 52, barW * pct, 8);
  }

  // --- 채찍 발동 플래시 ---
  if (player.whipFlashAt > 0) {
    const elapsed = Date.now() - player.whipFlashAt;
    if (elapsed < 500) {
      const progress = elapsed / 500;
      ctx.fillStyle = `rgba(255, 200, 0, ${(1 - progress) * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha  = 1 - progress;
      ctx.font         = 'bold 64px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = '#ffd700';
      ctx.fillText('채찍!', W / 2, H / 2 - 60);
      ctx.globalAlpha  = 1;
    }
  }

  // --- 퀴즈 타이머 바 (화면 상단 4px) ---
  if (!state.quiz.active && state.quiz.questions.length > 0 && state.quiz.nextAt > 0) {
    const rem = Math.max(state.quiz.nextAt - Date.now(), 0);
    const pct = rem / CFG.QUIZ_INTERVAL_MS;
    ctx.fillStyle = 'rgba(255,215,0,0.12)';
    ctx.fillRect(0, 0, W, 4);
    ctx.fillStyle = pct < 0.2 ? '#ff4757' : '#ffd700';
    ctx.fillRect(0, 0, W * pct, 4);
  }

  // --- 클리어 ---
  if (player.phase === 'normal' && player.stepIndex === steps.length - 1) {
    ctx.font         = 'bold 52px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ffd700';
    ctx.fillText('천국 도착!', W / 2, H / 2);
  }

  // --- 퀴즈 0점 패널티 정지 ---
  const renderNow = Date.now();
  if (state.quiz.freezeUntil > renderNow) {
    const rem = ((state.quiz.freezeUntil - renderNow) / 1000).toFixed(1);
    ctx.fillStyle = 'rgba(200, 0, 0, 0.32)';
    ctx.fillRect(0, 0, W, H);
    ctx.font         = 'bold 52px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ff4757';
    ctx.fillText(`${rem}초 정지`, W / 2, H / 2 - 24);
    ctx.font      = '18px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('0개 정답 — 잠시 멈춤!', W / 2, H / 2 + 24);
  }

  // --- 게임오버 ---
  if (player.phase === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.font         = 'bold 64px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ff4757';
    ctx.fillText('게임 오버', W / 2, H / 2 - 40);
    ctx.font      = '22px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('아무 키나 누르면 다시 시작', W / 2, H / 2 + 30);
  }
}

// =============================================
// 게임 루프 — requestAnimationFrame 하나만
// =============================================
function loop() {
  const { player, steps } = state;
  const now = Date.now();

  // falling_locked → drifting 전환
  if (player.phase === 'falling_locked' && now >= player.fallLockEndsAt) {
    player.phase        = 'drifting';
    player.driftX       = steps[player.stepIndex].x;
    // 잠금 동안 낙하한 발바닥 y를 표류 시작점으로 사용
    player.driftY       = (player.fallFromY - CFG.STEP_TOP) + 50;
    player.driftStartAt = now;
    player.driftEndsAt  = now + CFG.DRIFT_SECONDS * 1000;
  }

  // 표류 중: 착지 판정 + 시간 초과
  if (player.phase === 'drifting') {
    const s        = (now - player.driftStartAt) / 1000;
    const feetY    = player.driftY + 50 * s + 15 * s * s; // 현재 발바닥 y

    for (let i = 0; i < steps.length; i++) {
      const step     = steps[i];
      const surfaceY = step.y - CFG.STEP_TOP; // 발판 윗면 y

      // 추락 시작 발판은 착지 대상에서 제외 — 표류 시작 직후 같은 발판에 즉시 복귀하는 버그 방지
      if (i === player.fallFromStepIndex) continue;

      // 발바닥이 발판 윗면(±LAND_TOL px) 에 정확히 닿을 때만 착지 인정
      if (feetY < surfaceY || feetY > surfaceY + CFG.LAND_TOL) continue;
      if (Math.abs(player.driftX - step.x) >= (CFG.STEP_W + CFG.PLAYER_W) / 2) continue;

      player.phase              = 'normal';
      player.stepIndex          = i;
      player.fallFromStepIndex  = -1;
      player.whipTickAt         = now + getWhipInterval(); // 착지 후 채찍 타이머 리셋
      break;
    }

    // 5초 초과 → 게임오버 (driftY를 현재 위치로 고정)
    if (player.phase === 'drifting' && now >= player.driftEndsAt) {
      const s2       = (now - player.driftStartAt) / 1000;
      player.driftY  = player.driftY + 50 * s2 + 15 * s2 * s2; // 최종 위치 저장
      player.phase   = 'gameover';
    }
  }

  // 퀴즈 0점 패널티 정지 종료
  if (state.quiz.freezeUntil > 0 && now >= state.quiz.freezeUntil) {
    state.quiz.freezeUntil = 0;
    state.quiz.nextAt      = now + CFG.QUIZ_INTERVAL_MS;
  }

  // 퀴즈 타이머: 문제가 있고 normal 상태에서만 발동
  if (!state.quiz.active && state.quiz.questions.length > 0 &&
      state.quiz.freezeUntil === 0 && state.quiz.nextAt > 0 &&
      player.phase === 'normal' && now >= state.quiz.nextAt) {
    startQuiz();
  }

  // 채찍 게이지: normal 상태이고 퀴즈/정지 중이 아닐 때만 누적
  if (player.phase === 'normal' && !state.quiz.active && state.quiz.freezeUntil === 0) {
    // 최초 초기화 (게임 시작 또는 재시작 직후)
    if (player.whipTickAt === 0) player.whipTickAt = now + getWhipInterval();

    if (now >= player.whipTickAt) {
      player.whipGauge++;
      player.whipTickAt = now + getWhipInterval();

      // 게이지 최대 도달: 랜덤 키 강제 발동 후 게이지 초기화
      if (player.whipGauge >= CFG.WHIP_MAX) {
        player.whipGauge   = 0;
        player.whipFlashAt = now;
        handleInput(Math.floor(Math.random() * 4));
      }
    }
  }

  // 카메라를 플레이어 위치로 부드럽게 추적 (X·Y 모두)
  state.camera.x += (getPlayerWorldX() - state.camera.x) * 0.1;
  state.camera.y += (getPlayerWorldY() - state.camera.y) * 0.1;

  render();
  requestAnimationFrame(loop);
}

loop();

// =============================================
// 퀴즈 — 엑셀 파싱 (quiz-battle-royale data.js 동일 로직)
// =============================================

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// .xlsx File 객체를 받아 문제 배열을 반환하는 Promise
function parseXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = window.XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const questions = rows.slice(1)
          .filter(r => String(r[Q_COL.NUM] || '').trim() !== '')
          .map(r => buildQuestion(r));
        resolve(questions);
      } catch (err) {
        reject(new Error('엑셀 파싱 오류: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsArrayBuffer(file);
  });
}

// 행 배열 하나를 문제 객체로 변환
function buildQuestion(r) {
  const type      = String(r[Q_COL.TYPE]   || '').trim();
  const answerRaw = String(r[Q_COL.ANSWER] || '').trim();
  const choices   = [];
  for (let i = Q_COL.OPT_START; i < r.length; i++) {
    const c = String(r[i] || '').trim();
    if (c) choices.push(c);
  }
  const q = {
    num     : String(r[Q_COL.NUM]     || '').trim(),
    type,
    content : String(r[Q_COL.CONTENT] || '').trim(),
    imageUrl: String(r[Q_COL.IMAGE]   || '').trim(),
    rawAnswer: answerRaw,
    choices,
  };
  switch (type) {
    case '단답형':
      q.answers = answerRaw.split('|').map(a => a.trim());
      break;
    case '선잇기':
      q.matchPairs = answerRaw.split('|').map(seg => {
        const [l, rv] = seg.split(':').map(s => s.trim());
        return { left: l, right: rv };
      }).filter(p => p.left && p.right);
      break;
    case '복수정답':
      q.correctIndices = answerRaw.split(',')
        .map(s => parseInt(s.trim()) - 1).filter(n => !isNaN(n));
      break;
    case '순서':
      q.correctOrder = answerRaw.split(',')
        .map(s => parseInt(s.trim()) - 1).filter(n => !isNaN(n));
      break;
    case '객관식':
      q.correctChoiceText = answerRaw;
      break;
  }
  return q;
}

// =============================================
// 퀴즈 — 게임 흐름 제어
// =============================================

// 퀴즈 UI 내부 상태 (선택값 임시 보관)
const quizUI = { selected: null, multiSelected: new Set(), orderSelected: [] };

function normalize(s) {
  return String(s).replace(/\s+/g, '').toLowerCase();
}

function startQuiz() {
  const { quiz } = state;
  // 큐가 부족하면 전체 문제를 다시 셔플해서 보충
  if (quiz.queue.length < CFG.QUIZ_BATCH_SIZE) {
    quiz.queue.push(...shuffleArray([...quiz.questions]));
  }
  quiz.batch        = quiz.queue.splice(0, CFG.QUIZ_BATCH_SIZE);
  quiz.batchIdx     = 0;
  quiz.correctCount = 0;
  quiz.active       = true;
  showQuestion(quiz.batch[0]);
  document.getElementById('quizOverlay').classList.remove('hidden');
}

function showQuestion(q) {
  const { batchIdx, batch } = state.quiz;
  document.getElementById('quizProgress').textContent = `문제 ${batchIdx + 1} / ${batch.length}`;
  document.getElementById('quizType').textContent     = q.type;
  document.getElementById('quizContent').textContent  = q.content;

  const imgWrap = document.getElementById('quizImageWrap');
  if (q.imageUrl) {
    document.getElementById('quizImg').src = q.imageUrl;
    imgWrap.classList.remove('hidden');
  } else {
    imgWrap.classList.add('hidden');
  }

  // UI 상태 초기화
  quizUI.selected      = null;
  quizUI.multiSelected = new Set();
  quizUI.orderSelected = [];

  const area = document.getElementById('quizAnswerArea');
  area.innerHTML = '';
  document.getElementById('quizFeedback').textContent = '';
  const submitBtn = document.getElementById('quizSubmit');
  submitBtn.disabled = false;
  submitBtn.textContent = '제출';

  if (q.type === '단답형') {
    const input = document.createElement('input');
    input.type        = 'text';
    input.placeholder = '정답을 입력하세요';
    input.onkeydown   = (e) => { if (e.key === 'Enter') submitQuizAnswer(); };
    area.appendChild(input);
    setTimeout(() => input.focus(), 50);

  } else if (q.type === '객관식') {
    q.choices.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className   = 'choiceBtn';
      btn.textContent = `${i + 1}. ${c}`;
      btn.onclick = () => {
        area.querySelectorAll('.choiceBtn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        quizUI.selected = i;
      };
      area.appendChild(btn);
    });

  } else if (q.type === '복수정답') {
    const hint = document.createElement('p');
    hint.className   = 'quizHint';
    hint.textContent = '정답을 모두 선택하세요';
    area.appendChild(hint);
    q.choices.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className   = 'choiceBtn';
      btn.textContent = `${i + 1}. ${c}`;
      btn.onclick = () => {
        btn.classList.toggle('selected');
        if (quizUI.multiSelected.has(i)) quizUI.multiSelected.delete(i);
        else quizUI.multiSelected.add(i);
      };
      area.appendChild(btn);
    });

  } else if (q.type === '순서') {
    const hint = document.createElement('p');
    hint.className   = 'quizHint';
    hint.textContent = '올바른 순서대로 클릭하세요';
    area.appendChild(hint);
    q.choices.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className       = 'choiceBtn';
      btn.textContent     = c;
      btn.dataset.origIdx = i;
      btn.onclick = () => {
        if (quizUI.orderSelected.includes(i)) return;
        quizUI.orderSelected.push(i);
        btn.classList.add('ordered');
        btn.textContent = `${quizUI.orderSelected.length}. ${c}`;
        // 모두 선택되면 자동 제출
        if (quizUI.orderSelected.length === q.choices.length) submitQuizAnswer();
      };
      area.appendChild(btn);
    });

  } else if (q.type === '선잇기') {
    const rights = q.matchPairs.map(p => p.right);
    q.matchPairs.forEach(pair => {
      const row = document.createElement('div');
      row.className = 'matchRow';
      const leftEl = document.createElement('span');
      leftEl.className   = 'matchLeft';
      leftEl.textContent = pair.left;
      const sel = document.createElement('select');
      sel.className      = 'matchSelect';
      sel.dataset.left   = pair.left;
      const defOpt = document.createElement('option');
      defOpt.value       = '';
      defOpt.textContent = '-- 선택 --';
      sel.appendChild(defOpt);
      rights.forEach(rv => {
        const opt = document.createElement('option');
        opt.value = rv; opt.textContent = rv;
        sel.appendChild(opt);
      });
      row.appendChild(leftEl);
      row.appendChild(sel);
      area.appendChild(row);
    });
  }
}

function submitQuizAnswer() {
  const { quiz } = state;
  const q = quiz.batch[quiz.batchIdx];
  const area = document.getElementById('quizAnswerArea');
  let correct = false;

  switch (q.type) {
    case '단답형': {
      const val = (area.querySelector('input') || {}).value || '';
      correct = q.answers.some(a => normalize(a) === normalize(val));
      break;
    }
    case '객관식':
      correct = quizUI.selected !== null &&
        normalize(q.choices[quizUI.selected]) === normalize(q.correctChoiceText);
      break;
    case '복수정답': {
      const sel = [...quizUI.multiSelected].sort((a, b) => a - b);
      const ans = [...q.correctIndices].sort((a, b) => a - b);
      correct = sel.length === ans.length && sel.every((v, i) => v === ans[i]);
      break;
    }
    case '순서':
      correct = quizUI.orderSelected.length === q.correctOrder.length &&
        quizUI.orderSelected.every((v, i) => v === q.correctOrder[i]);
      break;
    case '선잇기': {
      const pairs = [];
      area.querySelectorAll('.matchSelect').forEach(s => {
        if (s.value) pairs.push({ left: s.dataset.left, right: s.value });
      });
      correct = q.matchPairs.every(cp => {
        const found = pairs.find(sp => sp.left === cp.left);
        return found && found.right === cp.right;
      });
      break;
    }
  }

  if (correct) quiz.correctCount++;

  const fb = document.getElementById('quizFeedback');
  fb.textContent = correct ? '✓ 정답!' : '✗ 오답';
  fb.style.color = correct ? '#4ae0a0' : '#ff4757';
  document.getElementById('quizSubmit').disabled = true;

  // 1.5초 후 다음 문제 또는 종료
  setTimeout(() => {
    quiz.batchIdx++;
    if (quiz.batchIdx < quiz.batch.length) {
      showQuestion(quiz.batch[quiz.batchIdx]);
    } else {
      finishQuiz();
    }
  }, 1500);
}

function finishQuiz() {
  const { quiz } = state;
  quiz.active = false;
  document.getElementById('quizOverlay').classList.add('hidden');

  const now     = Date.now();
  const correct = quiz.correctCount;

  if (correct === 0) {
    quiz.freezeUntil = now + CFG.QUIZ_FREEZE_MS;
    quiz.nextAt      = 0; // freeze 종료 후 게임 루프에서 설정
    console.log('[퀴즈] 0개 정답 → 3초 정지');
  } else {
    quiz.nextAt = now + CFG.QUIZ_INTERVAL_MS;
    if (correct === 1) console.log('[퀴즈] 1개 정답 → 무효과');
    else if (correct === 2) console.log('[퀴즈] 2개 정답 → 일반 카드 (4단계)');
    else                    console.log('[퀴즈] 3개 정답 → 고급 카드 (4단계)');
  }
}

// =============================================
// 이벤트 리스너 — 파일 업로드 / 퀴즈 제출
// =============================================

document.getElementById('xlsxInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('uploadStatus');
  statusEl.textContent = '파싱 중...';
  try {
    const questions = await parseXlsx(file);
    state.quiz.questions = questions;
    state.quiz.queue     = shuffleArray([...questions]);
    state.quiz.nextAt    = Date.now() + CFG.QUIZ_INTERVAL_MS;
    statusEl.textContent = `✓ ${questions.length}문제 로드됨`;
    console.log('[퀴즈] 로드 완료:', questions.length, '문제');
  } catch (err) {
    statusEl.textContent = '오류: ' + err.message;
    console.error('[퀴즈] 파싱 오류:', err);
  }
  e.target.value = ''; // 같은 파일 재업로드 허용
});

document.getElementById('quizSubmit').addEventListener('click', submitQuizAnswer);

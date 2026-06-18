'use strict';

// =============================================
// 설정값
// =============================================
const CFG = {
  SEED          : 42,
  MAP_LEN       : 30,
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
};

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

// 0=좌1칸  1=우1칸  2=좌점프  3=우점프
function generateMap(seed, length) {
  const rng = createRNG(seed);
  return Array.from({ length }, () => Math.floor(rng() * 4));
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
    stepIndex     : 0,
    phase         : 'normal',
    fallFromY     : 0,   // 추락 시작 world-y (발판 y)
    fallLockEndsAt: 0,   // 추락 잠금 종료 만료 시각
    driftX        : 0,   // 표류 x world 좌표
    driftY        : 0,   // 표류 시작 발바닥 y
    driftStartAt  : 0,   // 표류 시작 시각
    driftEndsAt   : 0,   // 표류 종료 만료 시각 (5초 후)
  },
  camera: { y: 0 },
};
state.steps = buildSteps(state.map);

console.log(`[천국의 계단] 시드=${CFG.SEED}  맵:`, state.map.join(' '));

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

  // 게임오버: 아무 입력이나 재시작
  if (player.phase === 'gameover') {
    player.phase     = 'normal';
    player.stepIndex = 0;
    state.camera.y   = 0;
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

  const expected = map[player.stepIndex];
  if (code === expected) {
    player.stepIndex++;
  } else {
    // 오답: 추락 잠금 시작
    player.phase          = 'falling_locked';
    player.fallFromY      = steps[player.stepIndex].y;
    player.fallLockEndsAt = Date.now() + CFG.FALL_LOCK_MS;
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
  const originX = W / 2;
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

  // --- 클리어 ---
  if (player.phase === 'normal' && player.stepIndex === steps.length - 1) {
    ctx.font         = 'bold 52px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ffd700';
    ctx.fillText('천국 도착!', W / 2, H / 2);
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

      // 발바닥이 발판 윗면 범위 안에 있고, x가 겹치면 착지
      if (feetY < surfaceY || feetY > surfaceY + CFG.STEP_GAP) continue;
      if (Math.abs(player.driftX - step.x) >= (CFG.STEP_W + CFG.PLAYER_W) / 2) continue;

      player.phase     = 'normal';
      player.stepIndex = i;
      break;
    }

    // 5초 초과 → 게임오버 (driftY를 현재 위치로 고정)
    if (player.phase === 'drifting' && now >= player.driftEndsAt) {
      const s2       = (now - player.driftStartAt) / 1000;
      player.driftY  = player.driftY + 50 * s2 + 15 * s2 * s2; // 최종 위치 저장
      player.phase   = 'gameover';
    }
  }

  // 카메라를 현재 플레이어 발바닥 y로 부드럽게 추적
  state.camera.y += (getPlayerWorldY() - state.camera.y) * 0.1;

  render();
  requestAnimationFrame(loop);
}

loop();

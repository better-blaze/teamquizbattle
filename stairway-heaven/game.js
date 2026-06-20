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
  FALL_V0         : 500,   // 표류 초기 하강 속도 (px/s)
  FALL_ACCEL      : 150,   // 표류 가속도 계수 (px/s²)
  FALL_LOCK_DROP  : 500,   // 추락 잠금 동안 낙하 거리 (px)
  REVIVE_MS       : 1000,  // 부활 메시지 표시 및 입력 정지 시간 (ms)
  ITEM_DURATION_MS      : 30000, // 아이템 지속 시간 (30초)
  SEDATIVE_MULTIPLIER   : 2.5,   // 진정제 발동 중 채찍 게이지 간격 배율
  CARROT_MULTIPLIER     : 1.5,   // 당근 발동 중 채찍 게이지 간격 배율
  CARROT_MS             : 20000, // 당근 지속 시간 (ms)
  FIREWORK_MS           : 20000, // 폭죽 지속 시간 (ms)
  FIREWORK_COUNT        : 14,    // 계단당 파티클 수
  FIREWORK_LIFETIME     : 0.75,  // 파티클 최대 수명 (초)
  PARACHUTE_FALL_V0     : 90,    // 낙하산 발동 중 표류 초기 하강 속도 (px/s)
  PARACHUTE_FALL_ACCEL  : 25,    // 낙하산 발동 중 표류 가속도 (px/s²)
  PARACHUTE_LOCK_DROP   : 120,   // 낙하산 발동 중 추락 잠금 낙하 거리 (px)
  ELEVATOR_ANIM_MS      : 700,   // 엘리베이터 상승 카메라 애니메이션 시간 (ms)
  AUTOPILOT_MS          : 10000, // 자율주행 지속 시간 (ms)
  AUTOPILOT_STEP_MS     : 120,   // 자율주행 1스텝 입력 간격 (ms)
  // ── 저주 계열 ───────────────────────────────
  CURSE_CONFIRM_MS  : 5000,  // "저주를 거시겠습니까?" 확인 창 제한 시간 (ms)
  CURSE_COUNTDOWN_S : 3,     // "저주가 시작됩니다." 카운트다운 초 수
  CURSE_MIRROR_MS   : 3000,  // 거울의 저주 지속 시간 (ms)
  CURSE_DARK_MS     : 6000,  // 암흑의 저주 지속 시간 (ms)
  CURSE_DARK_PERIOD : 300,   // 암흑의 저주 — 어두운 시간 (ms) ← 나중에 여기서 조정
  CURSE_LIGHT_PERIOD: 400,   // 암흑의 저주 — 밝은 시간 (ms)
  CURSE_MERCY_MS    : 3000,  // "자비를 베푸셨습니다" 메시지 표시 시간 (ms)
};

// false로 바꾸면 디버그 패널 완전히 숨김
const DEBUG = true;

// 엑셀 컬럼 인덱스 (quiz-battle-royale와 동일 양식)
const Q_COL = { NUM: 0, TYPE: 1, CONTENT: 2, IMAGE: 3, ANSWER: 4, OPT_START: 5 };

// =============================================
// 아이템 목록 — 4단계 카드 추첨 시 이 배열에서 무작위 선택
// 확률 가중치를 직접 조정하려면 여기서 수정
// =============================================
const ITEM_POOL = {
  고급: [
    { id: '낙하산',      weight: 1 },
    { id: '낙하산2개',   weight: 1 },
    { id: '낙하산3개',   weight: 1 },
    { id: '진정제',      weight: 1 },
    { id: '엘리베이터',  weight: 1 },
    { id: '친구따라강남', weight: 1 },
    { id: '꽝_고급',     weight: 1 },
    { id: '자율주행',    weight: 1 },
  ],
  일반: [
    { id: '사다리',      weight: 1 },
    { id: '당근',        weight: 1 },
    { id: '꽝',          weight: 2 },   // 꽝이 더 자주 나오도록 기본값 2
    { id: '폭죽',        weight: 1 },
    { id: '거울의 저주', weight: 0.5 }, // 저주 계열 — 낮은 확률
    { id: '암흑의 저주', weight: 0.5 }, // 저주 계열 — 낮은 확률
  ],
};

// 충전식 아이템 — id별 사용 횟수와 유효시간 (이 목록에 없으면 시간제 아이템)
const ITEM_CHARGES = {
  '낙하산'   : { charges: 1, durationMs: 30000 },
  '낙하산2개': { charges: 2, durationMs: 45000 },
  '낙하산3개': { charges: 3, durationMs: 60000 },
};

// =============================================
// 아이템 효과 핸들러 — 4단계에서 하나씩 구현
// 디버그 패널과 카드 UI 모두 useItem()을 통해 발동
// =============================================
const ITEM_HANDLERS = {
  '낙하산'     : () => { activateItem('낙하산'); },
  '낙하산2개'  : () => { activateItem('낙하산2개'); },
  '낙하산3개'  : () => { activateItem('낙하산3개'); },
  '진정제'     : () => { activateItem('진정제'); },
  '엘리베이터' : () => { teleportUp(5); },
  '친구따라강남': () => { showFriendFollowOverlay(); },
  '꽝_고급'    : () => { console.log('[아이템] 꽝(고급) — 무효과'); },
  '자율주행'   : () => { activateItem('자율주행', CFG.AUTOPILOT_MS); },
  '사다리'     : () => { teleportUp(1); },
  '당근'       : () => { activateItem('당근', CFG.CARROT_MS); },
  '꽝'         : () => { console.log('[아이템] 꽝 — 무효과'); },
  '폭죽'       : () => { activateItem('폭죽', CFG.FIREWORK_MS); },
  '거울의 저주': () => { startCurseConfirm('거울의 저주'); },
  '암흑의 저주': () => { startCurseConfirm('암흑의 저주'); },
};

// 아이템 발동 진입점 — 디버그 패널·카드 UI 모두 이 함수 하나를 호출
function useItem(id) {
  const handler = ITEM_HANDLERS[id];
  if (handler) {
    handler();
  } else {
    console.warn('[아이템] 알 수 없는 아이템:', id);
  }
}

// 현재 보유한 아이템이 활성 상태인지 확인 (충전식: 잔여 횟수 > 0, 시간제: 만료 전)
function isItemActive() {
  const item = state.player.activeItem;
  if (!item) return false;
  if (item.endsAt !== undefined && item.endsAt <= Date.now()) return false; // 유효시간 초과
  if (item.charges !== undefined) return item.charges > 0;
  return true;
}

// 아이템 활성화 — 충전식(낙하산류)은 횟수로, 나머지는 시간으로 관리
// durationMs: 시간제 아이템의 지속 시간 (기본값 CFG.ITEM_DURATION_MS = 30초)
// 이미 활성 아이템이 있으면 교체 여부를 물어봄 (중첩 불가)
function activateItem(id, durationMs = CFG.ITEM_DURATION_MS) {
  const now = Date.now();
  if (isItemActive()) {
    const cur = state.player.activeItem;
    let curLabel;
    if (cur.charges !== undefined) {
      const remSec = Math.ceil(Math.max(cur.endsAt - now, 0) / 1000);
      curLabel = `'낙하산' (${cur.charges}회, ${remSec}초 남음)`;
    } else {
      curLabel = `'${cur.id}' (${Math.ceil((cur.endsAt - now) / 1000)}초 남음)`;
    }
    const ok = confirm(`${curLabel} 효과가 남아있습니다.\n'${id}'(으)로 교체하시겠습니까?`);
    if (!ok) return;
  }
  const chargeInfo = ITEM_CHARGES[id];
  if (chargeInfo !== undefined) {
    // 충전식 — 낙하 때마다 1회 소모 또는 유효시간 초과 시 자동 제거
    state.player.activeItem = { id, charges: chargeInfo.charges, endsAt: now + chargeInfo.durationMs, durationMs: chargeInfo.durationMs };
    console.log(`[아이템] ${id} 활성화 — ${chargeInfo.charges}회 / ${chargeInfo.durationMs / 1000}초`);
  } else {
    // 시간제 — durationMs 초 후 만료 (durationMs를 아이템에 저장해 HUD에서 참조)
    state.player.activeItem = { id, endsAt: now + durationMs, durationMs };
    console.log(`[아이템] ${id} 활성화 — ${durationMs / 1000}초`);
  }
}

// targetIdx 주변에서 가장 가까운 "안전한 1칸 계단"(code 0|1)을 탐색해 인덱스 반환
// minIdx 미만 및 범위 초과 계단은 제외 (현재 위치 이하로 내려가지 않도록)
function findSafeStep(targetIdx, minIdx) {
  const { steps } = state;
  for (let offset = 0; offset <= 30; offset++) {
    const candidates = offset === 0 ? [0] : [offset, -offset];
    for (const delta of candidates) {
      const idx = targetIdx + delta;
      if (idx < minIdx || idx >= steps.length) continue;
      if (steps[idx].code === 0 || steps[idx].code === 1) return idx;
    }
  }
  // 30칸 내에 안전한 계단이 없으면 targetIdx를 범위 내로 클램프
  return Math.max(minIdx, Math.min(targetIdx, steps.length - 1));
}

// 현재 높이에서 meters m 위 안전한 계단으로 상승 이동 (엘리베이터·사다리 공용)
// animMs: 카메라 상승 애니메이션 시간 (0이면 즉시 이동)
function teleportUp(meters, animMs = CFG.ELEVATOR_ANIM_MS) {
  const { player, steps } = state;
  if (player.phase !== 'normal') return;

  const fromX = getPlayerWorldX();
  const fromY = getPlayerWorldY();

  const targetIdx = Math.min(
    player.stepIndex + Math.round(meters * CFG.STEPS_PER_M),
    steps.length - 1
  );
  const destIdx = findSafeStep(targetIdx, player.stepIndex + 1);
  const toX = steps[destIdx].x;
  const toY = steps[destIdx].y - CFG.STEP_TOP;

  // stepIndex는 즉시 이동 (게임 로직 기준)
  player.stepIndex = destIdx;

  if (animMs > 0) {
    // 상승 애니메이션: getPlayerWorldX/Y가 보간값을 반환 → 카메라가 따라 올라감
    player.elevating = { fromX, fromY, toX, toY, startAt: Date.now(), durationMs: animMs };
  } else {
    // 즉시 이동
    state.camera.x = toX;
    state.camera.y = toY;
  }

  player.teleportFlashAt    = Date.now();
  player.teleportFlashLabel = `↑ ${meters}m`;

  console.log(`[순간이동] +${meters}m → 계단 ${destIdx}번 (${(destIdx / CFG.STEPS_PER_M).toFixed(1)}m)`);
}

// 절대 높이(m)로 순간이동 — 친구따라강남 전용 (6단계에서 대상 플레이어 높이를 인수로 받음)
function teleportToHeight(heightM) {
  const { player, steps } = state;
  if (player.phase !== 'normal') return;

  const fromX    = getPlayerWorldX();
  const fromY    = getPlayerWorldY();
  const targetIdx = Math.min(Math.round(heightM * CFG.STEPS_PER_M), steps.length - 1);
  const destIdx   = findSafeStep(targetIdx, player.stepIndex + 1);
  const toX = steps[destIdx].x;
  const toY = steps[destIdx].y - CFG.STEP_TOP;

  player.stepIndex          = destIdx;
  player.elevating          = { fromX, fromY, toX, toY, startAt: Date.now(), durationMs: CFG.ELEVATOR_ANIM_MS };
  player.teleportFlashAt    = Date.now();
  player.teleportFlashLabel = `↑ ${(destIdx / CFG.STEPS_PER_M).toFixed(1)}m`;

  console.log(`[친구따라강남] ${heightM}m 지정 → 계단 ${destIdx}번 (${(destIdx / CFG.STEPS_PER_M).toFixed(1)}m)`);
}

// 친구따라강남 오버레이 표시 / 숨김
// 6단계에서 showFriendFollowOverlay는 대상 플레이어 이름을 받아 표시하도록 수정 예정
function showFriendFollowOverlay() {
  if (state.player.phase !== 'normal') return;
  state.friendFollow.active = true;
  const currentH = (state.player.stepIndex / CFG.STEPS_PER_M).toFixed(1);
  const input = document.getElementById('friendFollowInput');
  input.value       = '';
  input.placeholder = `현재 ${currentH}m 이상 입력`;
  document.getElementById('friendFollowOverlay').classList.remove('hidden');
  setTimeout(() => input.focus(), 50);
}

function hideFriendFollowOverlay() {
  state.friendFollow.active = false;
  document.getElementById('friendFollowOverlay').classList.add('hidden');
}

// =============================================
// 폭죽 파티클
// =============================================

const FIREWORK_COLORS = ['#ff4757', '#ffd700', '#4ae0a0', '#4a9eff', '#ff6b81', '#b06eff', '#ff9f43', '#fff'];

// 월드 좌표 (worldX, worldY)에서 폭죽 파티클 생성
function spawnFirework(worldX, worldY) {
  const n = CFG.FIREWORK_COUNT;
  for (let i = 0; i < n; i++) {
    const angle    = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    const speed    = 55 + Math.random() * 75; // px/s
    const lifetime = CFG.FIREWORK_LIFETIME * (0.7 + Math.random() * 0.6);
    state.fireworks.push({
      worldX, worldY,
      vx       : Math.cos(angle) * speed,
      vy       : Math.sin(angle) * speed,
      color    : FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
      spawnedAt: Date.now(),
      lifetime,
    });
  }
}

// =============================================
// 저주 계열 — 4단계는 자기 화면에 적용 (6단계에서 대상을 연결)
// =============================================

// 현재 저주 프로세스(확인·카운트다운·효과)가 진행 중인지
function isCurseInProgress() {
  const c = state.curse;
  return c.confirmActive || c.countdownActive || c.active !== null;
}

// 저주 확인 창 표시 — 이미 진행 중이면 대기열에 추가
function startCurseConfirm(itemId) {
  if (isCurseInProgress()) {
    state.curse.queue.push(itemId);
    console.log(`[저주] ${itemId} 대기열 추가 (대기: ${state.curse.queue.length}개)`);
    return;
  }
  state.curse.confirmActive = true;
  state.curse.confirmItem   = itemId;
  state.curse.confirmEndsAt = Date.now() + CFG.CURSE_CONFIRM_MS;

  document.getElementById('curseConfirmName').textContent = itemId;
  document.getElementById('curseConfirmOverlay').classList.remove('hidden');
  console.log(`[저주] ${itemId} 확인 창 표시 (${CFG.CURSE_CONFIRM_MS / 1000}초 제한)`);
}

// "예" 선택 — 카운트다운 시작
function commitCurse() {
  const itemId = state.curse.confirmItem;
  state.curse.confirmActive = false;
  document.getElementById('curseConfirmOverlay').classList.add('hidden');

  state.curse.countdownActive = true;
  state.curse.countdownItem   = itemId;
  state.curse.countdownUntil  = Date.now() + CFG.CURSE_COUNTDOWN_S * 1000;
  console.log(`[저주] ${itemId} 카운트다운 시작`);
}

// "아니요" 선택 또는 시간 초과 — 자비 메시지 표시
function cancelCurse() {
  state.curse.confirmActive = false;
  document.getElementById('curseConfirmOverlay').classList.add('hidden');

  state.curse.mercyAt   = Date.now();
  // 6단계에서 state.curse.mercyName에 실제 플레이어 이름을 설정
  console.log(`[저주] 취소 → ${state.curse.mercyName}님이 자비를 베푸셨습니다.`);

  // 큐에 다음 저주가 있으면 자비 메시지 후 처리
  if (state.curse.queue.length > 0) {
    setTimeout(processNextCurse, CFG.CURSE_MERCY_MS + 300);
  }
}

// 카운트다운 종료 → 실제 효과 발동
function activateCurseEffect(itemId) {
  state.curse.countdownActive = false;
  const duration = itemId === '거울의 저주' ? CFG.CURSE_MIRROR_MS : CFG.CURSE_DARK_MS;
  state.curse.active = { id: itemId, startAt: Date.now(), endsAt: Date.now() + duration };
  console.log(`[저주] ${itemId} 효과 발동 (${duration / 1000}초)`);
}

// 효과 종료 후 대기열의 다음 저주를 처리
function processNextCurse() {
  if (state.curse.queue.length > 0) {
    const nextId = state.curse.queue.shift();
    startCurseConfirm(nextId);
  }
}

// 디버그 패널 전용: 높이 입력 후 즉시 이동 테스트
function debugFriendFollow() {
  const h = parseFloat(document.getElementById('debugFriendHeight').value);
  if (isNaN(h) || h <= 0) return;
  teleportToHeight(h);
}

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

// 낙하산이 현재 펼쳐져 있는지 (이번 낙하에 실제 발동 중)
function hasParachute() {
  return state.player.parachuteDeployed;
}

// activeItem이 낙하산류(충전식)인지 확인
function isParachuteItem(id) {
  return id in ITEM_CHARGES;
}

// 추락 잠금 동안 낙하할 거리 (낙하산 여부 반영)
function calcLockDrop() {
  return hasParachute() ? CFG.PARACHUTE_LOCK_DROP : CFG.FALL_LOCK_DROP;
}

// 표류 경과 시간 s(초)에 따른 발바닥 world-y (낙하산 여부 반영)
// player.driftY 기준 상대 좌표
function calcDriftY(s) {
  const v0    = hasParachute() ? CFG.PARACHUTE_FALL_V0    : CFG.FALL_V0;
  const accel = hasParachute() ? CFG.PARACHUTE_FALL_ACCEL : CFG.FALL_ACCEL;
  return state.player.driftY + v0 * s + accel * s * s;
}

// 현재 높이(m)에 따른 채찍 무입력 허용 간격 (ms)
// 0m → 2000ms, 500m → 200ms 선형 감소, 200ms 하한
// 진정제·당근 발동 중에는 각 배율만큼 간격이 늘어남 (게이지가 천천히 참)
function getWhipInterval() {
  const height = state.player.stepIndex / CFG.STEPS_PER_M;
  const t      = Math.min(height / CFG.WHIP_HEIGHT_MAX, 1);
  const base   = CFG.WHIP_N_START - (CFG.WHIP_N_START - CFG.WHIP_N_END) * t;
  const item   = state.player.activeItem;
  if (item && item.endsAt > Date.now()) {
    if (item.id === '진정제') return base * CFG.SEDATIVE_MULTIPLIER;
    if (item.id === '당근')   return base * CFG.CARROT_MULTIPLIER;
  }
  return base;
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
    reviveEndsAt      : 0,   // 부활 연출 종료 만료 시각 (0 = 비활성)
    pendingCard       : null, // 보유 중인 카드: null | 'normal' | 'premium' (4단계에서 사용)
    cardNotifyAt      : 0,   // 카드 획득 알림 표시 시작 시각
    activeItem          : null,  // 활성 아이템: null | { id, charges } | { id, endsAt }
    parachuteDeployed   : false, // 현재 낙하 중 낙하산이 펼쳐진 상태인지 (착지/게임오버 시 false로 리셋)
    teleportFlashAt     : 0,    // 순간이동 플래시 시작 시각 (0 = 비활성)
    teleportFlashLabel  : '',   // 순간이동 플래시 텍스트
    elevating           : null, // 엘리베이터 상승 애니메이션: null | { fromX, fromY, toX, toY, startAt, durationMs }
    autoInputAt         : 0,   // 자율주행 다음 자동 입력 만료 시각 (0 = 비활성)
  },
  camera: { x: 0, y: 0 },
  fireworks   : [], // 폭죽 파티클 배열: [{ worldX, worldY, vx, vy, color, spawnedAt, lifetime }]
  friendFollow: { active: false }, // 친구따라강남 오버레이 활성 여부
  curse: {
    confirmActive  : false,  // "저주를 거시겠습니까?" 확인 창 활성
    confirmItem    : '',     // 확인 중인 저주 아이템 id
    confirmEndsAt  : 0,      // 확인 창 자동 취소 만료 시각
    countdownActive: false,  // "저주가 시작됩니다." 카운트다운 활성
    countdownItem  : '',     // 카운트다운 중인 저주 아이템 id
    countdownUntil : 0,      // 카운트다운 종료 만료 시각
    active         : null,   // 진행 중인 저주: null | { id, startAt, endsAt }
    queue          : [],     // 대기 중인 저주 id 배열 (순차 처리)
    mercyAt        : 0,      // "자비를 베푸셨습니다" 메시지 시작 시각 (0 = 비활성)
    mercyName      : '나',   // 자비를 베푼 플레이어 이름 (6단계에서 실제 이름으로 교체)
  },
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
// easeOutCubic: 처음엔 빠르게, 끝에서 부드럽게 감속
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function getPlayerWorldY() {
  const { player, steps } = state;

  // 엘리베이터 상승 중: 출발지 → 목적지 Y를 보간해 시각적 위치 반환
  if (player.elevating) {
    const t     = Math.min((Date.now() - player.elevating.startAt) / player.elevating.durationMs, 1);
    const eased = easeOutCubic(t);
    return player.elevating.fromY + (player.elevating.toY - player.elevating.fromY) * eased;
  }

  if (player.phase === 'normal' || player.phase === 'reviving') {
    return steps[player.stepIndex].y - CFG.STEP_TOP; // 발판 윗면
  }
  if (player.phase === 'falling_locked') {
    const elapsed = CFG.FALL_LOCK_MS - Math.max(player.fallLockEndsAt - Date.now(), 0);
    const t = elapsed / CFG.FALL_LOCK_MS;
    return (player.fallFromY - CFG.STEP_TOP) + t * calcLockDrop();
  }
  if (player.phase === 'drifting') {
    const s = (Date.now() - player.driftStartAt) / 1000;
    return calcDriftY(s);
  }
  // gameover: driftY에 최종 위치가 저장돼 있음
  return player.driftY;
}

// 플레이어 x world 좌표 (표류/게임오버엔 driftX 사용)
function getPlayerWorldX() {
  const { player, steps } = state;
  // 엘리베이터 상승 중: X도 보간
  if (player.elevating) {
    const t     = Math.min((Date.now() - player.elevating.startAt) / player.elevating.durationMs, 1);
    const eased = easeOutCubic(t);
    return player.elevating.fromX + (player.elevating.toX - player.elevating.fromX) * eased;
  }
  if (player.phase === 'drifting' || player.phase === 'gameover') return player.driftX;
  return steps[player.stepIndex].x;
}

// =============================================
// 입력 처리 — 키보드/터치 버튼 공용
// code: 0=좌1칸  1=우1칸  2=좌점프  3=우점프
// =============================================
function handleInput(code) {
  const { player, steps, map } = state;

  // 퀴즈 / 0점 패널티 / 부활 연출 / 엘리베이터 / 친구따라강남 오버레이 중 — 모든 입력 차단
  if (state.quiz.active) return;
  if (state.quiz.freezeUntil > Date.now()) return;
  if (player.phase === 'reviving') return;
  if (player.elevating) return;
  if (state.friendFollow.active) return;

  // 게임오버: 아무 입력이나 재시작
  if (player.phase === 'gameover') {
    player.phase             = 'normal';
    player.stepIndex         = 0;
    player.fallFromStepIndex = -1;
    player.whipGauge         = 0;
    player.whipTickAt        = 0;
    player.whipFlashAt       = 0;
    player.reviveEndsAt      = 0;
    state.camera.x           = 0;
    state.camera.y           = 0;
    player.pendingCard        = null;
    player.cardNotifyAt       = 0;
    player.activeItem         = null;
    player.parachuteDeployed  = false;
    player.teleportFlashAt    = 0;
    player.teleportFlashLabel = '';
    player.elevating          = null;
    player.autoInputAt        = 0;
    state.fireworks           = [];
    state.friendFollow.active = false;
    hideFriendFollowOverlay();
    // 저주 상태 완전 초기화
    state.curse.confirmActive   = false;
    state.curse.countdownActive = false;
    state.curse.active          = null;
    state.curse.queue           = [];
    state.curse.mercyAt         = 0;
    document.getElementById('curseConfirmOverlay').classList.add('hidden');
    state.quiz.active         = false;
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
    // 폭죽 아이템 활성 시 올라선 계단에서 파티클 발생
    if (player.activeItem?.id === '폭죽' && isItemActive()) {
      spawnFirework(steps[player.stepIndex].x, steps[player.stepIndex].y - CFG.STEP_TOP);
    }
  } else {
    // 오답: 추락 잠금 시작
    player.phase              = 'falling_locked';
    player.fallFromY          = steps[player.stepIndex].y;
    player.fallFromStepIndex  = player.stepIndex; // 추락 시작 발판 기록
    player.fallLockEndsAt     = Date.now() + CFG.FALL_LOCK_MS;

    // 낙하산 즉시 발동 — falling_locked 단계부터 느린 낙하 적용
    const item = player.activeItem;
    if (item && isParachuteItem(item.id) && item.charges > 0) {
      player.parachuteDeployed = true;
      item.charges--;
      const remaining = item.charges;
      if (remaining <= 0) player.activeItem = null;
      console.log(`[낙하산] 발동! 잔여 ${remaining}회`);
    }
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

  // 거울의 저주: 캔버스 전체를 좌우반전 (게임 콘텐츠 + HUD 포함)
  const isMirror = state.curse.active?.id === '거울의 저주';
  if (isMirror) { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); }

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

  const isDriftingWithChute = player.phase === 'drifting' && hasParachute();
  const PLAYER_COLOR = {
    normal        : '#ff4757',
    falling_locked: '#888',
    drifting      : isDriftingWithChute ? '#b06eff' : '#ffb347',
    gameover      : '#666',
  };
  ctx.fillStyle = PLAYER_COLOR[player.phase] || '#ff4757';
  ctx.fillRect(px - PW / 2, top, PW, PH);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(px - PW / 2, top, PW, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(px - 10, top + 8, 6, 6);
  ctx.fillRect(px + 4,  top + 8, 6, 6);

  // 낙하산 캐노피 — 표류 중 낙하산 활성화 시 플레이어 위에 표시
  if (isDriftingWithChute) {
    const chuteY = top - 12;
    ctx.beginPath();
    ctx.arc(px, chuteY, 22, Math.PI, 2 * Math.PI);
    ctx.fillStyle = 'rgba(176, 110, 255, 0.75)';
    ctx.fill();
    ctx.strokeStyle = '#b06eff';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(px - 22, chuteY); ctx.lineTo(px - PW / 2, top);
    ctx.moveTo(px + 22, chuteY); ctx.lineTo(px + PW / 2, top);
    ctx.stroke();
  }

  // --- 폭죽 파티클 ---
  if (state.fireworks.length > 0) {
    const renderNow2 = Date.now();
    ctx.save();
    for (const p of state.fireworks) {
      const age   = (renderNow2 - p.spawnedAt) / 1000;
      if (age > p.lifetime) continue;
      const alpha = 1 - age / p.lifetime;
      const sx    = toSx(p.worldX + p.vx * age);
      const sy    = toSy(p.worldY + p.vy * age);
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- 활성 아이템 HUD (화면 상단 중앙) ---
  if (player.activeItem) {
    const item  = player.activeItem;
    const ix    = W / 2, iy = 12;
    const barW  = 140, barH = 5;
    let label, pct;

    if (item.charges !== undefined) {
      // 충전식(낙하산): 잔여 횟수 + 총 유효시간 고정 표시, 바는 시간 기준
      const info = ITEM_CHARGES[item.id];
      const rem  = Math.max(item.endsAt - Date.now(), 0);
      label = `낙하산  x${item.charges}  ${info.durationMs / 1000}초`;
      pct   = rem / info.durationMs;
    } else {
      // 시간제: 총 지속 시간 고정 표시 + 바로 남은 비율 표현
      const totalMs = item.durationMs ?? CFG.ITEM_DURATION_MS;
      const rem     = Math.max(item.endsAt - Date.now(), 0);
      label = `${item.id}  ${totalMs / 1000}초`;
      pct   = rem / totalMs;
    }

    ctx.font         = 'bold 14px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = '#b06eff';
    ctx.fillText(label, ix, iy);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(ix - barW / 2, iy + 20, barW, barH);
    ctx.fillStyle = '#b06eff';
    ctx.fillRect(ix - barW / 2, iy + 20, barW * pct, barH);
  }

  // --- 채찍 게이지 바 (좌상단) ---
  if (player.phase === 'normal' || player.phase === 'falling_locked' || player.phase === 'reviving') {
    const gx = 16, gy = 16;
    const segW = 16, segH = 20, segGap = 3;

    const isSedated = (player.activeItem?.id === '진정제' || player.activeItem?.id === '당근')
                      && player.activeItem.endsAt > Date.now();

    ctx.font         = 'bold 12px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = isSedated ? '#4ae0a0' : 'rgba(255,255,255,0.5)';
    ctx.fillText('채찍 게이지', gx, gy);

    // 현재 간격 표시 (작게) — 진정제 활성 시 밝은 청록색으로 강조
    const intervalSec = (getWhipInterval() / 1000).toFixed(1);
    ctx.font      = '11px monospace';
    ctx.fillStyle = isSedated ? '#4ae0a0' : 'rgba(255,255,255,0.3)';
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

  // --- 순간이동 플래시 (엘리베이터·사다리·친구따라강남 공용) ---
  if (player.teleportFlashAt > 0) {
    const elapsed = Date.now() - player.teleportFlashAt;
    if (elapsed < 600) {
      const progress = elapsed / 600;
      ctx.fillStyle = `rgba(74, 224, 160, ${(1 - progress) * 0.3})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha  = 1 - progress;
      ctx.font         = 'bold 64px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = '#4ae0a0';
      ctx.fillText(player.teleportFlashLabel, W / 2, H / 2 - 60);
      ctx.globalAlpha  = 1;
    }
  }

  // --- 자율주행 활성 표시 ---
  if (player.activeItem?.id === '자율주행' && isItemActive()) {
    // 화면 테두리 초록 글로우
    const pulse = 0.35 + 0.15 * Math.sin(Date.now() / 200);
    ctx.strokeStyle = `rgba(74, 224, 160, ${pulse})`;
    ctx.lineWidth   = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);

    // "AUTO" 뱃지 (우상단)
    ctx.font         = 'bold 13px monospace';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = 'rgba(0,0,0,0.45)';
    ctx.fillRect(W - 68, 10, 58, 22);
    ctx.fillStyle    = '#4ae0a0';
    ctx.fillText('AUTO ▶', W - 14, 14);
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

  // --- 카드 획득 알림 (2초간 표시) ---
  if (player.cardNotifyAt > 0) {
    const elapsed  = Date.now() - player.cardNotifyAt;
    if (elapsed < 2000) {
      const alpha    = 1 - elapsed / 2000;
      const isPrem   = player.pendingCard === 'premium';
      const label    = isPrem ? '고급 카드 획득!' : '일반 카드 획득!';
      const color    = isPrem ? '#b06eff' : '#4a9eff';
      ctx.globalAlpha = alpha;
      ctx.font         = 'bold 36px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = color;
      ctx.fillText(label, W / 2, H / 2 - 80);
      ctx.globalAlpha  = 1;
    }
  }

  // --- 부활 메시지 ---
  if (player.phase === 'reviving') {
    const elapsed  = Date.now() - (player.reviveEndsAt - CFG.REVIVE_MS);
    const progress = elapsed / CFG.REVIVE_MS; // 0 → 1
    // 후반 30%에서 서서히 페이드아웃
    const alpha    = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;

    ctx.save();
    ctx.globalAlpha  = Math.max(0, alpha);
    ctx.font         = 'bold 64px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    // 외곽선 (가독성)
    ctx.strokeStyle  = 'rgba(0,0,0,0.6)';
    ctx.lineWidth    = 6;
    ctx.strokeText('부활!', W / 2, H / 2 - 60);
    ctx.fillStyle    = '#ffe066';
    ctx.fillText('부활!', W / 2, H / 2 - 60);
    ctx.restore();
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

  // 거울의 저주 transform 해제 (이후 효과는 뒤집히지 않음)
  if (isMirror) ctx.restore();

  // ── 저주 사후 효과 (mirror 해제 후 그려 반전 영향 없음) ───────────

  // 암흑의 저주: CURSE_DARK_PERIOD ms 어둡고 CURSE_LIGHT_PERIOD ms 밝음을 반복
  if (state.curse.active?.id === '암흑의 저주') {
    const elapsed = Date.now() - state.curse.active.startAt;
    const cycle   = CFG.CURSE_DARK_PERIOD + CFG.CURSE_LIGHT_PERIOD;
    if (elapsed % cycle < CFG.CURSE_DARK_PERIOD) {
      ctx.fillStyle = 'rgba(0,0,0,0.99)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // 저주 카운트다운 오버레이 ("저주가 시작됩니다. 3/2/1")
  if (state.curse.countdownActive) {
    const rem  = Math.max(state.curse.countdownUntil - Date.now(), 0);
    const secs = Math.ceil(rem / 1000);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 26px sans-serif';
    ctx.fillStyle    = '#ff4757';
    ctx.fillText('저주가 시작됩니다...', W / 2, H / 2 - 50);
    ctx.font      = 'bold 90px sans-serif';
    ctx.fillText(String(secs), W / 2, H / 2 + 30);
  }

  // "자비를 베푸셨습니다" 메시지 (페이드인 → 페이드아웃)
  if (state.curse.mercyAt > 0) {
    const elapsed = Date.now() - state.curse.mercyAt;
    const alpha   = elapsed < 400
      ? elapsed / 400
      : elapsed > CFG.CURSE_MERCY_MS - 400
        ? (CFG.CURSE_MERCY_MS - elapsed) / 400
        : 1;
    ctx.save();
    ctx.globalAlpha  = Math.max(0, alpha);
    ctx.font         = 'bold 22px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ffd700';
    ctx.fillText(`${state.curse.mercyName}님이 자비를 베푸셨습니다.`, W / 2, H / 4);
    ctx.restore();
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
    // 잠금 동안 낙하한 발바닥 y를 표류 시작점으로 사용 (낙하산 시 더 적게 낙하)
    player.driftY       = (player.fallFromY - CFG.STEP_TOP) + calcLockDrop();
    player.driftStartAt = now;
    player.driftEndsAt  = now + CFG.DRIFT_SECONDS * 1000;
  }

  // 표류 중: 착지 판정 + 시간 초과
  if (player.phase === 'drifting') {
    const s        = (now - player.driftStartAt) / 1000;
    const feetY    = calcDriftY(s);

    for (let i = 0; i < steps.length; i++) {
      const step     = steps[i];
      const surfaceY = step.y - CFG.STEP_TOP; // 발판 윗면 y

      // 추락 시작 발판은 착지 대상에서 제외 — 표류 시작 직후 같은 발판에 즉시 복귀하는 버그 방지
      if (i === player.fallFromStepIndex) continue;

      // 발바닥이 발판 윗면(±LAND_TOL px) 에 정확히 닿을 때만 착지 인정
      if (feetY < surfaceY || feetY > surfaceY + CFG.LAND_TOL) continue;
      if (Math.abs(player.driftX - step.x) >= (CFG.STEP_W + CFG.PLAYER_W) / 2) continue;

      player.phase              = 'reviving';
      player.stepIndex          = i;
      player.fallFromStepIndex  = -1;
      player.reviveEndsAt       = now + CFG.REVIVE_MS;
      player.whipTickAt         = player.reviveEndsAt + getWhipInterval(); // 부활 후 채찍 타이머 시작
      player.parachuteDeployed  = false; // 착지: 낙하산 접기
      break;
    }

    // 5초 초과 → 게임오버 (driftY를 현재 위치로 고정)
    if (player.phase === 'drifting' && now >= player.driftEndsAt) {
      const s2                 = (now - player.driftStartAt) / 1000;
      player.driftY            = calcDriftY(s2);
      player.phase             = 'gameover';
      player.parachuteDeployed = false; // 게임오버: 낙하산 접기
    }
  }

  // 부활 연출 종료 → normal 전환
  if (player.phase === 'reviving' && now >= player.reviveEndsAt) {
    player.phase        = 'normal';
    player.reviveEndsAt = 0;
  }

  // 시간제 아이템 만료 확인 (충전식 낙하산은 횟수 소모로 관리하므로 제외)
  if (player.activeItem && player.activeItem.endsAt !== undefined && player.activeItem.endsAt <= now) {
    console.log(`[아이템] ${player.activeItem.id} 만료`);
    player.activeItem = null;
  }

  // 만료된 폭죽 파티클 제거
  if (state.fireworks.length > 0) {
    state.fireworks = state.fireworks.filter(p => now - p.spawnedAt < p.lifetime * 1000);
  }

  // ── 저주 상태 머신 ──────────────────────────────
  // 확인 창 타이머 갱신 및 자동 취소
  if (state.curse.confirmActive) {
    const remaining = Math.max(state.curse.confirmEndsAt - now, 0);
    const timerEl   = document.getElementById('curseConfirmTimer');
    if (timerEl) timerEl.textContent = Math.ceil(remaining / 1000);
    if (now >= state.curse.confirmEndsAt) cancelCurse(); // 시간 초과 → 자비
  }

  // 카운트다운 종료 → 효과 발동
  if (state.curse.countdownActive && now >= state.curse.countdownUntil) {
    activateCurseEffect(state.curse.countdownItem);
  }

  // 효과 종료 → 대기열 처리
  if (state.curse.active && now >= state.curse.active.endsAt) {
    state.curse.active = null;
    processNextCurse();
  }

  // "자비" 메시지 자동 소멸
  if (state.curse.mercyAt > 0 && now - state.curse.mercyAt >= CFG.CURSE_MERCY_MS) {
    state.curse.mercyAt = 0;
  }

  // 퀴즈 0점 패널티 정지 종료
  if (state.quiz.freezeUntil > 0 && now >= state.quiz.freezeUntil) {
    state.quiz.freezeUntil = 0;
    state.quiz.nextAt      = now + CFG.QUIZ_INTERVAL_MS;
  }

  // 엘리베이터 상승 애니메이션 종료 확인
  if (player.elevating && now >= player.elevating.startAt + player.elevating.durationMs) {
    player.elevating = null;
  }

  // 퀴즈 타이머: normal 상태이고 각종 오버레이·이동 중이 아닐 때만 발동
  if (!state.quiz.active && !state.friendFollow.active &&
      state.quiz.questions.length > 0 && state.quiz.freezeUntil === 0 &&
      state.quiz.nextAt > 0 && player.phase === 'normal' &&
      !player.elevating && now >= state.quiz.nextAt) {
    startQuiz();
  }

  // 채찍 게이지: normal 상태이고 각종 오버레이·이동 중이 아닐 때만 누적
  if (player.phase === 'normal' && !player.elevating && !state.friendFollow.active &&
      !state.quiz.active && state.quiz.freezeUntil === 0) {
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

  // 자율주행: 활성 중이면 AUTOPILOT_STEP_MS 마다 올바른 키를 자동 입력
  if (player.activeItem?.id === '자율주행' && isItemActive()) {
    if (player.phase === 'normal' && !player.elevating) {
      if (player.autoInputAt === 0) player.autoInputAt = now + CFG.AUTOPILOT_STEP_MS;
      if (now >= player.autoInputAt) {
        handleInput(state.map[player.stepIndex]); // 현재 계단의 정답 키 자동 입력
        player.autoInputAt = now + CFG.AUTOPILOT_STEP_MS;
      }
    }
  } else {
    player.autoInputAt = 0; // 자율주행 비활성/만료 시 타이머 초기화
  }

  // 카메라를 플레이어 위치로 부드럽게 추적 (엘리베이터 상승 중엔 빠르게 따라감)
  const cameraLerp = player.elevating ? 0.25 : 0.1;
  state.camera.x += (getPlayerWorldX() - state.camera.x) * cameraLerp;
  state.camera.y += (getPlayerWorldY() - state.camera.y) * cameraLerp;

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
      // 정답은 1-based 보기 번호 (예: "1" → 보기 1번 → 0-based 인덱스 0)
      q.correctChoiceIdx = parseInt(answerRaw.trim()) - 1;
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
      // 선택한 버튼의 인덱스와 정답 인덱스 직접 비교
      correct = quizUI.selected !== null && quizUI.selected === q.correctChoiceIdx;
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
  } else if (correct === 1) {
    quiz.nextAt = now + CFG.QUIZ_INTERVAL_MS;
    console.log('[퀴즈] 1개 정답 → 무효과');
  } else {
    // 2개 이상 정답: 카드 획득 — 4단계에서 UI·효과 구현
    const cardType = correct >= 3 ? 'premium' : 'normal';
    state.player.pendingCard  = cardType;
    state.player.cardNotifyAt = now;
    quiz.nextAt = now + CFG.QUIZ_INTERVAL_MS;
    console.log(`[퀴즈] ${correct}개 정답 → ${cardType === 'premium' ? '고급' : '일반'} 카드 획득`);
  }
}

// =============================================
// 디버그 패널 초기화
// =============================================
{
  const toggle = document.getElementById('debugToggle');
  const panel  = document.getElementById('debugPanel');
  if (!DEBUG) {
    // DEBUG = false 면 토글 버튼 자체를 숨겨 완전히 제거
    toggle.style.display = 'none';
  } else {
    toggle.addEventListener('click', () => panel.classList.toggle('hidden'));
    window.addEventListener('keydown', (e) => {
      if (e.key === '`') panel.classList.toggle('hidden');
    });
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

// =============================================
// 친구따라강남 오버레이 이벤트
// =============================================

document.getElementById('friendFollowConfirm').addEventListener('click', () => {
  const input    = document.getElementById('friendFollowInput');
  const h        = parseFloat(input.value);
  const currentH = state.player.stepIndex / CFG.STEPS_PER_M;

  if (isNaN(h) || h <= currentH) {
    input.style.borderColor = '#ff4757';
    return;
  }
  input.style.borderColor = '';
  hideFriendFollowOverlay();
  teleportToHeight(h);
});

document.getElementById('friendFollowCancel').addEventListener('click', hideFriendFollowOverlay);

// Enter 키로도 확인 가능
document.getElementById('friendFollowInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('friendFollowConfirm').click();
});

// =============================================
// 저주 확인 창 이벤트
// =============================================

document.getElementById('curseConfirmYes').addEventListener('click', commitCurse);
document.getElementById('curseConfirmNo').addEventListener('click', cancelCurse);

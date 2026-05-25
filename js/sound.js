// =============================================
// sound.js — Web Audio API 효과음 (파일 불필요)
// =============================================

let audioCtx = null;
let muted = false;

// AudioContext를 처음 사용자 인터랙션 후에 생성 (브라우저 정책)
function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// 음소거 설정
export function setMuted(val) { muted = val; }
export function isMuted()     { return muted; }

// 내부: 단순 비프음 재생
function playTone(freq, dur, type = 'sine', vol = 0.3, delay = 0) {
  if (muted) return;
  const ctx = getCtx();
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type      = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + dur + 0.05);
}

// 정답 효과음: 밝은 3음 상승 (도-미-솔)
export function playCorrect() {
  playTone(523, 0.15, 'sine', 0.4, 0.0);   // C5
  playTone(659, 0.15, 'sine', 0.4, 0.12);  // E5
  playTone(784, 0.3,  'sine', 0.4, 0.24);  // G5
}

// 오답 효과음: 낮은 부저
export function playWrong() {
  playTone(220, 0.4,  'sawtooth', 0.35, 0.0);
  playTone(180, 0.3,  'sawtooth', 0.25, 0.15);
}

// 카운트다운 틱 (5~1초)
export function playTick() {
  playTone(880, 0.08, 'square', 0.2);
}

// 카운트다운 마지막 틱 (더 강조)
export function playTickFinal() {
  playTone(1100, 0.12, 'square', 0.35);
}

// 아이템 사용 효과음: 마법 느낌
export function playItemUse() {
  for (let i = 0; i < 5; i++) {
    playTone(440 + i * 110, 0.1, 'sine', 0.25, i * 0.07);
  }
}

// 저주 효과음: 어두운 하강
export function playCurse() {
  playTone(400, 0.2, 'sawtooth', 0.3, 0.0);
  playTone(300, 0.2, 'sawtooth', 0.3, 0.15);
  playTone(200, 0.4, 'sawtooth', 0.35, 0.3);
}

// 미스터리 카드 공개: 드라마틱
export function playMysteryReveal() {
  playTone(220, 0.1,  'sine', 0.2, 0.0);
  playTone(330, 0.1,  'sine', 0.25, 0.1);
  playTone(440, 0.1,  'sine', 0.3, 0.2);
  playTone(660, 0.1,  'sine', 0.3, 0.3);
  playTone(880, 0.4,  'sine', 0.35, 0.4);
}

// 시상식 팡파르: 1등 발표
export function playFanfare() {
  const melody = [523, 523, 523, 659, 523, 659, 784];
  melody.forEach((f, i) => playTone(f, 0.2, 'sine', 0.4, i * 0.18));
}

// 주사위 굴리는 소리
export function playDice() {
  for (let i = 0; i < 8; i++) {
    const f = 200 + Math.random() * 400;
    playTone(f, 0.05, 'square', 0.15, i * 0.06);
  }
}

// 폭발(점수 강탈) 효과음
export function playBoom() {
  playTone(100, 0.5, 'sawtooth', 0.45);
  playTone(80,  0.5, 'sawtooth', 0.3, 0.1);
}

// 꽝 효과음
export function playDud() {
  playTone(300, 0.15, 'square', 0.25);
  playTone(250, 0.3,  'square', 0.2, 0.1);
}

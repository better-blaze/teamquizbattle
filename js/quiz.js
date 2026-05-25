// =============================================
// quiz.js — 퀴즈 엔진 (정답 판정, 점수 계산, 캔버스)
// =============================================

import { GAME } from './config.js';

// =============================================
// 점수 계산
// elapsedSec: 문제 시작 후 제출까지 걸린 시간(초)
// perfTime: 만점 기준 시간(초)
// =============================================
export function calcScore(elapsedSec, perfTime) {
  const overtime = Math.max(0, elapsedSec - perfTime);
  const score    = GAME.BASE_SCORE - Math.floor(overtime);
  return Math.max(GAME.MIN_SCORE, score); // 최소 3점 보장
}

// =============================================
// 정답 판정
// =============================================

// 단답형: 공백 제거 후 소문자 비교 (복수 정답 지원)
export function checkShortAnswer(input, answers) {
  const normalized = input.replace(/\s+/g, '').toLowerCase();
  return answers.some(a => a === normalized);
}

// 객관식: 선택 번호(문자열)와 정답 번호 비교
export function checkMultipleChoice(selected, answer) {
  return String(selected).trim() === String(answer).trim();
}

// 선 잇기: 모든 페어가 올바르게 연결됐는지 확인
// userPairs: [{ left: '1', right: 'one' }, ...]
// correctPairs: [{ left: '1', right: 'one' }, ...]
export function checkMatching(userPairs, correctPairs) {
  if (userPairs.length !== correctPairs.length) return false;
  return correctPairs.every(cp =>
    userPairs.some(up => up.left === cp.left && up.right === cp.right)
  );
}

// =============================================
// 선 잇기 캔버스 관리자
// =============================================
export class MatchingCanvas {
  constructor({ canvasEl, leftColEl, rightColEl, pairs }) {
    this.canvas    = canvasEl;
    this.leftCol   = leftColEl;
    this.rightCol  = rightColEl;
    // pairs: [{ left, right }] — 정답 페어 (표시 순서는 셔플됨)
    this.correctPairs = pairs;

    // 좌우 항목 배열 (셔플)
    this.leftItems  = this._shuffle(pairs.map(p => p.left));
    this.rightItems = this._shuffle(pairs.map(p => p.right));

    // 연결 상태: { leftIdx: rightIdx }
    this.connections = {};
    // 현재 선택된 왼쪽 인덱스
    this.selectedLeft = null;

    this._buildUI();
    this._setupCanvas();
  }

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  _buildUI() {
    this.leftCol.innerHTML  = '';
    this.rightCol.innerHTML = '';

    this.leftItems.forEach((text, i) => {
      const el = document.createElement('div');
      el.className     = 'match-item';
      el.textContent   = text;
      el.dataset.index = i;
      el.addEventListener('click', () => this._onLeftClick(i));
      this.leftCol.appendChild(el);
    });

    this.rightItems.forEach((text, i) => {
      const el = document.createElement('div');
      el.className     = 'match-item';
      el.textContent   = text;
      el.dataset.index = i;
      el.addEventListener('click', () => this._onRightClick(i));
      this.rightCol.appendChild(el);
    });
  }

  _setupCanvas() {
    const resize = () => {
      const container = this.canvas.parentElement;
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      if (w > 0 && h > 0) {
        this.canvas.width  = w;
        this.canvas.height = h;
        this._draw();
      }
    };
    this._resizeObs = new ResizeObserver(resize);
    this._resizeObs.observe(this.canvas.parentElement);
    // 레이아웃 완료 후 초기 크기 설정
    requestAnimationFrame(resize);
  }

  // 왼쪽 항목 클릭
  _onLeftClick(i) {
    if (this.submitted) return;
    this.selectedLeft = (this.selectedLeft === i) ? null : i;
    this._updateItemStyles();
    this._draw();
  }

  // 오른쪽 항목 클릭
  _onRightClick(j) {
    if (this.submitted) return;
    if (this.selectedLeft === null) return;

    // 이미 오른쪽 j에 연결된 왼쪽이 있으면 기존 연결 제거
    for (const [li, ri] of Object.entries(this.connections)) {
      if (parseInt(ri) === j) delete this.connections[li];
    }

    // 새 연결 설정
    this.connections[this.selectedLeft] = j;
    this.selectedLeft = null;
    this._updateItemStyles();
    this._draw();

    // 모두 연결됐는지 확인
    if (Object.keys(this.connections).length === this.leftItems.length) {
      this.onAllConnected && this.onAllConnected();
    }
  }

  // 아이템 스타일 업데이트 (선택/연결 표시)
  _updateItemStyles() {
    const leftEls  = this.leftCol.querySelectorAll('.match-item');
    const rightEls = this.rightCol.querySelectorAll('.match-item');

    leftEls.forEach((el, i) => {
      el.classList.remove('selected', 'connected', 'wrong-conn');
      if (this.selectedLeft === i) el.classList.add('selected');
      else if (this.connections[i] !== undefined) el.classList.add('connected');
    });

    rightEls.forEach((el, j) => {
      el.classList.remove('selected', 'connected', 'wrong-conn');
      const connectedLeft = Object.entries(this.connections)
        .find(([, ri]) => parseInt(ri) === j);
      if (connectedLeft) el.classList.add('connected');
    });
  }

  // 캔버스에 선 그리기
  _draw() {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const canvasRect = this.canvas.getBoundingClientRect();
    const leftEls    = this.leftCol.querySelectorAll('.match-item');
    const rightEls   = this.rightCol.querySelectorAll('.match-item');

    // 연결된 선 그리기
    for (const [li, ri] of Object.entries(this.connections)) {
      const lEl = leftEls[parseInt(li)];
      const rEl = rightEls[parseInt(ri)];
      if (!lEl || !rEl) continue;

      const lRect = lEl.getBoundingClientRect();
      const rRect = rEl.getBoundingClientRect();

      const x1 = lRect.right  - canvasRect.left;
      const y1 = lRect.top    + lRect.height / 2 - canvasRect.top;
      const x2 = rRect.left   - canvasRect.left;
      const y2 = rRect.top    + rRect.height / 2 - canvasRect.top;

      // 정답 여부에 따라 색상 결정 (제출 후)
      let lineColor = '#6366f1'; // 기본: 보라
      if (this.submitted) {
        const isCorrect = this._isPairCorrect(parseInt(li), parseInt(ri));
        lineColor = isCorrect ? '#22c55e' : '#ef4444';
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }
  }

  // 특정 연결이 정답인지 확인
  _isPairCorrect(leftIdx, rightIdx) {
    const leftVal  = this.leftItems[leftIdx];
    const rightVal = this.rightItems[rightIdx];
    return this.correctPairs.some(p => p.left === leftVal && p.right === rightVal);
  }

  // 현재 연결을 페어 배열로 변환
  getUserPairs() {
    return Object.entries(this.connections).map(([li, ri]) => ({
      left:  this.leftItems[parseInt(li)],
      right: this.rightItems[parseInt(ri)]
    }));
  }

  // 지우개 아이템: 마지막으로 연결된 틀린 선 1개 제거
  eraseLastWrong() {
    // 연결 순서를 키 순서로 파악 (가장 마지막 인덱스부터 역순)
    const keys = Object.keys(this.connections).reverse();
    for (const li of keys) {
      const ri = this.connections[li];
      if (!this._isPairCorrect(parseInt(li), parseInt(ri))) {
        delete this.connections[li];
        this._updateItemStyles();
        this._draw();
        return true; // 제거 성공
      }
    }
    return false; // 틀린 선 없음
  }

  // 제출 처리 (정답/오답 색상으로 다시 그림)
  submit() {
    this.submitted = true;
    this._updateItemStyles();
    this._draw();
  }

  // 정리
  destroy() {
    this._resizeObs && this._resizeObs.disconnect();
  }
}

// =============================================
// items.js — 아이템 및 미스터리 카드 로직
// =============================================

import { MYSTERY_DECK_TEMPLATE, MYSTERY_INFO, ITEM_TYPES } from './config.js';
import * as Sound from './sound.js';

// =============================================
// 미스터리 카드 덱 생성 (8장 무작위 셔플)
// =============================================
export function createMysteryDeck() {
  const deck = [...MYSTERY_DECK_TEMPLATE];
  // 피셔-예이츠 셔플
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck; // ['꽝', '쉴드', '패자의 역습', ...]
}

// =============================================
// 미스터리 카드 효과 적용
// card: 카드 이름 문자열
// teams: { 1: { score, item, itemUsed, ... }, 2: ... }
// teamCount: 모둠 수
// choosingTeam: 카드를 선택한 모둠 번호
// 반환: { updates: {}, message: string }
// =============================================
export function applyMysteryCard(card, teams, teamCount, choosingTeam) {
  // 현재 점수 기준 순위 계산 (낮은 점수 = 낮은 등수)
  const ranked = Object.entries(teams)
    .map(([num, t]) => ({ num: parseInt(num), score: t.score || 0 }))
    .sort((a, b) => b.score - a.score); // 내림차순 (1등부터)

  const updates = {};
  let message    = '';
  let effectData = null; // 상황판 애니메이션용 데이터

  switch (card) {
    case '패자의 역습': {
      // 꼴등 +10, 꼴등-1 +8, 꼴등-2 +2
      const last   = ranked[ranked.length - 1];
      const second = ranked[ranked.length - 2];
      const third  = ranked[ranked.length - 3];
      if (last)   updates[`teams/${last.num}/score`]   = (last.score   + 10);
      if (second) updates[`teams/${second.num}/score`] = (second.score + 8);
      if (third)  updates[`teams/${third.num}/score`]  = (third.score  + 2);
      message = '패자의 역습! 하위 모둠에 점수가 지급됩니다 👊';
      effectData = {
        type: '패자의역습',
        gains: [
          ...(last   ? [{ team: last.num,   amount: 10 }] : []),
          ...(second ? [{ team: second.num, amount: 8  }] : []),
          ...(third  ? [{ team: third.num,  amount: 2  }] : [])
        ]
      };
      Sound.playBoom();
      break;
    }

    case '아이템 회복': {
      updates[`teams/${choosingTeam}/items/boost`]  = true;
      updates[`teams/${choosingTeam}/items/curse`]  = true;
      updates[`teams/${choosingTeam}/items/eraser`] = true;
      message = `${choosingTeam}모둠 아이템 전체 회복! 🔄`;
      effectData = { type: '아이템회복', team: choosingTeam };
      Sound.playItemUse();
      break;
    }

    case '흡수': {
      // 1등 -3, 2등 -2, 나머지 -1점 → 선택 팀에게 합산
      let stolen = 0;
      const thefts = []; // 애니메이션용 강탈 목록

      const scoreGroups = {};
      for (const t of ranked) {
        if (!scoreGroups[t.score]) scoreGroups[t.score] = [];
        scoreGroups[t.score].push(t.num);
      }
      const uniqueScores = Object.keys(scoreGroups)
        .map(Number).sort((a, b) => b - a);

      const rankPenalties = [3, 2, 1];
      for (let rank = 0; rank < uniqueScores.length; rank++) {
        const sc      = uniqueScores[rank];
        const penalty = rankPenalties[Math.min(rank, 2)];
        const group   = scoreGroups[sc];
        for (const tNum of group) {
          if (tNum === choosingTeam) continue;
          const current = teams[tNum].score || 0;
          if (current <= 0) continue;
          const take = Math.min(penalty, current);
          updates[`teams/${tNum}/score`] = current - take;
          stolen += take;
          thefts.push({ from: tNum, amount: take });
        }
      }

      const myScore = (teams[choosingTeam].score || 0) + stolen;
      updates[`teams/${choosingTeam}/score`] = myScore;
      message = `${choosingTeam}모둠이 다른 모둠에서 ${stolen}점을 강탈! 🌀`;
      effectData = { type: '흡수', thefts, to: choosingTeam, total: stolen };
      Sound.playBoom();
      break;
    }

    case '쉴드': {
      updates[`teams/${choosingTeam}/shieldActive`] = true;
      message = `${choosingTeam}모둠에 쉴드 장착! 다음 저주를 막아냅니다 🛡️`;
      effectData = { type: '쉴드', team: choosingTeam };
      Sound.playItemUse();
      break;
    }

    case '주사위 벼락': {
      const roll   = Math.floor(Math.random() * teamCount) + 1;
      const target = teams[roll];
      const hit    = !!target;
      if (hit) {
        const current = target.score || 0;
        updates[`teams/${roll}/score`] = Math.max(0, current - 10);
        message = `주사위 결과: ${roll}모둠! -10점 벼락 ⚡🎲`;
      } else {
        message = `주사위 결과: ${roll} (해당 모둠 없음 — 무효!) 🎲`;
      }
      effectData = { type: '주사위벼락', roll, targetTeam: roll, penalty: 10, hit };
      Sound.playDice();
      break;
    }

    case '꽝':
    default: {
      message = '꽝! 아무 효과 없습니다 💨';
      effectData = { type: '꽝' };
      Sound.playDud();
      break;
    }
  }

  return { updates, message, effectData };
}

// =============================================
// 아이템 적용 (클라이언트 → Firebase에 반영할 업데이트 생성)
// itemType: 'boost' | 'curse' | 'eraser'
// myTeam: 내 모둠 번호
// targetTeam: 저주 대상 모둠 번호 (저주 전용)
// =============================================
// 아이템 사용: 해당 아이템을 false(사용 완료)로 표시
export function buildItemUpdate(itemType, myTeam, targetTeam = null) {
  const updates = {};
  // 아이템 사용 표시 (items 객체에서 해당 타입을 false로)
  updates[`teams/${myTeam}/items/${itemType}`] = false;
  return updates;
}

// =============================================
// 저주 대상 선택 UI (어떤 모둠에 저주를 걸지)
// =============================================
export function showCurseTargetPicker(teams, myTeam, onSelect) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:500;
    background:rgba(0,0,0,.85);
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:16px;
    animation:fadeIn .3s;
  `;

  const title = document.createElement('p');
  title.style.cssText = 'color:#fff;font-size:1.3rem;font-weight:900;';
  title.textContent = '💀 저주 걸 모둠을 선택하세요';
  overlay.appendChild(title);

  const btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;';

  Object.entries(teams).forEach(([num, t]) => {
    if (parseInt(num) === myTeam) return; // 자기 자신 제외
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger';
    btn.style.minWidth = '100px';
    btn.textContent = `${num}모둠`;
    btn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      onSelect(parseInt(num));
    });
    btnWrap.appendChild(btn);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => document.body.removeChild(overlay));

  overlay.appendChild(btnWrap);
  overlay.appendChild(cancelBtn);
  document.body.appendChild(overlay);
}

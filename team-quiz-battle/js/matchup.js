// =============================================
// matchup.js — 대진표 로직 및 UI
// =============================================

import { GAME } from './config.js';

// =============================================
// 핵심 규칙: 모둠원 간 참전 횟수 차이 ≤ 2
// 특정 멤버를 하나 더 추가할 때 규칙을 위반하는지 확인
// counts: { '김민준': 2, '김민서': 1 }
// candidate: 추가하려는 멤버 이름
// =============================================
export function wouldViolateRule(counts, candidate) {
  // 후보 멤버를 1회 추가했을 때의 카운트 계산
  const futureCounts = { ...counts };
  futureCounts[candidate] = (futureCounts[candidate] || 0) + 1;

  const values = Object.values(futureCounts);
  const maxC   = Math.max(...values);
  const minC   = Math.min(...values);

  return (maxC - minC) > GAME.MAX_PARTICIPATION_DIFF;
}

// 현재 대진표에서 각 멤버의 참전 횟수 계산
// matchup: { qIndex: memberName | null }
export function countParticipation(matchup, members) {
  const counts = {};
  for (const m of members) counts[m] = 0;
  for (const name of Object.values(matchup)) {
    if (name && counts[name] !== undefined) counts[name]++;
  }
  return counts;
}

// =============================================
// 빈 슬롯 자동 채우기 (대진표 마감 시)
// questions: 전체 문제 배열
// members: 해당 모둠 학생 이름 배열
// matchup: 현재 대진표 { qIndex: name | null }
// =============================================
export function autoFillMatchup(questions, members, matchup) {
  const filled = { ...matchup };

  for (let i = 0; i < questions.length; i++) {
    const key = String(i);
    if (filled[key]) continue; // 이미 배정된 경우 건너뜀

    // 현재 카운트 기준 참전 가능한 멤버 찾기
    const counts = countParticipation(filled, members);
    const minCount = Math.min(...members.map(m => counts[m]));

    // 가장 적게 참전한 멤버 중 규칙을 어기지 않는 사람 선택
    const eligible = members.filter(m => {
      return counts[m] === minCount && !wouldViolateRule(counts, m);
    });

    if (eligible.length === 0) {
      // 규칙 범위 내 아무나 (마지막 수단)
      const any = members.find(m => !wouldViolateRule(counts, m));
      filled[key] = any || members[i % members.length];
    } else {
      // 적격자 중 무작위 선택
      filled[key] = eligible[Math.floor(Math.random() * eligible.length)];
    }
  }

  return filled;
}

// =============================================
// 대진표 UI 렌더링 (클라이언트 뷰)
// =============================================
export function renderMatchupGrid({
  container,   // .cs-matchup-grid 엘리먼트
  questions,   // 전체 문제 배열
  matchup,     // 현재 이 팀의 대진표 { qIndex: name }
  selectedIdx, // 현재 선택된 행 인덱스 (null 가능)
  onSelect     // 행 클릭 콜백 (qIndex) => {}
}) {
  container.innerHTML = '';

  questions.forEach((q, i) => {
    const row = document.createElement('div');
    row.className = 'matchup-row' + (selectedIdx === i ? ' selected' : '');

    const numEl  = document.createElement('span');
    numEl.className = 'matchup-row-num';
    numEl.textContent = `Q${q.num}`;

    const typeEl = document.createElement('span');
    typeEl.className = 'matchup-row-type';
    typeEl.textContent = q.type;

    const nameEl = document.createElement('span');
    const assigned = matchup[String(i)];
    nameEl.className = 'matchup-row-name' + (assigned ? '' : ' empty');
    nameEl.textContent = assigned || '미정';

    const diffEl = document.createElement('span');
    diffEl.style.cssText = 'font-size:.7rem;color:var(--c-sub);';
    diffEl.textContent = q.difficulty;

    row.append(numEl, typeEl, nameEl, diffEl);
    row.addEventListener('click', () => onSelect(i));
    container.appendChild(row);
  });
}

// =============================================
// 멤버 버튼 렌더링
// =============================================
export function renderMemberButtons({
  container,    // .cs-member-buttons 엘리먼트
  members,      // 멤버 이름 배열
  counts,       // 현재 참전 횟수 { name: count }
  onAssign      // 클릭 콜백 (memberName) => {}
}) {
  container.innerHTML = '';

  for (const name of members) {
    const btn = document.createElement('button');
    btn.className = 'member-btn';
    btn.textContent = `${name} (${counts[name] || 0}회)`;

    // 이 멤버를 선택하면 규칙 위반인지 미리 계산
    const willViolate = wouldViolateRule(counts, name);
    if (willViolate) {
      btn.classList.add('invalid');
      btn.disabled = true;
      btn.title = '이 학생을 배정하면 참전 균형이 깨집니다';
    } else {
      btn.addEventListener('click', () => onAssign(name));
    }
    container.appendChild(btn);
  }
}

// =============================================
// 관리자용 대진표 테이블 렌더링
// =============================================
export function renderAdminMatchupTable({
  container,  // .admin-matchup-table 엘리먼트
  questions,  // 전체 문제 배열
  teamCount,  // 모둠 수
  allMatchups // { teamNum: { qIndex: name } }
}) {
  const table = document.createElement('table');

  // 헤더
  const thead = table.createTHead();
  const hrow  = thead.insertRow();
  hrow.insertCell().textContent = '문제';
  hrow.cells[0].style.fontWeight = '700';
  for (let t = 1; t <= teamCount; t++) {
    const th = document.createElement('th');
    th.textContent = `${t}모둠`;
    hrow.appendChild(th);
  }

  // 본문
  const tbody = table.createTBody();
  questions.forEach((q, i) => {
    const row = tbody.insertRow();
    row.insertCell().textContent = `Q${q.num} (${q.type})`;
    for (let t = 1; t <= teamCount; t++) {
      const cell = row.insertCell();
      const name = allMatchups[t] && allMatchups[t][String(i)];
      cell.textContent = name || '—';
      if (!name) cell.style.color = 'var(--c-sub)';
    }
  });

  container.innerHTML = '';
  container.appendChild(table);
}

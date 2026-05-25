// =============================================
// matchup.js — 대진표 로직 및 UI
// =============================================

// =============================================
// 멤버당 최대 참전 횟수 계산
// = ceil(문제 수 / 멤버 수)
// 나누어 떨어지면 N, 나머지가 있으면 N+1
// =============================================
export function calcMaxAllowed(totalQuestions, memberCount) {
  if (memberCount <= 0) return totalQuestions;
  return Math.ceil(totalQuestions / memberCount);
}

// =============================================
// 핵심 규칙: 최대 참전 횟수(ceil(문제/멤버)) 초과 여부 확인
// counts: { '김민준': 2, '김민서': 1 }
// candidate: 추가하려는 멤버 이름
// maxAllowed: calcMaxAllowed(totalQuestions, members.length)
// =============================================
export function wouldViolateRule(counts, candidate, maxAllowed) {
  return (counts[candidate] || 0) + 1 > maxAllowed;
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
// 로직: 현재 참전 횟수가 가장 적고 maxAllowed 미만인 멤버를 순서대로 배정
// 결과: 모든 멤버가 N번 이상 N+1번 이하 참전 (N = floor(문제/멤버))
// =============================================
export function autoFillMatchup(questions, members, matchup) {
  const filled     = { ...matchup };
  const maxAllowed = calcMaxAllowed(questions.length, members.length);

  for (let i = 0; i < questions.length; i++) {
    const key = String(i);
    if (filled[key]) continue;

    const counts = countParticipation(filled, members);

    // maxAllowed 미만인 멤버를 참전 횟수 오름차순으로 정렬 후 첫 번째 선택
    const eligible = members
      .filter(m => counts[m] < maxAllowed)
      .sort((a, b) => counts[a] - counts[b]);

    filled[key] = eligible.length > 0
      ? eligible[0]
      : members[i % members.length]; // 이론상 발생하지 않는 마지막 수단
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
  container,      // .cs-member-buttons 엘리먼트
  members,        // 멤버 이름 배열
  counts,         // 현재 참전 횟수 { name: count }
  totalQuestions, // 전체 문제 수 (최대 참전 횟수 계산용)
  onAssign        // 클릭 콜백 (memberName) => {}
}) {
  container.innerHTML = '';

  const maxAllowed = calcMaxAllowed(totalQuestions, members.length);

  for (const name of members) {
    const btn      = document.createElement('button');
    const current  = counts[name] || 0;
    const atMax    = current >= maxAllowed;

    btn.className   = 'member-btn';
    btn.textContent = atMax
      ? `${name} (${current}회 — 완료)`
      : `${name} (${current}회)`;

    if (atMax) {
      btn.classList.add('invalid');
      btn.disabled = true;
      btn.title    = `최대 참전 횟수(${maxAllowed}회)에 도달했습니다`;
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

// =============================================
// setting.js — 세팅 뷰 (방 만들기 / 참여)
// =============================================

// 6자리 랜덤 방 코드 생성 (대문자 + 숫자)
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 세팅 뷰 초기화 — 버튼 이벤트 등록
export function initSettingView({ onCreateRoom, onJoinStudent, onJoinBoard, onJoinAdmin, onClearSession, onResetAllSessions }) {
  const teamCountSel   = document.getElementById('team-count-select');
  const roomCodeInput  = document.getElementById('room-code-input');
  const btnCreate      = document.getElementById('btn-create-room');
  const btnJoinStudent = document.getElementById('btn-join-student');
  const btnJoinBoard   = document.getElementById('btn-join-board');
  const btnJoinAdmin   = document.getElementById('btn-join-admin');
  const msgEl          = document.getElementById('setting-message');

  // 메시지 표시 헬퍼
  function showMsg(text, isError = false) {
    msgEl.textContent = text;
    msgEl.style.borderColor = isError ? 'var(--c-red)' : 'var(--c-green)';
    msgEl.style.color       = isError ? 'var(--c-red)' : 'var(--c-text)';
    msgEl.classList.remove('hidden');
  }

  // 방 코드 입력 → 대문자 강제
  roomCodeInput.addEventListener('input', () => {
    roomCodeInput.value = roomCodeInput.value.toUpperCase();
  });

  // 방 만들기
  btnCreate.addEventListener('click', async () => {
    btnCreate.disabled = true;
    btnCreate.textContent = '방 생성 중...';
    try {
      const code      = generateRoomCode();
      const teamCount = parseInt(teamCountSel.value);
      await onCreateRoom(code, teamCount);
      showMsg(`방 코드: ${code} — 관리자 화면으로 이동합니다`);
    } catch (e) {
      showMsg('방 생성 실패: ' + e.message, true);
      btnCreate.disabled = false;
      btnCreate.textContent = '게임 준비 시작 ▶';
    }
  });

  // 공통: 방 코드 유효성 검사 후 참여
  function joinWithCode(role) {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (code.length !== 6) {
      showMsg('방 코드 6자리를 정확히 입력하세요', true);
      roomCodeInput.focus();
      return;
    }
    if (role === 'student') onJoinStudent(code);
    if (role === 'board')   onJoinBoard(code);
    if (role === 'admin')   onJoinAdmin(code);
  }

  btnJoinStudent.addEventListener('click', () => joinWithCode('student'));
  btnJoinBoard.addEventListener('click',   () => joinWithCode('board'));
  btnJoinAdmin.addEventListener('click',   () => joinWithCode('admin'));

  // 엔터 키로 학생 참여
  roomCodeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') joinWithCode('student');
  });

  // 전체 세션 초기화 버튼 (Firebase의 모든 방 삭제)
  const btnResetAll = document.getElementById('btn-reset-all-sessions');
  if (btnResetAll) {
    // 이미 등록된 리스너 중복 방지
    const newBtn = btnResetAll.cloneNode(true);
    btnResetAll.replaceWith(newBtn);
    newBtn.addEventListener('click', () => {
      if (confirm('⚠️ 현재 진행 중인 모든 방을 삭제하고 모든 참여자를 처음 화면으로 보냅니다.\n정말 초기화할까요?')) {
        onResetAllSessions && onResetAllSessions();
      }
    });
  }

  // 이전 세션 초기화 링크 (개발/테스트 편의용)
  // 이미 저장된 방이 있을 때만 표시
  if (localStorage.getItem('qb_room')) {
    const clearLink = document.createElement('p');
    clearLink.style.cssText = 'text-align:center;color:var(--c-sub);font-size:.8rem;cursor:pointer;text-decoration:underline;';
    clearLink.textContent = `저장된 세션(${localStorage.getItem('qb_room')}) 초기화하기`;
    clearLink.addEventListener('click', () => {
      onClearSession && onClearSession();
      clearLink.textContent = '초기화 완료 — 페이지를 새로고침하세요';
      clearLink.style.color = 'var(--c-green)';
    });
    document.querySelector('.setting-wrap').appendChild(clearLink);
  }
}

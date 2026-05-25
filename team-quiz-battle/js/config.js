// =============================================
// config.js — Firebase 설정 및 게임 상수
// =============================================

// Firebase 프로젝트 설정
export const firebaseConfig = {
  apiKey:            "AIzaSyARISr2eS2imxlKlLUW2brngbgS3jg9JJg",
  authDomain:        "teamquizbattle.firebaseapp.com",
  databaseURL:       "https://teamquizbattle-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "teamquizbattle",
  storageBucket:     "teamquizbattle.firebasestorage.app",
  messagingSenderId: "212223994772",
  appId:             "1:212223994772:web:ecbdb5bffc3d4713387d81"
};

// 구글 시트 CSV URL
export const SHEET_URLS = {
  // 문제 시트: 문제번호, 유형, 난이도, 미스터리, 문제내용, 이미지URL, 정답, 만점기준초, 보기1~6
  questions: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8z23UR9wfxCARaQWTIF_enQO288piYtLZHUnIFXj52Q_a-XN00-_2uRrMX3ySxAFtVhKh2hQoikLy/pub?output=csv",
  // 학생 시트: 반, 모둠, 이름
  students:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT10M4hwnBNfKoOIbbZb0lCwq34Y2lkBzpElPEFUiSy_iO4k9rBMSKGBho7G0w45DWzxYLi3EHxTJ3-/pub?output=csv"
};

// 문제 CSV 컬럼 인덱스
export const Q_COL = {
  NUM:        0,  // 문제번호
  TYPE:       1,  // 유형 (객관식/단답형/선잇기)
  DIFFICULTY: 2,  // 난이도 (하/중/상)
  MYSTERY:    3,  // 미스터리 여부 (값 있으면 미스터리 문제)
  CONTENT:    4,  // 문제내용
  IMAGE:      5,  // 이미지URL
  ANSWER:     6,  // 정답
  PERF_TIME:  7,  // 만점기준초
  OPT_START:  8   // 보기1 시작 인덱스 (보기1~6: 8~13)
};

// 게임 상수
export const GAME = {
  MATCHUP_SECONDS:     100,   // 대진표 작성 시간(초)
  COUNTDOWN_SECONDS:   5,     // 문제 전 카운트다운(초)
  BASE_SCORE:          10,    // 기본 점수
  MIN_SCORE:           3,     // 정답 시 최소 보장 점수
  CURSE_MIN_MS:        1500,  // 저주 최소 지연(ms)
  CURSE_MAX_MS:        2500,  // 저주 최대 지연(ms)
  ERASER_TIME_BONUS:   2,     // 지우개 사용 후 타이머 보상(초)
};

// 아이템 타입
export const ITEM_TYPES = {
  BOOST:  'boost',   // 점수 1.5배
  CURSE:  'curse',   // 저주 (상대 입력 지연)
  ERASER: 'eraser'   // 지우개 (오답 힌트 제거)
};

// 아이템 이름/설명
export const ITEM_INFO = {
  boost:  { name: '⚡ 점수 1.5배',  desc: '이번 문제 정답 점수가 1.5배!' },
  curse:  { name: '💀 저주',        desc: '상대 팀의 정답 입력을 지연시켜요' },
  eraser: { name: '🩹 지우개',      desc: '오답 1개 제거 / 타이머 2초 보너스' }
};

// 미스터리 카드 8장 구성 (확률에 따라 배분)
// 패자의 역습 15% → 1장, 주사위 벼락 15% → 1장
// 아이템 회복 10% → 1장, 흡수 10% → 1장, 쉴드 10% → 1장
// 꽝 40% → 3장  (합계: 8장)
export const MYSTERY_DECK_TEMPLATE = [
  '패자의 역습', '주사위 벼락',
  '아이템 회복', '흡수', '쉴드',
  '꽝', '꽝', '꽝'
];

// 미스터리 카드 설명
export const MYSTERY_INFO = {
  '패자의 역습': { emoji: '👊', desc: '꼴등 +10점, 꼴등-1 +8점, 꼴등-2 +2점' },
  '아이템 회복': { emoji: '🔄', desc: '사용한 아이템 1개 회복' },
  '흡수':        { emoji: '🌀', desc: '1등에서 3점, 2등에서 2점, 나머지 1점씩 강탈' },
  '쉴드':        { emoji: '🛡️',  desc: '다음 저주 1회 방어' },
  '주사위 벼락': { emoji: '🎲', desc: '주사위를 굴려 나온 모둠 -10점' },
  '꽝':          { emoji: '💨', desc: '아무 효과 없음' }
};

// localStorage 키
export const LS = {
  ROOM:        'qb_room',         // 방 코드
  TEAM:        'qb_team',         // 내 모둠 번호
  ROLE:        'qb_role',         // 역할 (student/admin/board)
  MUTED:       'qb_muted',        // 음소거 여부
  RESET_COUNT: 'qb_reset_count'   // 세션 리셋 카운터 (관리자 초기화 감지용)
};

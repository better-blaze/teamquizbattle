// =============================================
// data.js — 구글 시트 CSV 파싱 및 데이터 관리
// =============================================

import { SHEET_URLS, Q_COL } from './config.js';

// CSV 텍스트 → 2차원 배열 (따옴표 처리 포함)
function parseCSV(text) {
  const rows = [];
  const lines = text.trim().split('\n');
  for (const line of lines) {
    const cols = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

// 구글 시트 CSV URL 가져오기 (CORS 대응)
async function fetchCSV(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`CSV 로드 실패: ${url}`);
  return res.text();
}

// =============================================
// 문제 데이터 파싱
// 컬럼: 문제번호, 유형, 난이도, 미스터리, 문제내용,
//       이미지URL, 정답, 만점기준초, 보기1~6
// =============================================
export async function loadQuestions() {
  const text = await fetchCSV(SHEET_URLS.questions);
  const rows = parseCSV(text);

  // 헤더 행 제거 (첫 번째 행이 헤더인지 숫자인지 확인)
  const dataRows = rows.filter(r => r[Q_COL.NUM] && !isNaN(Number(r[Q_COL.NUM])));

  return dataRows.map(r => {
    // 정답: 단답형은 '|' 구분 복수 정답 허용
    const rawAnswer = r[Q_COL.ANSWER] || '';

    // 유형 정규화: 모든 공백 제거 + trim
    // "선 잇기" → "선잇기", "객 관식" → "객관식" 등 오입력 대응
    const qType = r[Q_COL.TYPE].replace(/\s+/g, '');

    let answers = [];
    if (qType === '단답형') {
      answers = rawAnswer.split('|').map(a => a.replace(/\s+/g, '').toLowerCase());
    } else {
      answers = [rawAnswer.trim()];
    }

    // 선 잇기 정답 파싱: "왼쪽1:오른쪽1 | 왼쪽2:오른쪽2"
    // 전각 파이프(｜)·전각 콜론(：) 등 유니코드 변형도 정규화해서 처리
    let matchPairs = [];
    if (qType === '선잇기') {
      // 전각 특수문자 → 반각 정규화
      const normalizedAnswer = rawAnswer
        .replace(/[｜∣]/g, '|')   // 전각·수학 파이프 → |
        .replace(/[：∶]/g, ':');   // 전각·비율 콜론  → :
      matchPairs = normalizedAnswer.split('|')
        .map(pair => {
          const trimmed = pair.trim();
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx < 0) return null;
          return {
            left:  trimmed.slice(0, colonIdx).trim(),
            right: trimmed.slice(colonIdx + 1).trim()
          };
        })
        .filter(p => p && p.left && p.right);

      // 파싱 결과 디버그 로그 (개발 확인용)
      if (matchPairs.length === 0) {
        console.warn('[선잇기] matchPairs 파싱 실패 — rawAnswer:', JSON.stringify(rawAnswer));
      } else {
        console.log('[선잇기] matchPairs 파싱 성공:', matchPairs);
      }
    }

    // 객관식 보기 목록
    const options = [];
    for (let i = Q_COL.OPT_START; i < Q_COL.OPT_START + 6; i++) {
      if (r[i] && r[i].trim()) options.push(r[i].trim());
    }

    return {
      num:        parseInt(r[Q_COL.NUM]),          // 문제 번호 (1부터)
      type:       qType,                             // 유형
      difficulty: r[Q_COL.DIFFICULTY].trim(),      // 난이도 (하/중/상)
      isMystery:  !!r[Q_COL.MYSTERY].trim(),       // 미스터리 문제 여부
      content:    r[Q_COL.CONTENT].trim(),         // 문제 내용
      imageUrl:   r[Q_COL.IMAGE].trim(),           // 이미지 URL
      answers,                                      // 정답 배열 (소문자+공백제거)
      matchPairs,                                   // 선 잇기 페어 배열
      perfTime:   parseInt(r[Q_COL.PERF_TIME]) || 5, // 만점 기준(초)
      options,                                      // 객관식 보기
      rawAnswer                                     // 원본 정답 (표시용)
    };
  });
}

// =============================================
// 학생 데이터 파싱
// 컬럼: 반, 모둠, 이름
// =============================================
export async function loadStudents() {
  const text = await fetchCSV(SHEET_URLS.students);
  const rows = parseCSV(text);

  // 헤더 제거 후 파싱
  const dataRows = rows.filter(r => r[0] && r[1] && r[2] && r[0] !== '반');

  // 모둠별 학생 목록으로 그룹화: { 1: ['김민준', '김민서'], 2: [...], ... }
  const byTeam = {};
  for (const r of dataRows) {
    const teamNum = parseInt(r[1]);
    if (!byTeam[teamNum]) byTeam[teamNum] = [];
    byTeam[teamNum].push(r[2].trim());
  }

  return byTeam;
}

// =============================================
// 문제 분류 유틸리티
// =============================================

// 난이도 '하' 문제 목록 반환
export function getEasyQuestions(questions) {
  return questions.filter(q => q.difficulty === '하');
}

// 미스터리 문제 목록 반환
export function getMysteryQuestions(questions) {
  return questions.filter(q => q.isMystery);
}

// 정보 카드 데이터 생성 (대진표 화면 하단 3장)
export function buildInfoCards(questions) {
  const easy     = getEasyQuestions(questions);
  const mystery  = getMysteryQuestions(questions);

  const cards = [
    {
      // 카드 1: 가장 쉬운 문제 (난이도 "하" 첫 번째)
      icon:  '⭐',
      label: '가장 쉬운 문제',
      data:  easy.length > 0 ? [easy[0]] : []
    },
    {
      // 카드 2: 미스터리 문제 정보
      icon:  '🎴',
      label: '미스터리 문제',
      data:  mystery
    },
    {
      // 카드 3: 쉬운 문제 2개
      icon:  '💡',
      label: '쉬운 문제 2개',
      data:  easy.slice(0, 2)
    }
  ];
  return cards;
}

/**
 * 퍼블릭 경로 제목·소개 서버 내장 금칙어·개인정보 검사.
 * 외부 모더레이션 API 없이 동작 — 리스트 품질만큼 커버(한계 인지, 정책 §1 G4).
 * 정밀도 우선: 오탐(정상 사용자 차단)이 미탐보다 나쁘다 — 모호어는 예외 처리, 일반 단어에
 * 흔히 포함되는 토큰은 리스트에 넣지 않는다.
 */

/** NFKC 정규화 + 소문자화 + 구분자 제거 — 우회(자*식, 시-발 등) 완화 */
export function normalizeForBadWordScan(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s.\-_·*,!?~^]+/g, "");
}

/** 정규화 후 부분 문자열 매칭 대상 — 명백한 강한 비속어만(정밀도 우선) */
const KOREAN_BAD_WORDS = [
  "씨발",
  "시발",
  "씨팔",
  "씨빨",
  "병신",
  "븅신",
  "지랄",
  "개새끼",
  "개색기",
  "개세끼",
  "미친놈",
  "미친년",
  "창녀",
  "강간",
  "좆",
];

/** 모호어: 정규화 문자열에 이 예외들이 포함되면 통과(오탐 방지) */
const KOREAN_AMBIGUOUS_EXCEPTIONS: Record<string, string[]> = {
  시발: ["시발점", "시발역", "시발지", "시발가"],
};

/** 영어 금칙어 — 원문 소문자 기준 단어 경계(\b) 매칭 */
const ENGLISH_BAD_WORDS = ["fuck", "shit", "bitch", "asshole", "cunt", "nigger", "faggot"];

function findKoreanBannedWord(normalized: string): string | null {
  for (const word of KOREAN_BAD_WORDS) {
    if (!normalized.includes(word)) continue;
    const exceptions = KOREAN_AMBIGUOUS_EXCEPTIONS[word];
    if (exceptions && exceptions.some((ex) => normalized.includes(ex))) {
      continue;
    }
    return word;
  }
  return null;
}

function findEnglishBannedWord(rawLower: string): string | null {
  for (const word of ENGLISH_BAD_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, "i");
    if (re.test(rawLower)) return word;
  }
  return null;
}

/** 매칭된 금칙어를 반환한다(로그용). 사용자 메시지에는 매칭 단어를 노출하지 않는다. */
export function findBannedWord(text: string): string | null {
  const normalized = normalizeForBadWordScan(text);
  const koreanHit = findKoreanBannedWord(normalized);
  if (koreanHit) return koreanHit;
  return findEnglishBannedWord(text.toLowerCase());
}

const PHONE_PATTERNS = [
  /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/,
  /0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}/,
];

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** 전화번호·이메일 패턴 탐지. 우선순위: 전화 → 이메일. */
export function findPrivateInfo(text: string): "phone" | "email" | null {
  if (PHONE_PATTERNS.some((re) => re.test(text))) return "phone";
  if (EMAIL_PATTERN.test(text)) return "email";
  return null;
}

/** http(s):// 링크 개수 */
export function countHttpUrls(text: string): number {
  return (text.match(/https?:\/\//gi) ?? []).length;
}

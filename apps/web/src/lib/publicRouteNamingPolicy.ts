/** 퍼블릭 신청 모달·Rules 와 동기 — 변경 시 Rules·문서도 갱신 */
export const PUBLIC_ROUTE_NAMING_POLICY_VERSION = "2026-05-18";

export const PUBLIC_ROUTE_NAMING_GUIDE_KO =
  "권장 형식: {닉네임} · {지역 또는 랜드마크} · {거리·특성} — 예: PedalKim · 한강 양화 · 왕복 12km";

export const PUBLIC_ROUTE_NAMING_DISCLOSURE_KO = [
  "공개 제목은 승인 후 모든 라이더에게 보이는 이름이며, 널리 쓰이기 시작하면 커뮤니티가 기억하는 지명이 됩니다.",
  "승인 후 등록자가 임의로 바꿀 수 없습니다(오타·지명 오류는 운영·심사 절차로만 수정).",
  "「내 경로」에 붙인 개인용 이름과는 별개이며, 여기서 정한 공개 제목만 퍼블릭 경로에 반영됩니다.",
] as const;

export function shouldOpenNamingHelpForError(message: string): boolean {
  return /중복|동일|유사|구분|가운뎃점|공개 제목|명명|퍼블릭|이미 등록|심사 대기|개인용/.test(message);
}

const GENERIC_TITLE_ONLY =
  /^(라이딩|라이드|테스트|test|운동|route|ride|riding|코스|course|path)$/i;

/** 제출 차단용이 아닌 입력 중 힌트 */
export function hintPublicRouteTitle(title: string): string | null {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length < 1) return null;
  if (GENERIC_TITLE_ONLY.test(t)) {
    return "「라이딩」「테스트」처럼 개인용 이름만 쓰면 다른 사람이 구분하기 어렵습니다.";
  }
  if (t.length < 10 && !/[·・]/.test(t)) {
    return "닉네임·지역·특성을 가운뎃점(·)으로 구분해 주세요.";
  }
  return null;
}

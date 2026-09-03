/**
 * 동행 HUD 인원수·빈 문장 — Trail 실시간 구독이 단일 진실.
 * publication aggregate 인원수는 Trail 경계를 넘으므로 쓰지 않는다.
 * heat·최근 활동 절은 aggregate 줄에서 인원수 절만 빼고 유지한다.
 */

export type CompanionHudCopy = {
  /** 주행 중이면 1+others, 아니면 null(인원수 절 숨김) */
  riderCount: number | null;
  showEmptyCopy: boolean;
};

export function companionHudCopy(input: {
  otherLiveRiderCount: number;
  selfRiding: boolean;
  coursePeerNamesLength: number;
}): CompanionHudCopy {
  const others = Number.isFinite(input.otherLiveRiderCount)
    ? Math.max(0, Math.floor(input.otherLiveRiderCount))
    : 0;
  const namesLen = Number.isFinite(input.coursePeerNamesLength)
    ? Math.max(0, Math.floor(input.coursePeerNamesLength))
    : 0;
  const riderCount = input.selfRiding ? 1 + others : null;
  const showEmptyCopy = namesLen === 0 && others === 0;
  return { riderCount, showEmptyCopy };
}

const LIVE_COUNT_RE = /지금 \d+명 주행/g;
const LIVE_BUSY_RE = /지금 활동 중/g;

/** aggregate 한 줄에서 인원수·활동 중 절만 제거. heat·좋아요는 남긴다. */
export function stripCompanionLiveCountClause(line: string | null): string | null {
  if (!line) return null;
  const rest = line
    .replace(LIVE_COUNT_RE, "")
    .replace(LIVE_BUSY_RE, "")
    .replace(/\s*·\s*/g, " · ")
    .replace(/^(?: · )+|(?: · )+$/g, "")
    .trim();
  return rest.length > 0 ? rest : null;
}

/**
 * 인원수 절만 실시간 값으로 쓰고, 나머지 aggregate 절은 유지한다.
 * displayedRiderCount 가 null 이면 인원수 절을 빼기만 한다(낡은 N명을 내보내지 않음).
 */
export function formatCompanionHudActivityLine(input: {
  aggregateHudLine: string | null;
  displayedRiderCount: number | null;
}): string | null {
  const rest = stripCompanionLiveCountClause(input.aggregateHudLine);
  const n = input.displayedRiderCount;
  if (n == null || !Number.isFinite(n) || n < 1) return rest;
  const live = `지금 ${Math.floor(n)}명 주행`;
  if (!rest) return live;
  return `${live} · ${rest}`;
}

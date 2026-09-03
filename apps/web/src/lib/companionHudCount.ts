/**
 * 동행 HUD 「지금 N명 주행」 표시값.
 * aggregate(최대 60초 낡음, 구독 밖 포함) 와 실시간 구독(즉시, 내 Trail 만) 중 큰 쪽.
 * 폴링 주기·캐시 TTL 은 건드리지 않는다.
 */

export function companionDisplayedRiderCount(input: {
  aggregateCount: number | null;
  otherLiveRiderCount: number;
  selfRiding: boolean;
}): number | null {
  const others = Number.isFinite(input.otherLiveRiderCount)
    ? Math.max(0, Math.floor(input.otherLiveRiderCount))
    : 0;
  if (!input.selfRiding) {
    return input.aggregateCount;
  }
  const agg =
    input.aggregateCount == null || !Number.isFinite(input.aggregateCount)
      ? 0
      : Math.max(0, Math.floor(input.aggregateCount));
  return Math.max(agg, 1 + others);
}

const LIVE_COUNT_RE = /지금 \d+명 주행/;
const LIVE_BUSY = "지금 활동 중";

/**
 * aggregate 한 줄의 인원 숫자만 올린다. heat·좋아요 절은 유지.
 * 실시간 값으로 aggregate 를 대체하지 않는다 — 구독 밖 인원이 더 크면 그 숫자가 남는다.
 */
export function formatCompanionHudActivityLine(input: {
  aggregateHudLine: string | null;
  displayedRiderCount: number | null;
  selfRiding: boolean;
}): string | null {
  if (!input.selfRiding) return input.aggregateHudLine;
  const n = input.displayedRiderCount;
  if (n == null || !Number.isFinite(n) || n < 1) return input.aggregateHudLine;
  const live = `지금 ${Math.floor(n)}명 주행`;
  const line = input.aggregateHudLine;
  if (!line) return live;
  if (LIVE_COUNT_RE.test(line)) return line.replace(LIVE_COUNT_RE, live);
  if (line.startsWith(LIVE_BUSY)) {
    return `${live}${line.slice(LIVE_BUSY.length)}`;
  }
  return `${live} · ${line}`;
}

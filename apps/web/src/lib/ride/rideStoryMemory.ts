import type { RideStoryKind } from "./rideStory";

/**
 * 직전 주행의 스토리 문형 기억 — 같은 헤드라인을 연달아 쓰지 않기 위해(N7).
 *
 * 결과 시트가 열려 있는 동안 기록이 갱신되면 스토리가 다시 계산된다. 그때 「직전 문형」이
 * 방금 이 주행으로 바뀌어 있으면 헤드라인이 눈앞에서 뒤집힌다. 그래서 주행 id 별로
 * 「이 주행을 계산할 때 본 직전 문형」을 함께 둔다.
 */
const KEY = "rtw.rideStory.lastKind.v1";

type Stored = { recordId: string; kind: RideStoryKind; previousKind: RideStoryKind | null };

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    return typeof v.recordId === "string" && typeof v.kind === "string"
      ? { recordId: v.recordId, kind: v.kind, previousKind: v.previousKind ?? null }
      : null;
  } catch {
    return null;
  }
}

/** 이 주행의 스토리를 고를 때 피할 문형 */
export function readPreviousRideStoryKind(recordId: string): RideStoryKind | null {
  const s = read();
  if (!s) return null;
  return s.recordId === recordId ? s.previousKind : s.kind;
}

export function rememberRideStoryKind(recordId: string, kind: RideStoryKind): void {
  const s = read();
  // 같은 주행을 다시 적을 땐(기록 갱신으로 문형이 바뀜) 처음 본 직전 문형을 지킨다
  const previousKind = s?.recordId === recordId ? s.previousKind : (s?.kind ?? null);
  if (s?.recordId === recordId && s.kind === kind) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ recordId, kind, previousKind }));
  } catch {
    /* 기억 못 해도 스토리는 나온다 — 반복 회피만 빠진다 */
  }
}

import type { StoredRideSession } from "./rideSessionsStorage";

/** 계정 창 지역 선택 키 — 둘 다 null = 세계. 행정구역만 고르는 경우는 없다(국가 아래에서만 고른다). */
export type RideRegionKey = { country: string | null; admin1: string | null };

/**
 * 이 주행의 지역 몫 비율(0~1). 세계 → 1.
 * 지역을 모르는 주행(`regionDistances` 없음)·지역 거리 0·주행 거리 0 이하는 null(지역 집계에서 제외).
 */
export function regionShareOf(session: StoredRideSession, key: RideRegionKey): number | null {
  if (key.country == null && key.admin1 == null) return 1;
  const rows = session.regionDistances;
  if (!rows || !(session.distanceMeters > 0)) return null;
  let sum = 0;
  for (const r of rows) {
    const hit = key.admin1 != null ? r.admin1 === key.admin1 : r.country === key.country;
    if (hit && Number.isFinite(r.meters) && r.meters > 0) sum += r.meters;
  }
  if (!(sum > 0)) return null;
  return Math.min(1, sum / session.distanceMeters);
}

/** 거리·시간·칼로리를 지역 몫만큼 비례한 새 주행. 평균 속도는 그대로. 제외 대상이면 null. */
export function applyRegionShare(session: StoredRideSession, key: RideRegionKey): StoredRideSession | null {
  const share = regionShareOf(session, key);
  if (share == null) return null;
  if (share === 1 && key.country == null && key.admin1 == null) return session;
  return {
    ...session,
    distanceMeters: session.distanceMeters * share,
    elapsedSec: Math.round(session.elapsedSec * share),
    caloriesEstimate: session.caloriesEstimate == null ? null : session.caloriesEstimate * share,
  };
}

/** 세계는 원본 그대로, 지역이면 지역 몫으로 바꾸고 해당 없는 주행은 뺀다. */
export function filterSessionsByRegion(
  sessions: readonly StoredRideSession[],
  key: RideRegionKey,
): StoredRideSession[] {
  if (key.country == null && key.admin1 == null) return sessions as StoredRideSession[];
  const out: StoredRideSession[] = [];
  for (const s of sessions) {
    const r = applyRegionShare(s, key);
    if (r) out.push(r);
  }
  return out;
}

/**
 * F3: Conquest from ride doc (rides/{id}.conquestResult).
 * CF conquestOnRideCreated 가 rides/{rideId}.conquestResult 에 쓰는 결과를 읽는다.
 */

/** Conquest 결과 상태 — UI는 이 status로 loading·error·확정 0을 구분한다 */
export type ConquestResultStatus =
  | "none" // 아직 CF가 처리하지 않음 (필드 부재 또는 pending)
  | "pending" // CF 처리 중
  | "confirmed_zero" // 확정 0m (새 도로 없음)
  | "positive" // 양수 m
  | "error" // CF 처리 실패
  | "unsaved"; // 로컬 전용 (Firestore에 저장되지 않은 주행)

/**
 * Ride 한 건의 정복 결과 (rides/{rideId}.conquestResult).
 * CF conquestOnRideCreated 가 쓰는 필드 집합 (functions/src/conquestOnRideCreated.ts line 223).
 */
export type RideConquestResult = {
  status: ConquestResultStatus;
  /** 새 도로 (m). status=positive일 때만 > 0 보장 */
  newMeters: number;
  /** 새 셀 수 */
  newCells?: number;
  /** 인정 거리 (tier 적용 후, m) */
  creditedMeters?: number;
  /** Trust tier */
  tier?: string;
  /** 집계일 (YYYYMMDD) */
  day?: string;
};

/** 빈 conquest 결과 (아직 서버 응답 없음) */
export const EMPTY_CONQUEST_RESULT: RideConquestResult = {
  status: "none",
  newMeters: 0,
};

/**
 * Firestore conquestResult raw 필드 → 타입 안전 결과.
 * Absence ≠ 0 — 필드가 없으면 "none", 0이면 "confirmed_zero".
 */
export function parseConquestResult(
  raw: Record<string, unknown> | null | undefined,
): RideConquestResult {
  if (!raw || typeof raw !== "object") {
    return EMPTY_CONQUEST_RESULT;
  }

  const newMeters = Number(raw.newMeters ?? 0);
  if (!Number.isFinite(newMeters)) {
    return { status: "error", newMeters: 0 };
  }

  // CF가 status를 명시적으로 쓰지 않으므로, newMeters 값으로 추론
  if (newMeters > 0) {
    return {
      status: "positive",
      newMeters,
      newCells: typeof raw.newCells === "number" ? raw.newCells : undefined,
      creditedMeters: typeof raw.creditedMeters === "number" ? raw.creditedMeters : undefined,
      tier: typeof raw.tier === "string" ? raw.tier : undefined,
      day: typeof raw.day === "string" ? raw.day : undefined,
    };
  }

  if (newMeters === 0 && "newMeters" in raw) {
    return {
      status: "confirmed_zero",
      newMeters: 0,
      newCells: typeof raw.newCells === "number" ? raw.newCells : undefined,
      day: typeof raw.day === "string" ? raw.day : undefined,
    };
  }

  return EMPTY_CONQUEST_RESULT;
}

/** 「새 도로 +N km」 표시 문자열. 50m 미만은 null (0 미표시 원칙) */
export function formatConquestSummaryLine(result: RideConquestResult): string | null {
  if (result.status !== "positive") return null;
  if (result.newMeters < 50) return null;
  const km = result.newMeters / 1000;
  return `새 도로 +${km.toFixed(result.newMeters < 10000 ? 1 : 0)}km`;
}

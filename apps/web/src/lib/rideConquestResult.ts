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
 * 
 * Codex -02 Fix 4: Absence ≠ invalid type.
 * - Absence (필드 없음) → "none"
 * - 0 (확정) → "confirmed_zero"
 * - Invalid type (string/boolean/null) → "error" (CF bug/corruption)
 */
export function parseConquestResult(
  raw: Record<string, unknown> | null | undefined,
): RideConquestResult {
  if (!raw || typeof raw !== "object") {
    return EMPTY_CONQUEST_RESULT;
  }

  // Codex -02 Fix 4: Absence vs invalid type 구분
  const newMetersRaw = raw.newMeters;
  if (newMetersRaw === undefined) {
    // Absence: CF가 아직 처리 안 함
    return EMPTY_CONQUEST_RESULT; // status: "none"
  }
  if (typeof newMetersRaw !== "number") {
    // Invalid type (string/boolean/null): CF bug or corruption
    return { status: "error", newMeters: 0 };
  }
  if (!Number.isFinite(newMetersRaw)) {
    return { status: "error", newMeters: 0 };
  }

  // CF가 status를 명시적으로 쓰지 않으므로, newMeters 값으로 추론
  if (newMetersRaw > 0) {
    return {
      status: "positive",
      newMeters: newMetersRaw,
      newCells: typeof raw.newCells === "number" ? raw.newCells : undefined,
      creditedMeters: typeof raw.creditedMeters === "number" ? raw.creditedMeters : undefined,
      tier: typeof raw.tier === "string" ? raw.tier : undefined,
      day: typeof raw.day === "string" ? raw.day : undefined,
    };
  }

  // newMeters === 0 && newMeters field exists → confirmed zero
  if (newMetersRaw === 0) {
    return {
      status: "confirmed_zero",
      newMeters: 0,
      newCells: typeof raw.newCells === "number" ? raw.newCells : undefined,
      day: typeof raw.day === "string" ? raw.day : undefined,
    };
  }

  // newMeters < 0 (invalid) → error
  return { status: "error", newMeters: 0 };
}

/** 「새 도로 +N km」 표시 문자열. 50m 미만은 null (0 미표시 원칙) */
export function formatConquestSummaryLine(result: RideConquestResult): string | null {
  if (result.status !== "positive") return null;
  if (result.newMeters < 50) return null;
  const km = result.newMeters / 1000;
  return `새 도로 +${km.toFixed(result.newMeters < 10000 ? 1 : 0)}km`;
}

/**
 * F5: Ownership guard — 순수 함수로 추출 (useRideConquestResult에서 사용)
 * 
 * Firestore snapshot의 userId가 현재 active userId와 일치하는지 확인.
 * 다른 사용자의 주행 결과가 내 result로 잘못 적용되지 않도록 보호.
 * 
 * @param docUserId - Firestore doc의 userId 필드
 * @param activeUserId - 현재 로그인한 사용자 ID
 * @returns userId 일치하면 true (적용 가능), 불일치하면 false (거부)
 */
export function isRideOwnedByUser(
  docUserId: string | null | undefined,
  activeUserId: string | null | undefined,
): boolean {
  if (!activeUserId) return false; // 로그인 안 됨
  if (!docUserId) return false; // doc에 userId 없음
  return docUserId === activeUserId;
}

/**
 * F5/C12: serverRideId 일치 확인 (delayed response가 wrong ride에 적용 방지)
 * 
 * serverRideId는 구독 경로(doc(rides, serverRideId))에 implicit하지만,
 * 테스트/문서화를 위해 명시적 guard 제공.
 * 
 * @param expectedRideId - 구독 중인 ride ID
 * @param actualRideId - snapshot에서 온 ride ID (보통 doc path와 동일)
 * @returns 일치하면 true, 불일치하면 false
 */
export function isRideIdMatch(
  expectedRideId: string | null | undefined,
  actualRideId: string | null | undefined,
): boolean {
  if (!expectedRideId || !actualRideId) return false;
  return expectedRideId === actualRideId;
}

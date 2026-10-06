/**
 * 주행 기록으로 남기지 않을 최소 거리(초과해야 유효).
 * ⚠️ 테스트용 100m. 출시 전 200 으로 되돌릴 것 — document/출시 전 확인사항.md 참고.
 * ⚠️ 이 파일과 functions/src/rideRecordPolicy.ts 는 **항상 같은 값**이어야 한다.
 *    한쪽만 바꾸면 클라이언트는 남기고 서버는 버리는 주행이 생겨,
 *    새로고침하면 사라지는 기록이 된다(2026-09-04 실제 발생).
 */
export const MIN_MEANINGFUL_RIDE_DISTANCE_METERS = 100;

/**
 * 주행 기록으로 남기지 않을 최소 시간(초과해야 유효).
 * ⚠️ 테스트용 5초. 출시 전 3 * 60(3분)으로 되돌릴 것 — document/출시 전 확인사항.md 참고.
 * ⚠️ functions/src/rideRecordPolicy.ts 와 같은 값을 유지할 것.
 */
export const MIN_MEANINGFUL_RIDE_DURATION_SEC = 5;

/**
 * 즉시 종료 등 가치 없는 주행 — 거리·시간 중 하나라도 기준 이하면 기록에서 제외.
 * (100m 이하 **또는** 5초 이하 — 테스트 기준. 출시 기준은 200m·3분)
 */
export function isDiscardableRideRecord(distanceMeters: number, elapsedSec: number): boolean {
  const d = Number(distanceMeters);
  const t = Number(elapsedSec);
  if (!Number.isFinite(d) || !Number.isFinite(t)) return true;
  return d <= MIN_MEANINGFUL_RIDE_DISTANCE_METERS || t <= MIN_MEANINGFUL_RIDE_DURATION_SEC;
}

/**
 * Route 완주 인정 임계(진행률). 부동소수·마지막 셀 오차 여유로 100%가 아닌 98%.
 * 이 이상이면 「완주」(saved route completed=1), 미만이면 「진행 중」으로 남긴다.
 * 결정: Conquest §9.5 (2026-07-07).
 */
export const ROUTE_COMPLETION_RATIO_THRESHOLD = 0.98;

/** completionRatio(0..1) 가 완주 임계 이상인가 */
export function isRouteCompletion(completionRatio: number): boolean {
  return Number.isFinite(completionRatio) && completionRatio >= ROUTE_COMPLETION_RATIO_THRESHOLD;
}

/**
 * 주행 종료 시 **운동 기록 폐기**와 **저장 경로 진행 반영**을 분리한 판정.
 *
 * 짧은 이어 달리기(남은 구간 ≤100m)가 기록 폐기되면 진행률·완주도 막히는 교착을 막는다.
 * ad-hoc(저장 경로 아님)은 진행 반영이 없고, 폐기 임계값은 바꾸지 않는다.
 */
export type RideEndDisposition = {
  /** rides 문서·로컬 세션·칼로리 통계에서 제외 */
  discardRecord: boolean;
  /** 저장 경로 진행률 갱신·완주 promote 수행 */
  applySavedRouteProgress: boolean;
};

export function resolveRideEndDisposition(input: {
  distanceMeters: number;
  elapsedSec: number;
  /** 저장 경로 주행인가(ad-hoc 이면 false) */
  hasSavedRoute: boolean;
  /** 이번 주행 전 저장 진행률(0..1) */
  previousProgressRatio: number;
  /** 이번 세션 누적 진행률(0..1) */
  completionRatio: number;
}): RideEndDisposition {
  const discardRecord = isDiscardableRideRecord(input.distanceMeters, input.elapsedSec);
  if (!input.hasSavedRoute) {
    return { discardRecord, applySavedRouteProgress: false };
  }
  const prev = Number.isFinite(input.previousProgressRatio)
    ? Math.max(0, Math.min(1, input.previousProgressRatio))
    : 0;
  const next = Number.isFinite(input.completionRatio)
    ? Math.max(0, Math.min(1, input.completionRatio))
    : 0;
  if (!discardRecord) {
    // 일반 유효 주행 — 종전처럼 저장 경로면 진행 반영 시도(단조 정책이 no-op 가능)
    return { discardRecord: false, applySavedRouteProgress: true };
  }
  // 폐기된 짧은 주행: 누적 진행이 기존보다 높을 때만 경로 반영
  return { discardRecord: true, applySavedRouteProgress: next > prev };
}

/**
 * 이어 달리기(§9.5.5 단위7) 시작 오프셋의 진행률 상한.
 * 완주 임계(0.98) 직전에서 재개해 몇 m 만 달리고 완주 처리되는 퇴화를 막는다.
 */
export const ROUTE_RESUME_MAX_RATIO = 0.97;

/** 저장 진행률 → 재개 시작 오프셋(m). 진행률은 상한 클램프, 비유한 입력은 0 */
export function resumeOffsetMetersFrom(
  progressRatio: number,
  routeDistanceMeters: number,
): number {
  const ratio = Number.isFinite(progressRatio)
    ? Math.max(0, Math.min(progressRatio, ROUTE_RESUME_MAX_RATIO))
    : 0;
  const dist = Number.isFinite(routeDistanceMeters) ? Math.max(0, routeDistanceMeters) : 0;
  return ratio * dist;
}

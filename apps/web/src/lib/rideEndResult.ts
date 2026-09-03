import type { RouteProfile } from "../services/mapboxDirections";
import type { LngLat } from "./geo";

/**
 * 주행 종료 결과 모델(RIDE-CONTINUE-1 단계 C).
 *
 * 「도착했는가」·「ad-hoc 인가」로 결과 시트 노출을 제한하던 조건을 대체한다 —
 * `isDiscardableRideRecord` 로 폐기되지 않은 **모든 유효 Ride** 가 이 결과를 만들고,
 * 결과 시트는 이 값 하나로 구동된다. 문구 조합은 컴포넌트가 한다(App 에 누적하지 않는다).
 */
export type RideEndResult = {
  /** 로컬 기록 id(낙관 표시용). Firestore rides 문서 id 와는 다르다. */
  recordId: string;
  endedAtIso: string;
  /** 이번 세션 실주행 거리(m) — 「오늘 N km」. 재개 offset 은 이미 빠져 있다. */
  sessionDistanceMeters: number;
  elapsedSec: number;
  avgSpeedKmh: number;
  caloriesEstimate: number;
  /** 주행 대상이 저장 경로였다면 그 id. ad-hoc·퍼블릭 전용은 null. */
  savedRouteId: string | null;
  routeName: string | null;
  /** 경로가 있는 주행인가(ad-hoc 자유 주행이면 false) */
  hasRoute: boolean;
  /** 이번 주행 **전** 저장돼 있던 진행률(0..1) */
  previousProgressRatio: number;
  /** 이번 주행 **후** 진행률(0..1, 누적 위치 기준) */
  progressRatio: number;
  /** 완주(≥98%) 여부 — 전 UI 단일 정책 */
  routeCompleted: boolean;
  /** 다음 출발점(실제 종료 좌표). 계산 불가면 null — 좌표를 추측하지 않는다. */
  anchorLngLat: LngLat | null;
  /** 다음 출발점 지명. 없으면 UI 가 「마지막 종료 지점」으로 표시한다. */
  anchorPlaceLabel: string | null;
  /**
   * 이어 달리기 승계의 1순위 근거(결함 ④). 페이지 세션 ref 는 초기값
   * `{driving, 10}` 으로 시작해 채워지지 않은 경로로 들어오면 그대로 자동차가 나온다.
   */
  profile: RouteProfile;
  /** 이번 주행이 달린 Route 전장(m) — 다음 목표 거리의 근거 */
  routeDistanceMeters: number;
};

/** 진행률(0..1) → 표시용 정수 % */
export function progressPercentLabel(ratio: number): number {
  const n = Number(ratio);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(1, n)) * 100);
}

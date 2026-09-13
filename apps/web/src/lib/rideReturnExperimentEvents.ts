import type { RideEndResult } from "./rideEndResult";
import type { NextRideTarget } from "./nextRideTarget";

/**
 * RIDE-RETURN-EXPERIMENT-4 — 재방문 실험 측정 이벤트 (클라이언트 배선, no-op sink).
 *
 * **저장 위치: 미정** — 이번 PR은 배선·계약 고정만. Firestore 서브컬렉션·외부 SaaS 도입 전
 * Chief 승인 + 개인정보·보유 기간 검토 게이트 필요.
 * 후보(미확정): `users/{uid}/experimentEvents` (90일 TTL) 또는 Functions → 분석 저장소.
 * **접근**: 운영·분석 역할만. 원시 이벤트는 실험 참가 uid 범위로 제한.
 *
 * 금지: 좌표·주소·이메일·BLE 주소·장치 표시명. uid 는 서버 측 적재 시에만 연결(페이로드 제외).
 */

export type RideReturnExperimentEventName =
  | "ride_summary_viewed"
  | "ride_summary_resolved"
  | "next_ride_selected";

export type RideSummaryResolvedReason =
  | "close"
  | "extend_from_end"
  | "save_adhoc"
  | "dismiss_adhoc";

export type NextRideSelectionKind =
  | "resume_route"
  | "extend_from_anchor"
  | "show_on_map"
  | "dismiss";

export type RideSummaryViewedPayload = {
  recordId: string;
  serverRideId: string | null;
  hasRoute: boolean;
  routeCompleted: boolean;
};

export type RideSummaryResolvedPayload = {
  recordId: string;
  serverRideId: string | null;
  reason: RideSummaryResolvedReason;
};

export type NextRideSelectedPayload = {
  rideId: string;
  targetKind: NextRideTarget["kind"];
  selection: NextRideSelectionKind;
};

export type RideReturnExperimentPayload =
  | RideSummaryViewedPayload
  | RideSummaryResolvedPayload
  | NextRideSelectedPayload;

export type RideReturnExperimentEvent = {
  name: RideReturnExperimentEventName;
  atMs: number;
  payload: RideReturnExperimentPayload;
};

/** 계약 테스트·후속 sink 교체용 */
export type RideReturnExperimentSink = (event: RideReturnExperimentEvent) => void;

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "lng",
  "lat",
  "lngLat",
  "latitude",
  "longitude",
  "email",
  "address",
  "placeLabel",
  "anchorPlaceLabel",
  "sessionEndPlaceLabel",
  "endPlaceLabel",
  "deviceLabel",
  "deviceId",
  "bleAddress",
  "uid",
  "userId",
]);

function defaultSink(event: RideReturnExperimentEvent): void {
  if (import.meta.env.DEV) {
    console.info("[ride-return-experiment]", event.name, event.payload);
  }
}

let sink: RideReturnExperimentSink = defaultSink;

export function setRideReturnExperimentSink(next: RideReturnExperimentSink | null): void {
  sink = next ?? defaultSink;
}

/** 페이로드에 PII·좌표 키가 없는지 검사 — 계약 테스트·런타임 가드 */
export function assertRideReturnExperimentPayloadSafe(
  payload: Record<string, unknown>,
): void {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(key)) {
      throw new Error(`ride-return-experiment: forbidden payload key "${key}"`);
    }
    const value = payload[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      assertRideReturnExperimentPayloadSafe(value as Record<string, unknown>);
    }
  }
}

export function emitRideReturnExperimentEvent(
  name: RideReturnExperimentEventName,
  payload: RideReturnExperimentPayload,
): void {
  assertRideReturnExperimentPayloadSafe(payload as unknown as Record<string, unknown>);
  sink({ name, atMs: Date.now(), payload });
}

export function buildRideSummaryViewedPayload(result: RideEndResult): RideSummaryViewedPayload {
  return {
    recordId: result.recordId,
    serverRideId: result.serverRideId ?? null,
    hasRoute: result.hasRoute,
    routeCompleted: result.routeCompleted,
  };
}

export function buildRideSummaryResolvedPayload(
  result: RideEndResult,
  reason: RideSummaryResolvedReason,
): RideSummaryResolvedPayload {
  return {
    recordId: result.recordId,
    serverRideId: result.serverRideId ?? null,
    reason,
  };
}

export function buildNextRideSelectedPayload(
  rideId: string,
  targetKind: NextRideTarget["kind"],
  selection: NextRideSelectionKind,
): NextRideSelectedPayload {
  return { rideId, targetKind, selection };
}

export function trackRideSummaryViewed(result: RideEndResult): void {
  emitRideReturnExperimentEvent("ride_summary_viewed", buildRideSummaryViewedPayload(result));
}

export function trackRideSummaryResolved(
  result: RideEndResult,
  reason: RideSummaryResolvedReason,
): void {
  emitRideReturnExperimentEvent(
    "ride_summary_resolved",
    buildRideSummaryResolvedPayload(result, reason),
  );
}

export function trackNextRideSelected(
  rideId: string,
  targetKind: NextRideTarget["kind"],
  selection: NextRideSelectionKind,
): void {
  emitRideReturnExperimentEvent(
    "next_ride_selected",
    buildNextRideSelectedPayload(rideId, targetKind, selection),
  );
}

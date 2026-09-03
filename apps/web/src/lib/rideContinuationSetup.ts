import {
  DISTANCE_AUTO_ROUTE_KM_MAX,
  DISTANCE_AUTO_ROUTE_KM_MIN,
  DISTANCE_AUTO_ROUTE_KM_STEP,
} from "./distanceAutoRouteErrors";
import type { LngLat } from "./geo";
import type { RouteProfile } from "../services/mapboxDirections";

/**
 * 「이어 달리기」 진입 시의 Route 작업대 초기 상태 — **단일 계약**.
 *
 * 진입점은 둘이다(결과 시트 「지금 새 경로 연결」 · 「다음 주행」 카드 「이 지점에서 새 경로」).
 * 둘이 같은 핸들러를 부르더라도, 그 핸들러가 **무엇을 보장하는지**가 코드 여기저기에
 * 흩어져 있으면 한쪽만 조용히 어긋난다 — 2026-09-03 폰 실사용 결함 ④⑤가 그것이었다
 * (거리 모드 해제 · 이동수단 자동차 · End 가 이미 찍힘).
 *
 * 그래서 보장을 이 순수 함수 하나에 모으고 시험으로 고정한다.
 *
 * ## 승계 우선순위
 *
 * 1. **직전 Ride 기록** — 방금 끝난 주행이 무엇이었는지가 가장 정확하다. 새로고침에도 남는다.
 * 2. **거리 세션 선호** — 같은 페이지 세션에서 마지막으로 arm 된 값.
 * 3. **현재 화면 상태** — 위 둘이 비었을 때의 최후 수단.
 *
 * 3번이 1·2번보다 먼저 쓰이면 안 된다. 세션 ref 의 초기값(`driving` · 10 km)이 그대로
 * 승계돼 「자전거 0.5 km 주행 뒤 자동차 10 km」가 되는 것이 결함 ④의 모습이었다.
 */
export type RideContinuationSetup = {
  /** Start = 직전 종점. 고정한다. */
  startLngLat: LngLat;
  /** End 는 **항상 비운다** — 이전 결합 상태를 끌고 오지 않는다. */
  endLngLat: null;
  /** 거리·방향 자동 Route 모드를 **항상 켠다** */
  distanceModeOn: true;
  /** 승계된 이동수단 */
  profile: RouteProfile;
  /** 승계된 목표 거리(km) — 슬라이더 범위·눈금에 맞춰 정규화된 값 */
  targetKm: number;
  /** 어느 순위에서 왔는지 — 진단·시험용 */
  profileSource: "lastRide" | "sessionPrefs" | "current";
  targetKmSource: "lastRide" | "sessionPrefs" | "current";
};

export type RideContinuationInput = {
  anchorLngLat: LngLat;
  /** 1순위 — 방금 끝난 주행 */
  lastRide?: {
    profile?: RouteProfile | null;
    /** 그 주행이 달린 Route 의 전장(m) */
    routeDistanceMeters?: number | null;
  } | null;
  /** 2순위 — 이 페이지 세션의 마지막 거리 세션 선호 */
  sessionPrefs?: {
    profile?: RouteProfile | null;
    targetKm?: number | null;
  } | null;
  /** 3순위 — 지금 화면 값 */
  currentProfile: RouteProfile;
  currentRouteDistanceMeters: number;
};

const VALID_PROFILES: readonly RouteProfile[] = ["cycling", "walking", "driving"];

function normalizeProfile(v: unknown): RouteProfile | null {
  return typeof v === "string" && (VALID_PROFILES as readonly string[]).includes(v)
    ? (v as RouteProfile)
    : null;
}

/**
 * 목표 거리(km)를 슬라이더가 실제로 취할 수 있는 값으로 정규화한다.
 * 눈금에 맞추고 범위로 clamp — `armDirectionPick` 의 검증에 걸려 거리 모드가 통째로
 * 꺼지는 일이 없게 한다(그 실패가 결함 ④의 형태였다).
 */
export function normalizeContinuationTargetKm(km: unknown): number | null {
  const n = Number(km);
  if (!Number.isFinite(n) || n <= 0) return null;
  const snapped = Math.round(n / DISTANCE_AUTO_ROUTE_KM_STEP) * DISTANCE_AUTO_ROUTE_KM_STEP;
  const clamped = Math.min(
    DISTANCE_AUTO_ROUTE_KM_MAX,
    Math.max(DISTANCE_AUTO_ROUTE_KM_MIN, snapped),
  );
  // 0.5 눈금이라 부동소수 잡음이 남는다 — 소수 첫째 자리에서 끊는다.
  return Math.round(clamped * 10) / 10;
}

export function resolveRideContinuationSetup(
  input: RideContinuationInput,
): RideContinuationSetup {
  const lastRideProfile = normalizeProfile(input.lastRide?.profile);
  const sessionProfile = normalizeProfile(input.sessionPrefs?.profile);
  const profile = lastRideProfile ?? sessionProfile ?? input.currentProfile;
  const profileSource: RideContinuationSetup["profileSource"] = lastRideProfile
    ? "lastRide"
    : sessionProfile
      ? "sessionPrefs"
      : "current";

  const lastRideKm = normalizeContinuationTargetKm(
    input.lastRide?.routeDistanceMeters != null
      ? input.lastRide.routeDistanceMeters / 1000
      : null,
  );
  const sessionKm = normalizeContinuationTargetKm(input.sessionPrefs?.targetKm);
  const currentKm =
    normalizeContinuationTargetKm(input.currentRouteDistanceMeters / 1000) ??
    DISTANCE_AUTO_ROUTE_KM_MIN;
  const targetKm = lastRideKm ?? sessionKm ?? currentKm;
  const targetKmSource: RideContinuationSetup["targetKmSource"] = lastRideKm
    ? "lastRide"
    : sessionKm
      ? "sessionPrefs"
      : "current";

  return {
    startLngLat: input.anchorLngLat,
    endLngLat: null,
    distanceModeOn: true,
    profile,
    targetKm,
    profileSource,
    targetKmSource,
  };
}

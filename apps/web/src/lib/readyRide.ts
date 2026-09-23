/** Ready Ride — 지시02(20260923). 방위 자동 · 폐합(출발=도착) · 기본 3km. */

/** 거리 선택 칩 — 기본 3km(E3), 2/5/10 도 고른다. 5~10km 를 기본으로 두지 않는다. */
export const READY_RIDE_DISTANCE_KM_OPTIONS: readonly number[] = [2, 3, 5, 10];
export const READY_RIDE_DEFAULT_DISTANCE_KM = 3;

/** 8초를 넘기면 안내 문구를 바꾼다(취소는 계속 가능) */
export const READY_RIDE_SLOW_GENERATE_MS = 8000;

export const READY_RIDE_GENERATING_LABEL = "Ready Ride 만드는 중…";
export const READY_RIDE_SLOW_GENERATING_LABEL = "경로를 찾는 중입니다";

export function formatReadyRideDistanceLabel(km: number): string {
  return `${km} km`;
}

export function createReadyRideRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `ready_${crypto.randomUUID().replace(/-/g, "")}`
    : `ready_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

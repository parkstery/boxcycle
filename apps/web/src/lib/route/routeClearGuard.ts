/**
 * 지시93 — 주행 중(주행·일시정지)에는 경로를 지우지 않는다. 먼저 주행을 종료해야 한다.
 * 빌드 모드(PROD/DEV)와 무관 — `routeWorkspaceLock` 의 PROD 조건과는 별개의 규칙이다.
 */
export function isRouteClearBlockedByRide(rideStatus: string): boolean {
  return rideStatus !== "idle";
}

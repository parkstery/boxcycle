/**
 * 프로덕션 빌드에서만, 주행 세션이 idle 이 아닐 때 경로 워크스페이스(메뉴·경로 계산·코스 전환 등)를 잠근다.
 * `vite` 개발 서버(`import.meta.env.DEV`)에서는 항상 false.
 */
export function lockRouteWorkspaceDuringRide(sessionNotIdle: boolean): boolean {
  return import.meta.env.PROD && sessionNotIdle;
}

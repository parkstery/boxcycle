/**
 * 월드 활동 폴링 주기 — **activity 소유**.
 *
 * 왜 여기로 왔나 (Phase 5 D6) — 이 값들은 `rideSyncPolicy` 에 있었다. 그래서 활동
 * 폴링 정책이 주행 동기 정책을 올려다봤고(`activity → ride`), 한때 `activityWorldLod`
 * ↔ `rideSyncPolicy` 순환(R9)이 자란 것도 같은 뿌리다.
 *
 * **값은 옮기면서 바꾸지 않았다**(G5 로 전수 대조).
 */

/** WO-A adaptive — live activity 있음 active */
export const ACTIVITY_WORLD_POLL_ACTIVE_MS = 60_000;

/** WO-A adaptive — live 없음 idle */
export const ACTIVITY_WORLD_POLL_IDLE_MS = 600_000;

/** 주행 종료 후 peer 완주·heat 반영 대기 — active poll 유지 */
export const ACTIVITY_WORLD_POST_RIDE_WATCH_MS = 900_000;

/** routeActivity 세션 캐시 TTL — 주행 중 폴링 주기와 같게. 더 짧게 잡지 않는다. */
export const ROUTE_ACTIVITY_CACHE_TTL_MS = ACTIVITY_WORLD_POLL_ACTIVE_MS;

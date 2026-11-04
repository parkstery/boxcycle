/**
 * Trail 라이브 주행의 **수명·표시 시간** — Trail 소유.
 *
 * 2026-09-26 (Phase 6-D5): `ride/rideSyncPolicy` 에서 **값 그대로** 옮겨 왔다.
 * 소유권은 이미 정해져 있었다 — `peerMotion/peerSyncPolicy` 가 헤더에 이렇게 적어 두었다:
 * 「여기 없는 것: `PEER_LIVE_RIDE_*`(Trail 의 라이브 주행 수명 — `trail/` 소유)」.
 * **결정만 있고 옮기지는 않았고**, 그래서 Trail 저장소가 주행 도메인을 올려다봤다.
 *
 * Phase 5 선례대로 **호환 re-export 를 두지 않는다** — 경유가 남으면 결합이 그대로 산다.
 */

/**
 * Trail 멤버 하트비트 — 포그라운드(탭 숨김 시 구독 자체 해제로 백그라운드 쓰기 없음).
 * 비용 L9: 30→60초. 「살아 있음」 240초 안에 네 번 온다.
 */
export const TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS = 60_000;

/**
 * Trail 문서 활동 시각·Listing 재계산의 최소 간격(비용 L9). 하트비트 두 번에 한 번 나가도록
 * 120초보다 살짝 짧다 — 120초로 두면 타이머 오차로 한 번 건너뛰어 180초가 된다.
 * 서버 sweeper 기준(`functions` `OPEN_TRAIL_LISTING_STALE_MS` 240초)보다 짧아야 달리는 Trail 이 목록에서 안 사라진다.
 */
export const TRAIL_ACTIVITY_TOUCH_MIN_INTERVAL_MS = 110_000;

/** 동행 peer 맵 hide — Firestore lastSeenAt (4s FS heartbeat + jitter 여유) */
export const PEER_LIVE_RIDE_STALE_MS = 15_000;

/**
 * **관전자**(RTDB 를 받지 않는 세계 지도·Trail 관전) 맵 hide 기준.
 * 비용 L4: 송신자 RTDB 가 정상이면 FS 하트비트가 12초다(`TRAIL_LIVE_PROGRESS_HEARTBEAT_RTDB_HEALTHY_MS`).
 * 15초면 지연 한 번에 깜빡인다 → 12초 × 2 + 여유. 같은 Trail 동행은 RTDB 판정이 있어 15초 그대로.
 */
export const SPECTATOR_LIVE_RIDE_STALE_MS = 30_000;

/** rAF speed 적분 상한 — hide 보다 짧게 두지 않음 */
export const PEER_LIVE_RIDE_EXTRAP_MAX_MS = 12_000;

/** 완주 final burst 후 peer 가 최종 위치를 유지하는 시간 */
export const PEER_LIVE_RIDE_COMPLETED_VISIBLE_MS = 15_000;

/** 완주 final burst — Firestore 삭제 전 대기 */
export const PEER_LIVE_RIDE_FINAL_BURST_MS = 3_000;

/** @deprecated {@link PEER_LIVE_RIDE_EXTRAP_MAX_MS} */
export const PEER_SPEED_EXTRAP_MAX_MS = PEER_LIVE_RIDE_EXTRAP_MAX_MS;

/*
 * 2026-09-26 (Phase 6-D6): 아래 셋은 `trail/repo/firestoreTrail.ts` 에서 옮겨 왔다.
 * presence 가 「살아 있는가」를 정하는 **정책**이지 저장소가 아니다 — 그런데 저장소에
 * 있었기 때문에 `ride/repo` 둘이 Trail 저장소를 import 하고 있었다.
 * Phase 5 가 `lastSeenAtToMillis` 에서 본 것과 같은 모양이다.
 */

/** Trail presence 가 「살아 있다」고 보는 시간 */
export const TRAIL_PRESENCE_STALE_MS = 240_000;

/** presence lastSeenAt 갱신 주기 (탭 절전·백그라운드 대비) */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 12_000;

/** lastSeenAt 이 없으면 **방금 들어온 것으로 본다**(종전 동작 그대로) */
export function isMemberRecentlySeen(lastSeenAtMs: number | null): boolean {
  if (lastSeenAtMs == null) return true;
  return Date.now() - lastSeenAtMs < TRAIL_PRESENCE_STALE_MS;
}

export const isTrailMemberActive = isMemberRecentlySeen;

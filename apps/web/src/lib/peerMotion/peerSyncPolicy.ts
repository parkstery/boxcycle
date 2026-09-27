/**
 * 동행 peer 전송·보간 상수 — **peerMotion 소유**.
 *
 * 왜 여기로 왔나 (Phase 5 D6) — 이 값들은 `rideSyncPolicy` 에 있었다. 그래서
 * **전송 계층이 주행 도메인을 올려다보는** 구조가 됐다. peerMotion 은 Ride 가 쓰는
 * **기계(전송)** 이지 Ride 위에 있는 것이 아니다. 방향을 바로잡으려면 peerMotion 이
 * 쓰는 상수는 peerMotion 이 가져야 한다.
 *
 * **값은 옮기면서 하나도 바꾸지 않았다.** 이동 전후로 수치 export 를 전수 대조했다
 * (Phase 5-4 에서 세운 G5 규율 — 상수가 조용히 달라지면 폴링·보간이 멈추거나 폭주한다).
 *
 * 여기 없는 것: `PEER_LIVE_RIDE_*`(Trail 의 라이브 주행 수명 — `trail/` 소유),
 * `PEER_MOTION_PUBLISH_INTERVAL_MS`(주행이 얼마나 자주 내보내는가 — `ride` 소유),
 * `MAP_PEER_SPRITE_MIN_ZOOM`(지도 표현 — 그대로 둔다).
 */

/** 보간 버퍼 최대 길이(패킷 수) */
export const PEER_INTERP_BUFFER_MAX = 16;
/** 보간 지연(ms) — 이만큼 과거를 재생해 지터를 흡수한다 */
export const PEER_INTERP_DELAY_MS = 160;
/** 버퍼가 마르면 이 시간까지만 외삽한다(ms) */
export const PEER_INTERP_MAX_EXTRAP_MS = 1_200;
/** 시뮬레이션 주행에서 peer 를 유예하는 시간(ms) */
export const PEER_DRIVE_SIM_GRACE_MS = 10_000;

/** motion 비행(publish flight) 배수 종료 대기(ms) */
export const MOTION_FLIGHT_DRAIN_TIMEOUT_MS = 2_000;
/** route 비행(publish flight) 배수 종료 대기(ms) */
export const ROUTE_FLIGHT_DRAIN_TIMEOUT_MS = 2_000;

/** 관전 시 마지막 패킷 이후 외삽 상한(ms) */
export const SPECTATOR_MAX_EXTRAP_MS = 3_000;

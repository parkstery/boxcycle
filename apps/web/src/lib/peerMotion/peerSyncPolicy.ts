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
/**
 * 보간 지연의 **하한**(ms) — 이만큼 과거를 재생해 지터를 흡수한다.
 *
 * ⚠️ 이 값 하나만 쓰면 보간이 성립하지 않는다. 지연이 **도착 간격보다 짧으면** 재생
 * 시점이 늘 최신 스냅샷보다 앞서서, 코드가 보간이 아니라 **외삽 후 스냅**으로 동작한다.
 * 2026-09-27 계측(등속 5.00 m/s 송신, 제품 코드 그대로):
 *
 *     도착 200ms  → 외삽 프레임 17.7%  화면속도 -0.40 ~ 6.67 m/s
 *     도착 1000ms → 외삽 프레임 83.4%  화면속도 -42.6 ~ 49.2 m/s
 *     도착 3000ms → 외삽 프레임 94.5%  화면속도  0.00 ~ 493.8 m/s
 *
 * 음수는 **뒤로 가는 것**이다. 간격을 좁힐수록 나아진 이유가 이것이고, 그래서 비용이
 * 늘었다. 지연은 도착 간격을 따라가야 한다 — {@link peerRenderDelayMs}.
 */
export const PEER_INTERP_DELAY_MS = 160;

/**
 * 보간 지연의 상한(ms). 지연은 곧 **동행이 뒤처져 보이는 시간**이므로 무한정 늘릴 수 없다.
 * 3초를 넘기면 나란히 달리는 느낌이 깨진다 — 그보다 긴 간격은 지연이 아니라
 * 발행 간격 자체를 다시 봐야 한다.
 */
export const PEER_INTERP_DELAY_MAX_MS = 3_000;

/**
 * 지연 = 도착 간격 × 이 배수. 2.0 이면 한 패킷만 늦어도 버퍼가 마른다.
 * 여유 한 칸을 더 둬 2.2 로 잡는다.
 */
export const PEER_INTERP_DELAY_GAP_FACTOR = 2.2;

/** 도착 간격 추정의 평활 계수 — 한 번 늦은 패킷에 지연이 출렁이지 않게 한다. */
export const PEER_ARRIVAL_GAP_EMA = 0.2;

/**
 * 재생 시계가 목표 지연을 따라잡는 **최대 속도 배율**.
 *
 * ⚠️ 재생 시점을 `지금 − 지연` 으로 매 프레임 다시 계산하면 안 된다. 지연이 조금만 바뀌어도
 * 재생 시점이 통째로 옮겨가 화면이 그만큼 **순간이동**한다(2026-09-27, 적응형 지연을 넣자마자
 * 13 m/s 튐으로 나타났다). 재생 시계는 실시간으로 흐르게 두고, 어긋난 만큼만 조금씩 당긴다.
 *
 * 0.1 = 실제 시간의 ±10% 빠르거나 느리게. 사람 눈에는 보이지 않고, 1초 어긋난 것을
 * 10초에 걸쳐 따라잡는다.
 */
export const PEER_RENDER_CLOCK_CATCHUP_RATE = 0.1;

/** 이만큼 어긋나면 천천히 따라잡기를 포기하고 즉시 맞춘다(ms) — 탭 복귀·긴 정지 뒤. */
export const PEER_RENDER_CLOCK_RESYNC_MS = 5_000;
/** 버퍼가 마르면 이 시간까지만 외삽한다(ms) */
export const PEER_INTERP_MAX_EXTRAP_MS = 1_200;
/** 시뮬레이션 주행에서 peer 를 유예하는 시간(ms) */
export const PEER_DRIVE_SIM_GRACE_MS = 10_000;

/**
 * motion 좌표를 **동시에 몇 개까지** 보낼 수 있나.
 *
 * 왜 1 이 아닌가 (2026-09-27) — 종전에는 앞 쓰기가 끝나야 다음을 보냈다. 그래서
 * 100ms 마다 보내려 해도 **실제 도착 간격은 왕복 시간에 묶였다**: 실측 `writeRttMs=137`,
 * `publishQueueMs=70` → 약 200ms. 보내려던 10Hz 가 실제로는 5Hz 였다.
 *
 * 도착 간격은 곧 보간 지연이다(간격 × 2.2). 겹쳐 보내면 간격이 절반이 되고
 * **동행이 뒤처져 보이는 시간도 절반**이 된다.
 *
 * 순서는 안전하다 — RTDB 는 한 클라이언트가 보낸 쓰기를 **보낸 순서대로** 적용한다.
 * 받는 쪽도 거리가 뒤로 가는 패킷을 버린다(`discard-retrograde`).
 *
 * ⚠️ 이 값은 **지연을 줄이는 손잡이가 아니라 막힌 것을 뚫는 값**이다. 발행 빈도 자체는
 * `PEER_MOTION_PUBLISH_INTERVAL_MS`(ride 소유)가 정한다. 전송량을 줄이려면 그쪽을 넓혀라
 * — 보간이 제대로 도는 지금은 넓혀도 튀지 않는다.
 */
export const MOTION_MAX_IN_FLIGHT = 2;

/** motion 비행(publish flight) 배수 종료 대기(ms) */
export const MOTION_FLIGHT_DRAIN_TIMEOUT_MS = 2_000;
/** route 비행(publish flight) 배수 종료 대기(ms) */
export const ROUTE_FLIGHT_DRAIN_TIMEOUT_MS = 2_000;

/** 관전 시 마지막 패킷 이후 외삽 상한(ms) */
export const SPECTATOR_MAX_EXTRAP_MS = 3_000;

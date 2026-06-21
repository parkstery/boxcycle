import type { LngLat } from "./geo";

/** 동행 라이브 좌표 Firestore 저장 시 소수점(LOD 중간층 — 정밀 5~6자리 대신) */
export const LIVE_SHARE_COORD_DECIMALS = 3;

/** 동행 라이브 위치: 최소 간격(ms) — 장거리 주행 시 쓰기 완화(§4.3) */
export const LIVE_SHARE_MIN_WRITE_INTERVAL_MS = 4_000;

/** 동행 라이브 위치: 이 시간이 지나면 이동이 없어도 1회 동기화 */
export const LIVE_SHARE_MAX_WRITE_INTERVAL_MS = 12_000;

/** 동행 라이브 위치: 직전 기록 대비 이 거리(m) 이상 움직였을 때 쓰기 */
export const LIVE_SHARE_MIN_MOVE_METERS = 60;

/** 동행 라이브 위치: 진행률 변화가 이 비율 이상일 때 쓰기(0.01 = 1%p) */
export const LIVE_SHARE_MIN_PROGRESS_DELTA = 0.01;

/** 코스 멤버 presence 하트비트 — 실제 주행 중(포그라운드) */
export const COURSE_PRESENCE_HEARTBEAT_ACTIVE_MS = 24_000;

/** 일시정지 등 비주행이지만 코스에 남아 있을 때 — 생존 신호만 저빈도 */
export const COURSE_PRESENCE_HEARTBEAT_PAUSED_MS = 180_000;

/** Trail 멤버 하트비트 — 포그라운드(탭 숨김 시 구독 자체 해제로 백그라운드 쓰기 없음) */
export const TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS = 30_000;

/** Trail `livePublicationRides` 진행률: 최소 쓰기 간격 */
export const TRAIL_LIVE_PROGRESS_MIN_WRITE_MS = 2_500;

/** Trail `livePublicationRides` 진행률: 최대 간격(강제 1회 플러시) */
export const TRAIL_LIVE_PROGRESS_MAX_WRITE_MS = 8_000;

/** Trail `livePublicationRides`: 진행률 변화가 이 값 이상일 때만 의미 있는 변화로 간주 */
export const TRAIL_LIVE_PROGRESS_MIN_DELTA = 0.005;

/** Trail `livePublicationRides`: geometry 거리(m) 변화가 이 값 이상일 때 publish */
export const TRAIL_LIVE_PROGRESS_MIN_DIST_DELTA_M = 1.5;

/** 동행 peer 외삽 — 샘플 간격 속도 미상일 때 가정 km/h (가상 주행 기본) */
export const PEER_EXTRAP_DEFAULT_SPEED_KMH = 5;

/** 입문 코스 동행 DOM 스프라이트 — 고줌에서만 (dot 은 global livePresence) */
export const MAP_PEER_SPRITE_MIN_ZOOM = 14;
/** 전역 livePresence: 최소 쓰기 간격(ms) */
export const GLOBAL_LIVE_PRESENCE_MIN_WRITE_INTERVAL_MS = 4_000;
/** 전역 livePresence: 이 시간이 지나면 이동 없어도 1회 동기화 */
export const GLOBAL_LIVE_PRESENCE_MAX_WRITE_INTERVAL_MS = 12_000;
/** 전역 livePresence: 직전 기록 대비 이 거리(m) 이상일 때 쓰기 */
export const GLOBAL_LIVE_PRESENCE_MIN_MOVE_METERS = 40;

/** 월드 힌트 HUD: 이 줌 이하에서만 표시(맵 축소 시) */
export const MAP_ZOOM_WORLD_ACTIVITY_MAX = 9;

/** @see `activityWorldLod` — LOD 라인 전환 줌(enter/exit) */
export {
  MAP_ZOOM_ACTIVITY_WORLD_LINE_ENTER_MIN,
  MAP_ZOOM_ACTIVITY_WORLD_LINE_EXIT_MIN,
  MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN,
} from "./activityWorldLod";

/** WO-A adaptive — live activity 있음 active */
export const ACTIVITY_WORLD_POLL_ACTIVE_MS = 60_000;

/** WO-A adaptive — live 없음 idle */
export const ACTIVITY_WORLD_POLL_IDLE_MS = 600_000;

/**
 * @deprecated WO-A `ACTIVITY_WORLD_POLL_*` adaptive 사용. 호환 alias(active).
 */
export const WORLD_PRESENCE_POLL_MS = ACTIVITY_WORLD_POLL_ACTIVE_MS;

/**
 * @deprecated WO-A `ACTIVITY_WORLD_POLL_*` adaptive 사용. 호환 alias(active).
 */
export const COURSE_ACTIVITY_POLL_MS = ACTIVITY_WORLD_POLL_ACTIVE_MS;

export function roundLngLatForLiveShare(lngLat: LngLat, decimals = LIVE_SHARE_COORD_DECIMALS): LngLat {
  const f = 10 ** decimals;
  return [Math.round(lngLat[0] * f) / f, Math.round(lngLat[1] * f) / f];
}

const EARTH_RADIUS_M = 6_371_000;

/** 두 좌표 간 대원 거리(m), 근사 */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const dp = p2 - p1;
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

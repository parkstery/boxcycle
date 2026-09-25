import { ACTIVITY_WORLD_POLL_ACTIVE_MS } from "../activity/activityWorldPollConstants";

import type { LngLat } from "../geo/geo";

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

/** Trail `livePublicationRides` — 1Hz 절대 dist+speed 하트비트 (수신 측 보간용) */
export const TRAIL_LIVE_PROGRESS_HEARTBEAT_MS = 1_000;



/** RTDB `/trails/{trailId}/motion/{uid}` — 10Hz motion publish (지연↓: 보간 delay 를 낮추려면 틱레이트↑) */
export const PEER_MOTION_PUBLISH_INTERVAL_MS = 100;

/** @deprecated heartbeat 와 동일 — 호환 alias */
export const TRAIL_LIVE_PROGRESS_MIN_WRITE_MS = TRAIL_LIVE_PROGRESS_HEARTBEAT_MS;

/** @deprecated heartbeat 와 동일 — 호환 alias */
export const TRAIL_LIVE_PROGRESS_MAX_WRITE_MS = TRAIL_LIVE_PROGRESS_HEARTBEAT_MS;

/** 동행 peer 맵 hide — Firestore lastSeenAt (1Hz + jitter 여유) */
export const PEER_LIVE_RIDE_STALE_MS = 15_000;

/** rAF speed 적분 상한 — hide 보다 짧게 두지 않음 */
export const PEER_LIVE_RIDE_EXTRAP_MAX_MS = 12_000;


/** R2 — auth vs display 오차 이내면 pull 없음 (구 anchor soft correct) */
export const PEER_RECONCILE_SOFT_M = 3.5;

/** R2 — 이 이상이면 hard pull (snap 금지) */
export const PEER_RECONCILE_HARD_M = 28;

/** R2 — soft 구간 pull 속도 (m/s) */
export const PEER_RECONCILE_SOFT_PULL_MPS = 2.2;

/** R2 — hard 구간 pull 속도 (m/s) */
export const PEER_RECONCILE_HARD_PULL_MPS = 9;

/**
 * Entity interpolation — peer 를 "지금"이 아니라 `now - DELAY` 시점으로 렌더한다.
 * 받은 스냅샷 사이를 보간(추측 없음)하므로 가속/감속 고무줄·지연이 없다.
 * DELAY 는 publish 간격(RTDB 10Hz=100ms)+지터를 덮을 만큼: 한 스냅샷 앞을 항상 확보.
 */



/** 완주 final burst 후 peer 가 최종 위치를 유지하는 시간 */
export const PEER_LIVE_RIDE_COMPLETED_VISIBLE_MS = 15_000;

/** 완주 final burst — Firestore 삭제 전 대기 */
export const PEER_LIVE_RIDE_FINAL_BURST_MS = 3_000;

/** @deprecated {@link PEER_LIVE_RIDE_EXTRAP_MAX_MS} */
export const PEER_SPEED_EXTRAP_MAX_MS = PEER_LIVE_RIDE_EXTRAP_MAX_MS;

/** Trail `livePublicationRides`: 진행률 변화가 이 값 이상일 때만 의미 있는 변화로 간주 */
export const TRAIL_LIVE_PROGRESS_MIN_DELTA = 0.005;

/** Trail `livePublicationRides`: geometry 거리(m) 변화 — heartbeat 외 조기 publish 는 사용 안 함 */
export const TRAIL_LIVE_PROGRESS_MIN_DIST_DELTA_M = 0;

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

/*
 * LOD 라인 전환 줌 상수는 `activityWorldLod` 가 소유한다.
 * 종전에는 여기서 re-export 했으나 **저장소 밖 소비자가 하나도 없었고**, 그 한 줄이
 * `activityWorldLod ↔ rideSyncPolicy` 순환(구조 감사 R9)의 절반이었다.
 * 순환이 되살아나면 import 순서에 따라 상수가 `undefined` 가 되고, 값이 0·NaN 으로
 * 흘러 폴링이 멈추거나 폭주한다 — 그래서 여기에 다시 두지 않는다.
 */

/*
 * 월드 활동 폴링 주기는 `activityWorldPollConstants` 가 소유한다(D6).
 * 여기 있었기 때문에 활동 폴링 정책이 주행 동기 정책을 올려다봤고(`activity → ride`),
 * R9 순환이 자란 뿌리도 같았다.
 */

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

/*
 * `haversineMeters` 는 `geo.getDistanceMeters` 와 **수치적으로 같은 함수**였다(최대 상대차
 * 2e-12 — `asin` 과 `atan2` 표현 차이). 같은 계산을 세 곳에 두면 한쪽만 고쳐도 아무 에러가
 * 나지 않는다 — Claim 셀 ID 에서 이미 데인 자리다. `geo` 로 모았다.
 */

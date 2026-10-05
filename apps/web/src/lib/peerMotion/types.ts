import type { LngLat } from "../geo/geo";
import type { TrailLiveRidePhase } from "../trail/trailTypes";
import type { PeerSyncSnapshotCapture } from "./peerSyncSnapshotCapture";

export type PeerMotionPhase = TrailLiveRidePhase;

/**
 * `tSrv` 출처 — **수신 내부만**. wire/FS 필드 추가 금지.
 * - capture: 송신 캡처 순간의 추정 서버시각(권위 anchor)
 * - estimated: FS 폴백 연속용 수신 추정(권위 capture 를 덮지 않음)
 */
export type PeerMotionTimeQuality = "capture" | "estimated";

/** Transport → Registry (Firestore / RTDB 공통) */
export type PeerMotionPacket = {
  uid: string;
  publicationId: string;
  distM: number;
  speedMps: number;
  phase: PeerMotionPhase;
  /**
   * 레거시 송신 기기시각(wire `t`) 또는 수신축으로 정규화된 stamp.
   * 캡처 시각이 아니다 — 공통 표시는 `tSrv` 를 쓴다.
   */
  serverAtMs: number;
  /**
   * 서버축 시각(ms). capture 이면 wire 캡처, estimated 이면 FS 폴백 표시축.
   * 있으면 서버축 보간·공통 D. stamp 재정규화 금지.
   */
  tSrv?: number;
  /**
   * 수신 내부 — wire 에 실리지 않음.
   * 생략 + tSrv 있음 = capture 로 취급(구경로·RTDB decode).
   */
  tSrvQuality?: PeerMotionTimeQuality;
  /** DEV S3-DIAG 상관 ID */
  seq?: number;
};

/** 보간 타임라인용 위치 스냅샷 — recvAtMs(수신 측 시계)로 정렬 */
export type PeerMotionSnapshot = {
  distM: number;
  /** 수신 측 시계(Date.now) — 보간 타임라인 (clock skew 무관) */
  recvAtMs: number;
  /** 송신 t — 동일 패킷 재수신 dedup */
  serverAtMs: number;
  /**
   * **송신자가 좌표를 잡은 시각**(송신 측 시계). 보간 타임라인은 이것을 쓴다.
   * 읽을 수 없으면 null — 그때만 `recvAtMs` 로 내려간다.
   */
  srcAtMs: number | null;
  speedMps: number;
  phase: PeerMotionPhase;
  seq?: number;
};

/** Registry 내부 — entity interpolation. render 는 rAF step 에서만 갱신 */
export type PeerMotionEntity = {
  uid: string;
  label: string;
  publicationId: string;
  phase: PeerMotionPhase;
  /** 최신 속도 (페달 애니메이션·외삽 fallback) */
  speedMps: number;
  /** 위치 스냅샷 버퍼 (oldest → newest) */
  buffer: PeerMotionSnapshot[];
  /** 마지막 렌더 거리(m) — buildRenderFeatures 입력 */
  displayDistM: number;
  /** prune 용 */
  lastIngestLocalMs: number;
  /**
   * 패킷이 **실제로 도착하는 간격**의 평활 추정(ms). 0 은 아직 모름.
   * 보간 지연을 여기에 맞춘다 — 발행 주기가 아니라 도착 간격이어야 한다.
   * 단일 슬롯 발행은 왕복 시간만큼 직렬화되므로 둘이 크게 다르다(실측 10Hz 발행 → 약 200ms 도착).
   */
  arrivalGapMsEma: number;
  /**
   * 수신 시계 − 송신 시계(ms). 두 기기의 시계 차를 상쇄해 송신 시각을 내 시계로 옮긴다.
   * 최근 패킷 중 **가장 적게 지연된 것**을 기준으로 잡는다(= 오프셋의 running min).
   * `serverTimeline` 이면 0 — 버퍼가 이미 추정 서버축이다.
   */
  clockOffsetMs: number | null;
  /**
   * true: 버퍼 시각이 추정 서버 ms. render 는 commonNow−고정D.
   * false: 수신축 stamp + gap EMA 지연(구버전·FS-only).
   */
  serverTimeline: boolean;
  /**
   * **재생 시계**(내 시계 기준 ms) — 지금 화면에 그리는 시점.
   * 실시간으로 흐르며 목표 지연 쪽으로 조금씩만 당겨진다. `지금 − 지연` 을 매 프레임
   * 다시 계산하면 지연이 바뀔 때마다 화면이 순간이동한다.
   */
  renderClockMs: number | null;
  /** 재생 시계를 얼마나 흘릴지 재기 위한 직전 step 시각 */
  lastStepNowMs: number;
  /** render */
  hdg: number;
  phaseRev: number;
  pedalSpeedKmh: number;
};

export type PeerMotionStepContext = {
  routeLenM: number;
};

/*
 * 2026-09-26 (Phase 6-D): `ride/liveLocationSnapshot` 에서 **그대로** 옮겨 왔다.
 * 발행 쪽 페이로드 계약이라 두 publish flight(motion·route)가 읽는데, 전송이 주행을
 * 올려다보게 되어 있었다(D6 위반 2건). 타입의 자리를 바꿔 끊었다 — 순환·역방향은
 * 「어느 쪽이 상위인가」가 아니라 「그 타입이 왜 거기 있는가」로 끊긴다(Phase 5 §5).
 * 만드는 쪽(`buildLiveLocationSnapshot`)은 주행의 일이므로 ride 에 남는다.
 */
/** 단일 위치·진행률 스냅샷 — publish fan-out 의 단일 진실 */
export type LiveLocationSnapshot = {
  lngLat: LngLat;
  trailId: string;
  publicationId: string;
  progressRatio: number;
  /** geometry 위 주행 거리(m) — peer 표시·외삽용 */
  distMetersAlongRoute: number;
  routeReady: boolean;
  speedMps: number;
  routeRidePhase: "live" | "paused";
  /**
   * dist/speed 캡처 순간의 추정 서버시각(ms). encode 에서 재샘플하지 않는다.
   * offset 미준비면 생략 — 구 wire 호환.
   */
  tSrv?: number;
  /** DEV S3-DIAG-R2 — 스냅샷 생성 순간 동기 캡처. publish 페이로드에 넣지 않음 */
  diagCapture?: PeerSyncSnapshotCapture;
};

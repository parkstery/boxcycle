import type { TrailLiveRidePhase } from "../firestoreTrailLivePublicationRides";

export type PeerMotionPhase = TrailLiveRidePhase;

/** Transport → Registry (Firestore / RTDB 공통) */
export type PeerMotionPacket = {
  uid: string;
  publicationId: string;
  distM: number;
  speedMps: number;
  phase: PeerMotionPhase;
  serverAtMs: number;
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
  /** render */
  hdg: number;
  phaseRev: number;
  pedalSpeedKmh: number;
};

export type PeerMotionStepContext = {
  routeLenM: number;
};

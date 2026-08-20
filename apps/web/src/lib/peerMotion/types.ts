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

/** 보간 타임라인용 위치 스냅샷 — 축은 serverAtMs(가드 실패 시 recvAtMs) */
export type PeerMotionSnapshot = {
  distM: number;
  /** 수신 측 시계(Date.now) — 오프셋 EMA·serverAtMs 폴백 */
  recvAtMs: number;
  /** 송신 t — 보간 축. 0·비단조면 그 쌍은 recvAtMs 폴백 */
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
  /** EMA(recvAtMs − serverAtMs) — 송신 격자 보간용 */
  clockOffsetMs: number;
  /** live step 이 recvAtMs 로 폴백한 횟수 */
  serverAxisFallbackCount: number;
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

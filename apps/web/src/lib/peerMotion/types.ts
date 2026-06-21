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
};

/** Registry 내부 — render 는 rAF step 에서만 갱신 */
export type PeerMotionEntity = {
  uid: string;
  label: string;
  publicationId: string;
  phase: PeerMotionPhase;
  authDistM: number;
  speedMps: number;
  displayDistM: number;
  lastServerAtMs: number;
  lastIngestLocalMs: number;
  /** R2 — authDistM 쪽으로 m/s pull (0 = 연속 sim) */
  reconcilePullMps: number;
  /** render */
  hdg: number;
  phaseRev: number;
  pedalSpeedKmh: number;
};

export type PeerMotionStepContext = {
  routeLenM: number;
};

/**
 * S3-DIAG-R2 — 스냅샷 생성 순간 동기 캡처 (§2-2).
 * buildLiveLocationSnapshot 과 같은 스택에서만 기록한다.
 */

export type PeerSyncSnapshotCapture = {
  snapshotCapturedAt: number;
  authDistAtCapture: number;
  snapshotDistAtCapture: number;
  appliedKmh: number;
  targetKmh: number;
  routeLen: number;
  geoLen: number;
};

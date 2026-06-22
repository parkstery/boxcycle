import type { PeerMotionPacket } from "./types";

const SPEED_EPS_MPS = 0.02;

/**
 * RTDB 5Hz + Firestore 1Hz 필드 병합.
 * - distM: live 구간 전진은 max (추월·가속 위치 반영)
 * - speedMps·phase: 더 최신 serverAtMs 패킷
 * - serverAtMs: max (ingest stale 판정 완화)
 */
export function mergePeerMotionPackets(
  rtdb: PeerMotionPacket | null,
  fs: PeerMotionPacket | null,
): PeerMotionPacket | null {
  if (!rtdb) return fs;
  if (!fs) return rtdb;

  const rtdbMs = rtdb.serverAtMs > 0 ? rtdb.serverAtMs : 0;
  const fsMs = fs.serverAtMs > 0 ? fs.serverAtMs : 0;
  const newer = rtdbMs >= fsMs ? rtdb : fs;
  const older = newer === rtdb ? fs : rtdb;

  let distM = newer.distM;
  if (newer.phase === "live" && older.phase === "live") {
    distM = Math.max(newer.distM, older.distM);
  }

  let speedMps = newer.speedMps;
  if (
    newer.speedMps <= SPEED_EPS_MPS &&
    older.speedMps > SPEED_EPS_MPS &&
    Math.abs(rtdbMs - fsMs) <= 1_500
  ) {
    speedMps = older.speedMps;
  }

  return {
    uid: newer.uid,
    publicationId: newer.publicationId,
    distM,
    speedMps,
    phase: newer.phase,
    serverAtMs: Math.max(rtdbMs, fsMs),
  };
}

/** @deprecated {@link mergePeerMotionPackets} */
export function pickFresherPeerMotionPacket(
  a: PeerMotionPacket | null,
  b: PeerMotionPacket | null,
): PeerMotionPacket | null {
  return mergePeerMotionPackets(a, b);
}

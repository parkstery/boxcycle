import type { PeerMotionPacket } from "./types";

const SPEED_EPS_MPS = 0.02;
/** RTDB t 가 이보다 오래되면 Firestore speed 로 폴백 */
const RTDB_SPEED_STALE_MS = 2_500;

/**
 * RTDB 5Hz + Firestore 1Hz 필드 병합.
 * - distM: live 전진 max
 * - speedMps: RTDB 우선(5Hz), stale 시 Firestore
 * - serverAtMs: max
 */
export function mergePeerMotionPackets(
  rtdb: PeerMotionPacket | null,
  fs: PeerMotionPacket | null,
): PeerMotionPacket | null {
  if (!rtdb) return fs;
  if (!fs) return rtdb;

  const rtdbMs = rtdb.serverAtMs > 0 ? rtdb.serverAtMs : 0;
  const fsMs = fs.serverAtMs > 0 ? fs.serverAtMs : 0;

  let distM = rtdb.distM;
  if (rtdb.phase === "live" && fs.phase === "live") {
    distM = Math.max(rtdb.distM, fs.distM);
  }

  const rtdbFresh =
    rtdbMs > 0 && (Date.now() - rtdbMs <= RTDB_SPEED_STALE_MS || rtdbMs >= fsMs - 400);
  let speedMps = rtdb.speedMps;
  if (!rtdbFresh || rtdb.speedMps <= SPEED_EPS_MPS) {
    if (fs.speedMps > SPEED_EPS_MPS) speedMps = fs.speedMps;
  } else if (fsMs > rtdbMs + 800 && fs.speedMps > SPEED_EPS_MPS) {
    speedMps = fs.speedMps;
  }

  const phase = rtdbMs >= fsMs ? rtdb.phase : fs.phase;

  return {
    uid: rtdb.uid,
    publicationId: rtdb.publicationId,
    distM,
    speedMps,
    phase,
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

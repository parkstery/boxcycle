import type { PeerMotionPacket } from "./types";

const DIST_EPS_M = 0.2;
const SPEED_EPS_MPS = 0.02;

/** RTDB 5Hz vs Firestore 1Hz — 더 최신 패킷 선택 (동일 시 dist·speed 우선) */
export function pickFresherPeerMotionPacket(
  a: PeerMotionPacket | null,
  b: PeerMotionPacket | null,
): PeerMotionPacket | null {
  if (!a) return b;
  if (!b) return a;

  const aMs = a.serverAtMs > 0 ? a.serverAtMs : 0;
  const bMs = b.serverAtMs > 0 ? b.serverAtMs : 0;
  if (aMs !== bMs) return aMs > bMs ? a : b;

  if (a.phase === "live" && b.phase === "live" && Math.abs(a.distM - b.distM) > DIST_EPS_M) {
    return a.distM >= b.distM ? a : b;
  }

  if (Math.abs(a.speedMps - b.speedMps) > SPEED_EPS_MPS) {
    return a.speedMps >= b.speedMps ? a : b;
  }

  return a;
}

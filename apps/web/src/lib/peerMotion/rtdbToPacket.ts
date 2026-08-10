import type { RtdbTrailMotionRow } from "../rtdbTrailMotion";
import type { PeerMotionPacket } from "./types";

export function rtdbMotionRowToPeerMotionPacket(
  row: RtdbTrailMotionRow,
  publicationId: string,
): PeerMotionPacket | null {
  const pid = publicationId.trim();
  if (!pid || row.publicationId.trim() !== pid) return null;
  return {
    uid: row.uid,
    publicationId: pid,
    distM: row.distM,
    speedMps: row.speedMps,
    phase: row.ridePhase,
    serverAtMs: row.serverAtMs,
    ...(row.seq != null ? { seq: row.seq } : {}),
  };
}

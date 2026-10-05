import type { RtdbTrailMotionRow } from "./repo/rtdbTrailMotion";
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
    ...(typeof row.tSrv === "number" && Number.isFinite(row.tSrv) && row.tSrv > 0
      ? { tSrv: row.tSrv, tSrvQuality: "capture" as const }
      : {}),
    ...(row.seq != null ? { seq: row.seq } : {}),
  };
}

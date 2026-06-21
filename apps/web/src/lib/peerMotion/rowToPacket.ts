import type { TrailLivePublicationRideRow } from "../firestoreTrailLivePublicationRides";
import { progressRatioToRouteDistanceMeters } from "../liveLocationSnapshot";
import type { PeerMotionPacket } from "./types";

export function trailLiveRowToPeerMotionPacket(
  row: TrailLivePublicationRideRow,
  publicationId: string,
  routeLenM: number,
): PeerMotionPacket | null {
  const pid = publicationId.trim();
  if (!pid || row.publicationId.trim() !== pid) return null;

  let distM: number | null =
    typeof row.distMeters === "number" && Number.isFinite(row.distMeters)
      ? Math.max(0, row.distMeters)
      : null;
  if (distM == null && routeLenM > 0) {
    distM = progressRatioToRouteDistanceMeters(row.progressRatio, routeLenM);
  }
  if (distM == null) return null;

  return {
    uid: row.uid,
    publicationId: pid,
    distM,
    speedMps: typeof row.speedMps === "number" && Number.isFinite(row.speedMps) ? row.speedMps : 0,
    phase: row.ridePhase ?? "live",
    serverAtMs: row.lastSeenAtMs ?? 0,
  };
}

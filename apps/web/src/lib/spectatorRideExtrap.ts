import type { LineStringGeometry } from "./geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "./geo";
import type { TrailLivePublicationRideRow } from "./firestoreTrailLivePublicationRides";
import { progressRatioToRouteDistanceMeters } from "./liveLocationSnapshot";
import { peerSyncChainLog } from "./peerMotion/peerSyncChainLog";
import { SPECTATOR_MAX_EXTRAP_MS } from "./rideSyncPolicy";

export function anchorDistOnRoute(row: TrailLivePublicationRideRow, routeLen: number): number {
  if (typeof row.distMeters === "number" && Number.isFinite(row.distMeters)) {
    return Math.max(0, Math.min(routeLen, row.distMeters));
  }
  return progressRatioToRouteDistanceMeters(row.progressRatio, routeLen);
}

export function spectatorSpeedMps(row: TrailLivePublicationRideRow): number {
  if (row.ridePhase === "paused" || row.ridePhase === "completed") return 0;
  if (typeof row.speedMps === "number" && Number.isFinite(row.speedMps)) return Math.max(0, row.speedMps);
  return 0;
}

export function spectatorElapsedLocalMs(row: TrailLivePublicationRideRow, nowMs: number): number {
  const recv = row.receivedAtLocalMs;
  if (typeof recv !== "number" || !Number.isFinite(recv)) return 0;
  return Math.max(0, nowMs - recv);
}

export type SpectatorExtrapResult = {
  distM: number;
  anchorDistM: number;
  elapsedMs: number;
  extrapMs: number;
  capHit: boolean;
  speedMps: number;
};

export function extrapSpectatorDistM(
  row: TrailLivePublicationRideRow,
  geometry: LineStringGeometry,
  nowMs: number,
  opts?: { logPt10?: boolean; authDistM?: number | null },
): SpectatorExtrapResult | null {
  const len = lineStringLengthMeters(geometry);
  if (len <= 0) return null;
  const anchorDistM = anchorDistOnRoute(row, len);
  const elapsedMs = spectatorElapsedLocalMs(row, nowMs);
  const extrapMs = Math.min(elapsedMs, SPECTATOR_MAX_EXTRAP_MS);
  const capHit = elapsedMs > SPECTATOR_MAX_EXTRAP_MS;
  const speedMps = spectatorSpeedMps(row);
  const distM = Math.min(len, anchorDistM + speedMps * (extrapMs / 1000));

  if (opts?.logPt10 && import.meta.env.DEV) {
    const auth = opts.authDistM;
    const errM =
      auth != null && Number.isFinite(auth) ? Math.abs(distM - auth) : Number.NaN;
    peerSyncChainLog(10, null, {
      uid: row.uid.slice(0, 6),
      anchorDistM,
      distM,
      elapsedMs,
      extrapMs,
      capHit: capHit ? 1 : 0,
      speedMps,
      recvLocalMs: row.receivedAtLocalMs,
      errM: Number.isFinite(errM) ? errM : null,
    });
  }

  return { distM, anchorDistM, elapsedMs, extrapMs, capHit, speedMps };
}

export function spectatorPointOnRoute(
  row: TrailLivePublicationRideRow,
  geometry: LineStringGeometry,
  nowMs: number,
  opts?: { logPt10?: boolean; authDistM?: number | null },
) {
  const extrap = extrapSpectatorDistM(row, geometry, nowMs, opts);
  if (!extrap) return null;
  return getPointOnRouteByDistance(geometry, extrap.distM);
}

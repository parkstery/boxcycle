import type { LngLat } from "./geo";
import { getDistanceMeters, interpolatePoint } from "./geo";
import { estimateCrankRpmFromSpeedKmh } from "./riderPedalMotion";
import { PEER_RIDER_PEDAL_FRAME_COUNT } from "./registerPeerRiderPedalSprites";

export type MapPeerInput = { id: string; lngLat: LngLat; label?: string | null };

export type PeerDriveSimState = {
  target: LngLat;
  pos: LngLat;
  label: string;
  hdg: number;
  phaseRev: number;
  emaSpeedKmh: number;
  lastTargetMs: number;
};

const PEER_MAX = 30;
const LERP_TAU_SEC = 0.34;
const SPEED_EMA = 0.5;

export function mergePeerTargets(
  sim: Map<string, PeerDriveSimState>,
  peers: MapPeerInput[],
  nowMs: number,
): void {
  const targets = peers.slice(0, PEER_MAX);
  const seen = new Set<string>();
  for (const t of targets) {
    seen.add(t.id);
    const label = (t.label?.trim() || "동행").slice(0, 48);
    const cur = sim.get(t.id);
    if (!cur) {
      sim.set(t.id, {
        target: t.lngLat,
        pos: t.lngLat,
        label,
        hdg: 0,
        phaseRev: 0,
        emaSpeedKmh: 0,
        lastTargetMs: nowMs,
      });
      continue;
    }
    cur.label = label;
    const jumped = getDistanceMeters(cur.target, t.lngLat);
    if (jumped > 0.35) {
      const dtSec = Math.max(0.04, (nowMs - cur.lastTargetMs) / 1000);
      const instKmh = (jumped / dtSec) * 3.6;
      if (Number.isFinite(instKmh)) {
        cur.emaSpeedKmh =
          cur.emaSpeedKmh * (1 - SPEED_EMA) + Math.min(85, Math.max(0, instKmh)) * SPEED_EMA;
      }
      cur.target = t.lngLat;
      cur.lastTargetMs = nowMs;
    }
  }
  for (const id of [...sim.keys()]) {
    if (!seen.has(id)) sim.delete(id);
  }
}

export function stepPeerDriveAndBuildGeoJson(
  sim: Map<string, PeerDriveSimState>,
  dtSec: number,
  getBearing: (a: LngLat, b: LngLat) => number,
): {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: LngLat };
    properties: { id: string; label: string; pframe: number; hdg: number };
  }>;
} {
  const clampedDt = Math.min(0.12, Math.max(0, dtSec));
  const alpha = LERP_TAU_SEC > 0 ? 1 - Math.exp(-clampedDt / LERP_TAU_SEC) : 1;

  const features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: LngLat };
    properties: { id: string; label: string; pframe: number; hdg: number };
  }> = [];
  for (const [id, s] of sim) {
    s.pos = interpolatePoint(s.pos, s.target, alpha);
    const dist = getDistanceMeters(s.pos, s.target);
    if (dist > 1.2) {
      s.hdg = getBearing(s.pos, s.target);
    }
    const spd = s.emaSpeedKmh;
    if (spd > 0.38) {
      const rpm = estimateCrankRpmFromSpeedKmh(spd);
      s.phaseRev += (rpm / 60) * clampedDt;
    }
    const pframeRaw =
      spd > 0.38
        ? ((Math.floor((s.phaseRev % 1) * PEER_RIDER_PEDAL_FRAME_COUNT) % PEER_RIDER_PEDAL_FRAME_COUNT) +
            PEER_RIDER_PEDAL_FRAME_COUNT) %
          PEER_RIDER_PEDAL_FRAME_COUNT
        : 0;
    const pframe = Number.isFinite(pframeRaw) ? pframeRaw : 0;
    const hdg = Number.isFinite(s.hdg) ? s.hdg : 0;

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: s.pos },
      properties: {
        id,
        label: s.label,
        pframe,
        hdg,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

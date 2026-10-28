import type { Map as MapboxMap } from "mapbox-gl";
import type { LngLat } from "../../lib/geo/geo";

export const TERRAIN_GUARD_INTERVAL_MS = 250;
const BAD_FOR_MS = 750;
const GOOD_FOR_MS = 2500;
const FLAT_HOLD_MS = 4000;
const SETTLE_MS = 1000;
const DISPLAY_EXAGGERATION = 1.3;

/** Missing data is distinct from valid coastal/negative elevations. */
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export type TerrainHealth = "ready" | "missing" | "camera-obstructed";
type TerrainMap = Pick<MapboxMap, "queryTerrainElevation" | "getFreeCameraOptions" | "getCenter">;

/**
 * Read loaded DEM only, never fetch. In automatic 2D, terrain remains attached with
 * numeric exaggeration=0: query(exaggerated:false) still sees the real DEM.
 * Reconstruct the prospective 3D camera altitude relative to the map center.
 */
export function readRideTerrainHealth(map: TerrainMap, rider: LngLat | null, flat: boolean): TerrainHealth {
  try {
    if (!rider || !rider.every(finite)) return "missing";
    const position = map.getFreeCameraOptions().position;
    if (!position) return "missing";
    const camera = position.toLngLat();
    const altitude = position.toAltitude();
    const center = map.getCenter();
    const elevation = (p: { lng: number; lat: number }) => map.queryTerrainElevation(p, { exaggerated: false });
    const centerM = elevation(center);
    const riderM = elevation({ lng: rider[0], lat: rider[1] });
    if (![camera.lng, camera.lat, altitude, centerM, riderM].every(finite)) return "missing";
    const cameraM = altitude + (flat ? centerM! * DISPLAY_EXAGGERATION : 0);
    // Avoid a long camera-to-rider segment at the date line.
    const deltaLng = ((rider[0] - camera.lng + 540) % 360) - 180;
    for (const t of [0, 0.33, 0.66]) {
      const groundM = elevation({ lng: camera.lng + deltaLng * t, lat: camera.lat + (rider[1] - camera.lat) * t });
      if (!finite(groundM)) return "missing";
      const sightM = cameraM + (riderM! * DISPLAY_EXAGGERATION + 1.5 - cameraM) * t;
      if (sightM - groundM * DISPLAY_EXAGGERATION < 0.3) return "camera-obstructed";
    }
    return "ready";
  } catch {
    return "missing";
  }
}

/** Continuous-time hysteresis: one good/bad frame cannot change the mode. */
export class RideTerrainGuard {
  flat = true;
  private changedAt: number;
  private goodSince: number | null = null;
  private badSince: number | null = null;
  private lastAt: number | null = null;

  constructor(nowMs: number) { this.changedAt = nowMs; }

  update(nowMs: number, health: TerrainHealth): boolean {
    // Background tabs and a sleeping device must establish continuity again.
    if (this.lastAt != null && (nowMs < this.lastAt || nowMs - this.lastAt > 1000)) {
      this.goodSince = null;
      this.badSince = null;
    }
    this.lastAt = nowMs;
    if (nowMs - this.changedAt < SETTLE_MS) return this.flat;
    if (health === "ready") {
      this.badSince = null;
      this.goodSince ??= nowMs;
      if (this.flat && nowMs - this.changedAt >= FLAT_HOLD_MS && nowMs - this.goodSince >= GOOD_FOR_MS) {
        this.flat = false;
        this.changedAt = nowMs;
        this.goodSince = null;
      }
    } else {
      this.goodSince = null;
      this.badSince ??= nowMs;
      if (!this.flat && nowMs - this.badSince >= BAD_FOR_MS) {
        this.flat = true;
        this.changedAt = nowMs;
        this.badSince = null;
      }
    }
    return this.flat;
  }
}

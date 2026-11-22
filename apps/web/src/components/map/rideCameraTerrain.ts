import mapboxgl, { type Map as MapboxMap } from "mapbox-gl";
import { getDistanceMeters, type LngLat } from "../../lib/geo/geo";
import { rideTerrainScale } from "../../lib/map/rideTerrainScale";

// Keep the low racing view where it is already safe. Never lower the nominal camera.
const CAMERA_TERRAIN_CLEARANCE_M = 3;
const CAMERA_SIGHT_CLEARANCE_M = 0.6;
const RIDER_SIGHT_HEIGHT_M = 1.5;
// Include precisely the guard's 0/.33/.66 samples, plus the intervening ridge points.
export const CAMERA_SIGHT_SAMPLES = [0, 0.165, 0.33, 0.495, 0.66, 0.825, 0.9] as const;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Required upward displacement of a camera-to-rider sight line, in displayed meters. */
export function terrainCameraLiftM(
  cameraM: number,
  riderM: number,
  groundM: readonly number[],
): number | null {
  if (!finite(cameraM) || !finite(riderM) || groundM.length !== CAMERA_SIGHT_SAMPLES.length || !groundM.every(finite)) return null;
  let required = groundM[0]! + CAMERA_TERRAIN_CLEARANCE_M;
  for (let i = 1; i < CAMERA_SIGHT_SAMPLES.length; i++) {
    const t = CAMERA_SIGHT_SAMPLES[i]!;
    required = Math.max(required, (groundM[i]! + CAMERA_SIGHT_CLEARANCE_M - t * riderM) / (1 - t));
  }
  return Math.max(0, required - cameraM);
}

type LiftState = { liftM: number; at: number; slot: number };
const states = new WeakMap<object, LiftState>();
export function resetRideCameraTerrain(map: object): void { states.delete(map); }

/** Safety wins on ascent. Exponential descent cannot dip below the newly required lift. */
export function smoothTerrainCameraLift(previousM: number, requiredM: number, dtMs: number): number {
  if (requiredM >= previousM) return requiredM;
  return requiredM + (previousM - requiredM) * Math.exp(-Math.max(0, dtMs) / 1000);
}

/**
 * Called after the nominal jump, inside the same follow-camera write boundary.
 * Reads loaded DEM only. Missing data leaves the existing terrain guard in charge.
 * In automatic flat mode, use the same prospective 3D altitude as the guard.
 */
export function applyRideCameraTerrain(
  map: MapboxMap,
  rider: LngLat,
  slot: number | null | undefined,
  nowMs: number,
  screenAnchor = 0.6,
): void {
  if (slot !== 2 && slot !== 3) { resetRideCameraTerrain(map); return; }
  try {
    const terrain = map.getTerrain();
    if (!terrain) { resetRideCameraTerrain(map); return; }
    const camera = map.getFreeCameraOptions();
    const position = camera.position;
    if (!position) return;
    const ll = position.toLngLat();
    const actualM = position.toAltitude();
    const centerM = map.queryTerrainElevation(map.getCenter(), { exaggerated: false });
    const riderGroundM = map.queryTerrainElevation(rider, { exaggerated: false });
    if (![ll.lng, ll.lat, actualM, centerM, riderGroundM, ...rider].every(finite)) return;
    const flat = terrain.exaggeration === 0;
    const exaggeration = rideTerrainScale();
    // setTerrain updates the requested style before the renderer's elevation scale.
    // Do not mix old rendered camera coordinates with the new requested scale.
    const shownCenterM = map.queryTerrainElevation(map.getCenter(), { exaggerated: true });
    const expectedCenterM = flat ? 0 : centerM! * exaggeration;
    if (!finite(shownCenterM) || Math.abs(shownCenterM - expectedCenterM) > 0.01) return;
    const nominalM = actualM + (flat ? centerM! * exaggeration : 0);
    const riderM = riderGroundM! * exaggeration + RIDER_SIGHT_HEIGHT_M;
    const deltaLng = ((rider[0] - ll.lng + 540) % 360) - 180;
    const grounds = CAMERA_SIGHT_SAMPLES.map(t => {
      const value = map.queryTerrainElevation([ll.lng + deltaLng * t, ll.lat + (rider[1] - ll.lat) * t], { exaggerated: false });
      return finite(value) ? value * exaggeration : Number.NaN;
    });
    let required = terrainCameraLiftM(nominalM, riderM, grounds);
    if (required == null) return;
    const horizontalM = getDistanceMeters([ll.lng, ll.lat], rider);
    if (!(horizontalM > 0.1)) return;
    // Same FOV read/fallback used by rideCameraFraming's rider projection.
    const transform = (map as MapboxMap & { transform?: { fov?: number } }).transform;
    const fov = finite(transform?.fov) ? transform.fov : 36.87;
    const anchorAngle = Math.atan(2 * (screenAnchor - 0.5) * Math.tan(fov * Math.PI / 360));
    // A high rider must remain visible even at Mapbox's pitch limit.
    const maxSightPitch = Math.max(1, 85 - anchorAngle * 180 / Math.PI);
    required = Math.max(required, riderM + horizontalM / Math.tan(maxSightPitch * Math.PI / 180) - nominalM);
    const previous = states.get(map);
    const continuous = previous?.slot === slot && nowMs >= previous.at && nowMs - previous.at <= 1000;
    const liftM = continuous ? smoothTerrainCameraLift(previous.liftM, required, nowMs - previous.at) : required;
    states.set(map, { liftM, at: nowMs, slot });
    // Aim the rider at the established QC screen anchor. Preserving the nominal
    // ray is insufficient on slopes: the uncorrected rider can already be offscreen.
    const pitch = Math.atan2(horizontalM, nominalM + liftM - riderM) * 180 / Math.PI + anchorAngle * 180 / Math.PI;
    if (liftM < 0.001 && Math.abs(pitch - map.getPitch()) < 2) return;
    camera.position = mapboxgl.MercatorCoordinate.fromLngLat(ll, actualM + liftM);
    camera.setPitchBearing(Math.max(0, Math.min(85, pitch)), map.getBearing());
    map.setFreeCameraOptions(camera);
  } catch {
    // A style/DEM replacement must not abort the ride tick or force 3D back on.
  }
}

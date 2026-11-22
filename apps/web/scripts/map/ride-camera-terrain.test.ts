import assert from "node:assert/strict";
import { test } from "node:test";
import type { Map as MapboxMap } from "mapbox-gl";
import { applyRideCameraTerrain, CAMERA_SIGHT_SAMPLES, smoothTerrainCameraLift, terrainCameraLiftM } from "../../src/components/map/rideCameraTerrain.ts";
import { readRideTerrainHealth } from "../../src/components/map/rideTerrainGuard.ts";
import { applyFollowCameraJumpTo } from "../../src/components/map/rideCameraFollow.ts";
import { rideTerrainScale } from "../../src/lib/map/rideTerrainScale.ts";
import { isFollowCameraJump } from "../../src/components/map/followCameraJump.ts";

test("flat terrain keeps an already safe camera and raises a low camera to 3m", () => {
  assert.equal(terrainCameraLiftM(135, 131.5, CAMERA_SIGHT_SAMPLES.map(() => 130)), 0);
  assert.equal(terrainCameraLiftM(131, 131.5, CAMERA_SIGHT_SAMPLES.map(() => 130)), 2);
  assert.equal(terrainCameraLiftM(-4, -5, CAMERA_SIGHT_SAMPLES.map(() => -6)), 1);
});
test("a ridge between safe camera and rider raises the whole sightline above ground", () => {
  const ground = [0, 0, 7, 0, 0, 0, 0];
  const lift = terrainCameraLiftM(3, 1.5, ground)!;
  assert.ok(lift > 7);
  for (let i = 0; i < ground.length; i++) {
    const t = CAMERA_SIGHT_SAMPLES[i]!;
    assert.ok((3 + lift) * (1 - t) + 1.5 * t >= ground[i]! + 0.6 - 1e-9);
  }
});
test("missing DEM is not treated as sea level and descent never compromises required clearance", () => {
  assert.equal(terrainCameraLiftM(3, 1.5, [0]), null);
  assert.equal(terrainCameraLiftM(3, 1.5, CAMERA_SIGHT_SAMPLES.map(() => Number.NaN)), null);
  assert.equal(smoothTerrainCameraLift(0, 8, 16), 8);
  const descent = smoothTerrainCameraLift(8, 1, 16);
  assert.ok(descent > 7 && descent < 8);
});

const scale = rideTerrainScale();

function fixture(flat = false, elevation = 100) {
  let altitude = flat ? 1 : elevation * scale + 1;
  let pitch = 83.5;
  let writes = 0, queries = 0;
  let available = true, terrainOn = true, transitioning = false;
  const cameraLL = { lng: 127, lat: 37 };
  const map = {
    getTerrain: () => terrainOn ? { exaggeration: flat ? 0 : scale } : null,
    getCenter: () => ({ lng: 127.00005, lat: 37 }),
    getPitch: () => pitch, getBearing: () => 90,
    queryTerrainElevation: (_point: unknown, options?: { exaggerated?: boolean }) => { queries++; return available ? (options?.exaggerated ? ((flat !== transitioning) ? 0 : elevation * scale) : elevation) : null; },
    getFreeCameraOptions: () => ({ position: { toLngLat: () => cameraLL, toAltitude: () => altitude }, setPitchBearing: (p: number) => { pitch = p; } }),
    setFreeCameraOptions: (cam: { position: { toAltitude: () => number } }) => { altitude = cam.position.toAltitude(); writes++; },
  };
  return { map: map as unknown as MapboxMap, state: () => ({ altitude, pitch, writes, queries }),
    missing: () => { available = false; }, off: () => { terrainOn = false; }, transition: () => { transitioning = true; } };
}
for (const slot of [2, 3]) for (const flat of [false, true]) {
  test(`QC${slot} ${flat ? "prospective flat recovery" : "3D"}: applied camera passes the production terrain guard`, () => {
    const f = fixture(flat);
    const rider: [number, number] = [127.0001, 37];
    assert.equal(readRideTerrainHealth(f.map, rider, flat), "ready");
    applyRideCameraTerrain(f.map, rider, slot, 0);
    assert.equal(f.state().writes, 1);
    assert.ok(Math.abs(f.state().altitude - (flat ? 3 : 100 * scale + 3)) < 1e-7);
    assert.ok(f.state().pitch > 0 && f.state().pitch <= 85);
    assert.equal(readRideTerrainHealth(f.map, rider, flat), "ready");
  });
}
test("manual OFF, other slots and missing DEM never write a camera or restore terrain", () => {
  for (const slot of [1, 4, 5, 6, null]) {
    const f = fixture(); applyRideCameraTerrain(f.map, [127.0001, 37], slot, 0);
    assert.equal(f.state().writes, 0); assert.equal(f.state().queries, 0);
  }
  const off = fixture(); off.off(); applyRideCameraTerrain(off.map, [127.0001, 37], 2, 0);
  assert.equal(off.state().writes, 0); assert.equal(off.state().queries, 0);
  const missing = fixture(); missing.missing(); applyRideCameraTerrain(missing.map, [127.0001, 37], 2, 0);
  assert.equal(missing.state().writes, 0);
});

test("terrain exaggeration transitions cannot combine a new style scale with old rendered coordinates", () => {
  for (const flat of [false, true]) {
    const f = fixture(flat); f.transition();
    applyRideCameraTerrain(f.map, [127.0001, 37], 2, 0);
    assert.equal(f.state().writes, 0);
  }
});

test("production follow jump corrects only QC2/3 and keeps both camera writes inside its event boundary", () => {
  const f = fixture();
  const writes: string[] = [];
  const map = f.map as unknown as Record<string, unknown>;
  map.getPadding = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
  map.jumpTo = () => { assert.equal(isFollowCameraJump(), true); writes.push("nominal"); };
  const original = f.map.setFreeCameraOptions.bind(f.map);
  map.setFreeCameraOptions = (...args: Parameters<MapboxMap["setFreeCameraOptions"]>) => {
    assert.equal(isFollowCameraJump(), true); writes.push("corrected"); return original(...args);
  };
  const jump = { center: [127, 37] as [number, number], riderLngLat: [127.0001, 37] as [number, number], pitch: 83.5, zoom: 20, bearing: 90, t: 0 };
  applyFollowCameraJumpTo(f.map, { ...jump, terrainCameraSlot: 2 });
  assert.deepEqual(writes, ["nominal", "corrected"]);
  assert.equal(isFollowCameraJump(), false);
  writes.length = 0;
  applyFollowCameraJumpTo(f.map, { ...jump, terrainCameraSlot: 4 });
  assert.deepEqual(writes, ["nominal"]);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRideTerrainScale, rideTerrainScale } from "../../src/lib/map/rideTerrainScale.ts";
import { apply3DState } from "../../src/components/map/rideCameraFollow.ts";

test("normal product builds use real height; only explicit preview 1.3 exaggerates terrain", () => {
  for (const search of ["", "?terrainscale=1", "?terrainscale=1.3", "?terrainscale=0", "?terrainscale=2"]) {
    assert.equal(resolveRideTerrainScale(false, search), 1);
  }
  assert.equal(resolveRideTerrainScale(true, "?terrainscale=1"), 1);
  assert.equal(resolveRideTerrainScale(true, "?terrainscale=1.3"), 1.3);
  for (const search of ["", "?terrainscale=0", "?terrainscale=NaN"]) {
    assert.equal(resolveRideTerrainScale(true, search), 1);
  }
});

test("production terrain setup, automatic flat recovery and manual OFF use the shared scale", () => {
  let terrain: unknown;
  const map = {
    getSource: () => ({}), getLayer: () => ({}), removeLayer: () => {},
    setTerrain: (value: unknown) => { terrain = value; }, getPitch: () => 0,
    getBearing: () => 0, easeTo: () => {},
  };
  const scale = rideTerrainScale();
  if (process.env.RTW_EXPECT_TERRAIN_SCALE) assert.equal(scale, Number(process.env.RTW_EXPECT_TERRAIN_SCALE));
  apply3DState(map as never, true, "buildings", "dem");
  assert.deepEqual(terrain, { source: "dem", exaggeration: scale });
  apply3DState(map as never, true, "buildings", "dem", { flatFallback: true });
  assert.deepEqual(terrain, { source: "dem", exaggeration: 0 });
  apply3DState(map as never, true, "buildings", "dem", { flatFallback: false });
  assert.deepEqual(terrain, { source: "dem", exaggeration: scale });
  apply3DState(map as never, false, "buildings", "dem");
  assert.equal(terrain, null);
});

test("turning terrain off during a ride preserves the camera pitch", () => {
  let terrain: unknown = {};
  const moves: unknown[] = [];
  const map = {
    setTerrain: (value: unknown) => { terrain = value; }, getLayer: () => null,
    getStyle: () => ({ layers: [] }), addLayer: () => {},
    getPitch: () => 78, easeTo: (value: unknown) => moves.push(value),
  };
  apply3DState(map as never, false, "buildings", "dem", { preserveCamera: true });
  assert.equal(terrain, null);
  assert.equal(moves.length, 0);
});

test("non-Standard map retains buildings during a flat ride and removes them at exit", () => {
  let terrain: unknown = {};
  let building = false;
  const map = {
    setTerrain: (value: unknown) => { terrain = value; },
    getLayer: () => building ? {} : null,
    getStyle: () => ({ layers: [] }),
    addLayer: () => { building = true; }, removeLayer: () => { building = false; },
    getPitch: () => 0, easeTo: () => {},
  };
  apply3DState(map as never, false, "buildings", "dem", { preserveCamera: true });
  assert.equal(terrain, null);
  assert.equal(building, true);
  apply3DState(map as never, false, "buildings", "dem");
  assert.equal(building, false);
});

test("ride-end overview flight is not cancelled by the terrain cleanup", () => {
  const moves: unknown[] = [];
  const map = {
    setTerrain: () => {}, getLayer: () => null, removeLayer: () => {}, getSource: () => ({}),
    getStyle: () => ({ layers: [] }), addLayer: () => {},
    getPitch: () => 20, easeTo: (value: unknown) => moves.push(value),
  };
  apply3DState(map as never, false, "buildings", "dem", { holdCamera: true });
  apply3DState(map as never, true, "buildings", "dem", { holdCamera: true });
  assert.equal(moves.length, 0);
  apply3DState(map as never, false, "buildings", "dem");
  assert.equal(moves.length, 1, "ordinary manual OFF still flattens the camera");
});

test("Standard retains 3D objects while terrain is off", () => {
  let terrain: unknown = {};
  const config = new Map<string, unknown>();
  const map = {
    setConfigProperty: (_id: string, key: string, value: unknown) => config.set(key, value),
    setTerrain: (value: unknown) => { terrain = value; }, getLayer: () => null,
    getPitch: () => 78, easeTo: () => { throw new Error("camera must not move"); },
  };
  apply3DState(map as never, false, "buildings", "dem", { standardBasemap: true, preserveCamera: true });
  assert.equal(terrain, null);
  for (const key of ["show3dObjects", "show3dBuildings", "show3dLandmarks", "show3dTrees", "show3dFacades"]) {
    assert.equal(config.get(key), true, key);
  }
});

test("camera 1 removes 3D buildings and terrain and restores them on exit", () => {
  let terrain: unknown = {};
  let building = true;
  const config = new Map<string, unknown>();
  const map = {
    setConfigProperty: (_id: string, key: string, value: unknown) => config.set(key, value),
    setTerrain: (value: unknown) => { terrain = value; }, getSource: () => ({}),
    getLayer: () => building ? {} : null, removeLayer: () => { building = false; },
    getStyle: () => ({ layers: [] }), addLayer: () => { building = true; },
    getPitch: () => 0, easeTo: () => {},
  };
  apply3DState(map as never, false, "buildings", "dem", { preserveCamera: true, disable3DObjects: true });
  assert.equal(terrain, null);
  assert.equal(building, false);
  apply3DState(map as never, false, "buildings", "dem", { preserveCamera: true });
  assert.equal(building, true);
  apply3DState(map as never, false, "buildings", "dem", { preserveCamera: true, standardBasemap: true, disable3DObjects: true });
  assert.equal(config.get("show3dObjects"), false);
  apply3DState(map as never, false, "buildings", "dem", { preserveCamera: true, standardBasemap: true });
  assert.equal(config.get("show3dObjects"), true);
});

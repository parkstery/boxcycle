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

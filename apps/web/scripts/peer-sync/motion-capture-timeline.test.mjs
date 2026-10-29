import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let vite;
let snapshot;
let samplers;
let clock;
const WALL = 1_700_000_000_000;
const geometry = { type: "LineString", coordinates: [[0, 0], [0.1, 0]] };
const input = {
  lngLat: [0, 0], trailId: "capture-test", publicationId: "capture-route",
  routeGeometry: geometry, routeDistanceMeters: 10_000,
  virtualDistanceMeters: 0, speedKmh: 5, routeRidePhase: "live",
};

before(async () => {
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
  snapshot = await vite.ssrLoadModule("/src/lib/ride/liveLocationSnapshot.ts");
  samplers = await vite.ssrLoadModule("/src/lib/peerMotion/peerSyncDistanceSamplers.ts");
  clock = await vite.ssrLoadModule("/src/lib/peerMotion/repo/serverClockOffset.ts");
  clock.__setServerTimeOffsetForTests(333);
});
after(async () => {
  samplers?.registerPeerSyncDistanceSamplers({ sampleVirtualDistanceM: null, sampleAppliedSpeedKmh: null });
  clock?.__resetServerClockOffsetForTests();
  await vite?.close();
});

test("motion distance carries its integration time, not a later publish time", () => {
  const realNow = Date.now;
  Date.now = () => WALL;
  try {
    samplers.registerPeerSyncDistanceSamplers({
      sampleVirtualDistanceM: () => 100,
      sampleAppliedSpeedKmh: () => 5,
      sampleMotionSnapshot: () => ({ distM: 100, speedKmh: 5, capturedAtLocalMs: WALL - 40 }),
    });
    const result = snapshot.buildLiveLocationSnapshot(input);
    assert.equal(result.tSrv, WALL - 40 + 333);
    assert.equal(result.distMetersAlongRoute, 100);
    assert.equal(result.speedMps, 5 / 3.6);
  } finally { Date.now = realNow; }
});

test("5km/h with varying 0–40ms sample age preserves one constant-speed timeline", () => {
  const realNow = Date.now;
  let maxError = 0;
  try {
    for (let i = 0; i < 40; i++) {
      const publishAt = WALL + i * 200;
      const capturedAt = publishAt - (i % 2 ? 40 : 0);
      const distM = 100 + ((capturedAt - WALL) / 1000) * (5 / 3.6);
      Date.now = () => publishAt;
      samplers.registerPeerSyncDistanceSamplers({
        sampleVirtualDistanceM: () => distM,
        sampleAppliedSpeedKmh: () => 5,
        sampleMotionSnapshot: () => ({ distM, speedKmh: 5, capturedAtLocalMs: capturedAt }),
      });
      const result = snapshot.buildLiveLocationSnapshot(input);
      const expectedAtStamp = 100 + ((result.tSrv - 333 - WALL) / 1000) * (5 / 3.6);
      maxError = Math.max(maxError, Math.abs(result.distMetersAlongRoute - expectedAtStamp));
    }
    assert.ok(maxError < 1e-6, `distance/time disagreement ${maxError}m`);
  } finally { Date.now = realNow; }
});

test("unregistered sampler retains input fallback and server-clock-unready wire", () => {
  samplers.registerPeerSyncDistanceSamplers({ sampleVirtualDistanceM: null, sampleAppliedSpeedKmh: null });
  clock.__setServerTimeOffsetForTests(null);
  try {
    const result = snapshot.buildLiveLocationSnapshot({ ...input, virtualDistanceMeters: 123 });
    assert.equal(result.distMetersAlongRoute, 123);
    assert.equal(result.tSrv, undefined);
  } finally { clock.__setServerTimeOffsetForTests(333); }
});

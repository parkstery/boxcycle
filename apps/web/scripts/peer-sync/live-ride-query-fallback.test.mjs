import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let vite, sync, registry, clock;
before(async () => {
  vite = await createServer({ root: fileURLToPath(new URL("../..", import.meta.url)), optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
  sync = await vite.ssrLoadModule("/src/lib/peerMotion/syncFromPresence.ts");
  registry = await vite.ssrLoadModule("/src/lib/peerMotion/PeerMotionRegistry.ts");
  clock = await vite.ssrLoadModule("/src/lib/peerMotion/commonDisplayClock.ts");
});
after(async () => { registry?.resetPeerMotionRegistry(); await vite?.close(); });

const WALL = 1700000000000;
const SPEED = 5 / 3.6;
const geometry = { type: "LineString", coordinates: [[0, 0], [0.1, 0]] };

function replay(excludeSelf, mode) {
  registry.resetPeerMotionRegistry();
  sync.resetPeerMotionRtdbContentObservations();
  clock.resetCommonDisplayClock();
  const state = registry.getPeerMotionRegistry();
  const originalNow = Date.now;
  let now = WALL;
  Date.now = () => now;
  let peerMotion = null;
  let peerFs = null;
  let selfFs = null;
  const frames = [];
  const packets = [];
  const originalIngest = state.ingest.bind(state);
  state.ingest = (packet, label, at) => {
    // Compare the actual selected packet timeline, collapsing repeated identical ingestion.
    const value = JSON.stringify(packet);
    if (packets.at(-1) !== value) packets.push(value);
    originalIngest(packet, label, at);
  };
  const row = (uid, t, phase = "live") => ({
    uid, publicationId: "publication-a", distMeters: Math.round(t / 1000 * SPEED * 10) / 10,
    speedMps: phase === "live" ? SPEED : 0, ridePhase: phase,
    progressRatio: t / 100000, lastSeenAtMs: WALL + t,
    receivedAtLocalMs: now, displayName: uid,
  });
  const ingest = (t) => {
    const ownMotion = { uid: "self", publicationId: "publication-a", distM: t / 1000 * SPEED, speedMps: SPEED, ridePhase: "live", serverAtMs: now, tSrv: now };
    sync.syncPeerMotionFromPresence({
      publicationId: "publication-a", myUid: "self", routeLenM: 10000, nowMs: now,
      motionRows: mode === "fs-only" || (mode === "hard-error" && t >= 8000 && t < 14000)
        ? [] : [ownMotion, ...(peerMotion ? [peerMotion] : [])],
      liveRideRows: [peerFs, ...(!excludeSelf && selfFs ? [selfFs] : [])].filter(Boolean),
      sessionMembers: [],
    });
  };
  try {
    for (let t = 0; t <= 22000; t += 20) {
      now = WALL + t;
      if (t % 200 === 0 && mode !== "fs-only") {
        if (mode === "normal" || t < 8000 || t >= 14000) {
          peerMotion = { uid: "peer", publicationId: "publication-a", distM: t / 1000 * SPEED, speedMps: SPEED, ridePhase: "live", serverAtMs: now, tSrv: now };
        }
        ingest(t); // The RTDB query still includes self; local self publications continue to wake it.
      }
      if (t % 4000 === 0) {
        peerFs = row("peer", t, t === 12000 ? "paused" : t === 20000 ? "completed" : "live");
        ingest(t);
      }
      if (t % 4000 === 2600) {
        selfFs = row("self", t);
        if (!excludeSelf) ingest(t); // Removed self-only Firestore callbacks must not change the display.
      }
      state.step(0.02, geometry, now);
      frames.push(state.getRawDisplayDistM("peer"));
    }
    return { frames, packets };
  } finally { Date.now = originalNow; }
}

for (const mode of ["normal", "silent-rtdb", "hard-error", "fs-only"]) {
  test(`self exclusion preserves rendered frames and selected fallback packets: ${mode}`, () => {
    const before = replay(false, mode);
    const after = replay(true, mode);
    assert.deepEqual(after.frames, before.frames, "every unrounded 20ms display distance must match");
    assert.deepEqual(after.packets, before.packets, "RTDB/FS switch, phase and recovery packets must match");
    assert.ok(after.frames.some((d) => d > 0));
  });
}

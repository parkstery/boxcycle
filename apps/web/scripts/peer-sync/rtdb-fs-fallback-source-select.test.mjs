/**
 * TASK-30B/30C — selectPeerMotionPacketForIngest + dual-source stamp + RTDB visibility.
 * 교차 시계(serverAtMs) 비교가 아니라 수신 측 RTDB 내용 변화 관측 시각으로 고른다.
 */
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { createServer } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");

const base = (over = {}) => ({
  uid: "peer",
  publicationId: "pub",
  distM: 10,
  speedMps: 5,
  phase: "live",
  serverAtMs: 10_000,
  ...over,
});

describe("selectPeerMotionPacketForIngest (TASK-30B)", () => {
  let server;
  let select;
  let note;
  let reset;
  let stamp;
  let bridge;
  let sync;
  let peekCap;
  let peekTip;
  let isVisible;
  let STALE;
  let LIVE_STALE;
  let MAX_ADV;

  before(async () => {
    server = await createServer({
      root: WEB_ROOT,
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "error",
    });
    const mod = await server.ssrLoadModule("./src/lib/peerMotion/syncFromPresence.ts");
    const policy = await server.ssrLoadModule("./src/lib/trail/trailLivePolicy.ts");
    select = mod.selectPeerMotionPacketForIngest;
    note = mod.noteRtdbContentObservation;
    reset = mod.resetPeerMotionRtdbContentObservations;
    stamp = mod.stampDualSourceIngestPacket;
    bridge = mod.bridgeFsPacketToServerTimeline;
    sync = mod.syncPeerMotionFromPresence;
    peekCap = mod.peekServerCaptureAnchorForTests;
    peekTip = mod.peekDisplayTimelineTipForTests;
    isVisible = mod.isRtdbMotionRowPeerVisibleByReceiverObs;
    STALE = mod.PEER_MOTION_RTDB_SOURCE_STALE_MS;
    LIVE_STALE = policy.PEER_LIVE_RIDE_STALE_MS;
    MAX_ADV = mod.ESTIMATED_TSRV_MAX_ADVANCE_MS;
  });

  after(async () => {
    await server?.close();
  });

  it("RTDB-only / FS-only", () => {
    const r = base({ serverAtMs: 1000 });
    const f = base({ serverAtMs: 2000, distM: 12 });
    assert.equal(select(r, null, 1000, 1000), r);
    assert.equal(select(null, f, 2000, null), f);
    assert.equal(select(null, null, 0, null), null);
  });

  it("RTDB-first while local content observation is fresh", () => {
    const r = base({ serverAtMs: 10_000, distM: 50 });
    // FS wall stamp can be "newer" — must not matter (clock-independent).
    const f = base({ serverAtMs: 40_000, distM: 47 });
    assert.equal(select(r, f, 10_100, 10_000).distM, 50);
  });

  it("FS when RTDB content observation is locally stale (silent freeze)", () => {
    const freezeObs = 10_000;
    const r = base({ serverAtMs: freezeObs + 30_000, distM: 50 }); // sender +30s
    const f = base({ serverAtMs: freezeObs + 3_000, distM: 58 });
    assert.equal(select(r, f, freezeObs + STALE + 1, freezeObs), f);
  });

  it("RTDB-first even when sender clock is −30s behind FS stamps", () => {
    const now = 50_000;
    const r = base({ serverAtMs: now - 30_000, distM: 50 });
    const f = base({ serverAtMs: now, distM: 49 });
    assert.equal(select(r, f, now, now - 200).distM, 50);
  });

  it("noteRtdbContentObservation advances only on content change", () => {
    reset();
    const row = {
      uid: "peer",
      publicationId: "pub",
      distM: 50,
      speedMps: 5,
      ridePhase: "live",
      serverAtMs: 10_000,
      seq: 1,
    };
    assert.equal(note("peer", row, 1000), 1000);
    assert.equal(note("peer", row, 2000), 1000); // identical redelivery
    assert.equal(note("peer", { ...row, seq: 2, serverAtMs: 10_200 }, 2200), 2200);
  });

  it("missing observation defaults RTDB-first", () => {
    const r = base({ distM: 50 });
    const f = base({ distM: 60, serverAtMs: 99_999 });
    assert.equal(select(r, f, 10_000, null).distM, 50);
    assert.equal(select(r, f, 10_000, undefined).distM, 50);
  });

  it("stampDualSourceIngestPacket preserves native Δt; freeze keeps stamp (TASK-30C/TASK-02)", () => {
    reset();
    const frozen = base({ serverAtMs: 10_000, distM: 50, seq: 5 });
    const a = stamp("peer", frozen, "rtdb", 1_000);
    const b = stamp("peer", frozen, "rtdb", 5_000);
    const c = stamp("peer", frozen, "rtdb", 20_000);
    assert.equal(a.serverAtMs, 1_000);
    assert.equal(b.serverAtMs, 1_000, "identical redelivery must not bump stamp");
    assert.equal(c.serverAtMs, 1_000);
    // Same pose, switch to FS — must not refresh liveness.
    const fsFrozen = base({ serverAtMs: 9_500, distM: 50 });
    const sw = stamp("peer", fsFrozen, "fs", 3_500);
    assert.equal(sw.serverAtMs, 1_000, "source switch at same pose must keep stamp");
    // Back to RTDB with new pose: source re-enter → align to now once.
    const moved = base({ serverAtMs: 10_200, distM: 51, seq: 6 });
    const d = stamp("peer", moved, "rtdb", 20_200);
    assert.equal(d.serverAtMs, 20_200, "source re-enter aligns to nowMs");
    // Same source next packet: preserve native Δt (200ms), not arrival now.
    const moved2 = base({ serverAtMs: 10_400, distM: 52, seq: 7 });
    const e = stamp("peer", moved2, "rtdb", 20_900);
    assert.equal(e.serverAtMs, 20_400, "same-source must keep native Δt (not arrival now)");
    // Causal clamp: native jump that would place stamp in the future re-anchors to now.
    const catchUp = base({ serverAtMs: 50_000, distM: 60, seq: 8 });
    const f = stamp("peer", catchUp, "rtdb", 21_000);
    assert.equal(f.serverAtMs, 21_000, "future stamp must clamp to nowMs");
  });

  it("bridgeFsPacketToServerTimeline marks estimated and keeps capture tSrv", () => {
    const last = { tSrv: 10_000, distM: 50, speedMps: 5 / 3.6 };
    const fs = base({ distM: 50 + (5 / 3.6) * 4, speedMps: 5 / 3.6, serverAtMs: 20_000 });
    const bridged = bridge(fs, last);
    assert.ok(bridged.tSrv > last.tSrv);
    assert.ok(Math.abs(bridged.tSrv - (last.tSrv + 4_000)) < 50);
    assert.equal(bridged.tSrvQuality, "estimated");
    const paused = bridge(base({ distM: 50, speedMps: 0 }), last);
    assert.equal(paused.tSrv, last.tSrv);
    assert.equal(paused.tSrvQuality, "estimated");
    const stopDrift = bridge(base({ distM: 50.2, speedMps: 0 }), last);
    assert.equal(stopDrift.tSrv, last.tSrv, "zero-speed must not invent +1ms axis");
    const withTsrv = bridge(base({ distM: 60, tSrv: 12_000, tSrvQuality: "capture" }), last);
    assert.equal(withTsrv.tSrv, 12_000, "capture tSrv must not be rewritten");
    assert.equal(withTsrv.tSrvQuality, "capture");
    const huge = bridge(base({ distM: 50 + 100, speedMps: 0.05 }), last);
    assert.ok(huge.tSrv - last.tSrv <= MAX_ADV + 1e-6, "estimated advance clamped");
    assert.equal(Number.isFinite(huge.tSrv), true);
  });

  it("estimated FS tip does not contaminate capture; late RTDB does not rewind", () => {
    reset();
    const pub = "pub-anchor";
    const uidPeer = "peer-b";
    const uidSelf = "self-a";
    // seed capture via RTDB
    sync({
      publicationId: pub,
      myUid: uidSelf,
      motionRows: [
        {
          uid: uidPeer,
          publicationId: pub,
          distM: 50,
          speedMps: 5 / 3.6,
          ridePhase: "live",
          serverAtMs: 10_000,
          tSrv: 10_000,
          seq: 1,
        },
      ],
      liveRideRows: [],
      sessionMembers: [],
      guestUidsSorted: [],
      routeLenM: 5000,
      nowMs: 10_000,
    });
    const cap0 = peekCap(pub, uidPeer);
    assert.ok(cap0);
    assert.equal(cap0.quality, "capture");
    assert.equal(cap0.tSrv, 10_000);

    // FS fallback while RTDB stale — estimated tip advances, capture stays
    sync({
      publicationId: pub,
      myUid: uidSelf,
      motionRows: [
        {
          uid: uidPeer,
          publicationId: pub,
          distM: 50,
          speedMps: 5 / 3.6,
          ridePhase: "live",
          serverAtMs: 10_000,
          tSrv: 10_000,
          seq: 1,
        },
      ],
      liveRideRows: [
        {
          uid: uidPeer,
          publicationId: pub,
          progressRatio: 0.012,
          distMeters: 50 + (5 / 3.6) * 4,
          lastSeenAtMs: 14_000,
          receivedAtLocalMs: 14_200,
          displayName: "B",
          speedMps: 5 / 3.6,
          ridePhase: "live",
        },
      ],
      sessionMembers: [],
      guestUidsSorted: [],
      routeLenM: 5000,
      nowMs: 10_000 + STALE + 100,
    });
    const cap1 = peekCap(pub, uidPeer);
    const tip1 = peekTip(pub, uidPeer);
    assert.equal(cap1.tSrv, 10_000, "capture must stay at RTDB");
    assert.equal(cap1.quality, "capture");
    assert.ok(tip1.tSrv > 10_000, "display tip may advance via estimated");
    assert.equal(tip1.quality, "estimated");

    // late/old RTDB must not rewind capture
    sync({
      publicationId: pub,
      myUid: uidSelf,
      motionRows: [
        {
          uid: uidPeer,
          publicationId: pub,
          distM: 49,
          speedMps: 5 / 3.6,
          ridePhase: "live",
          serverAtMs: 9_000,
          tSrv: 9_000,
          seq: 0,
        },
      ],
      liveRideRows: [],
      sessionMembers: [],
      guestUidsSorted: [],
      routeLenM: 5000,
      nowMs: 10_000 + STALE + 200,
    });
    assert.equal(peekCap(pub, uidPeer).tSrv, 10_000, "late capture must not rewind");

    // other publication must not inherit tip
    const other = "pub-other";
    assert.equal(peekCap(other, uidPeer), null);
    assert.equal(peekTip(other, uidPeer), null);
  });

  it("isRtdbMotionRowPeerVisibleByReceiverObs ignores sender +30s clock", () => {
    reset();
    const row = {
      uid: "peer",
      publicationId: "pub",
      distM: 50,
      speedMps: 5,
      ridePhase: "live",
      // Sender clock +30s ahead of receiver — wall age would look fresh for 30s longer.
      serverAtMs: 1_000 + 30_000,
      seq: 1,
    };
    assert.equal(isVisible("peer", row, 1_000), true);
    assert.equal(isVisible("peer", row, 1_000 + LIVE_STALE), true);
    assert.equal(
      isVisible("peer", row, 1_000 + LIVE_STALE + 1),
      false,
      "frozen RTDB must hide within 15s receiver-obs, not sender-clock age",
    );
  });
});

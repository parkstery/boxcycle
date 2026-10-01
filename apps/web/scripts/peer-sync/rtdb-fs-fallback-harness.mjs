/**
 * TASK-30B/30C — RTDB freeze/error → Firestore fallback + both-stream liveness.
 *
 * Stock `replay.mjs` only ingests a single pre-merged packet stream (see HARNESS.md
 * “mergePackets 재생 미포함”). This harness loads the **actual** production path:
 *   syncPeerMotionFromPresence → PeerMotionRegistry.ingest / step / pruneInactive
 * via vite `ssrLoadModule` (same loader contract as replay.mjs).
 *
 * Dimensions (30B fallback):
 *   - FS receive interval: 1s / 4s / 8s / 10s (receive-side only; publisher unchanged)
 *   - sender clock offset: 0 / +30s / −30s (RTDB `t` = sender Date.now)
 *   - peer motion: moving (5 m/s) / stationary (0 m/s, still 5Hz stamps)
 *   - RTDB failure: silent-freeze (frozen row redelivered) / hard-error (rows cleared)
 *   - recovery: after outage, RTDB advances again → must retake cleanly
 *
 * Dimensions (30C both-stream-stop):
 *   - both RTDB + FS freeze at once; frozen snapshots redelivered
 *   - moving / stationary × sender offset −30s / 0 / +30s
 *   - assert peer disappears within PEER_LIVE_RIDE_STALE_MS (15s)
 *
 *   cd apps/web && node scripts/peer-sync/rtdb-fs-fallback-harness.mjs
 *   cd apps/web && node scripts/peer-sync/rtdb-fs-fallback-harness.mjs --suite both-stop
 *   cd apps/web && node scripts/peer-sync/rtdb-fs-fallback-harness.mjs --interval 1000
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const OUT_DIR = resolve(HERE, ".out");

const PUB = "pub-task30b";
const LOCAL_UID = "local-rider";
const PEER_UID = "peer-rider";
const ROUTE_LEN_M = 5000;
const SPEED_MPS = 5; // 18 km/h — steady when moving
const RTDB_HZ_MS = 200;
const STEP_MS = 100;
const PRE_FREEZE_MS = 4_000;
const OUTAGE_MS = 20_000; // long enough to expose 15s stale if FS never refreshes liveness
const RECOVERY_MS = 4_000;
const PEER_STALE_MS = 15_000;
const MAX_EXTRAP_MS = 1_200;
const BACK_EPS_M = 0.5;
/** Synthetic wall base so ±30s sender skew stays in positive epoch space. */
const WALL_BASE_MS = 1_700_000_000_000;
const PRE_FREEZE_RTDB_SHARE_MIN = 0.7;

function parseArgs(argv) {
  const a = {
    /** "fallback" = 30B matrix; "both-stop" = 30C liveness; "all" = both */
    suite: "all",
    intervals: [1000, 4000, 8000, 10000],
    offsets: [-30_000, 0, 30_000],
    motions: ["moving", "stationary"],
    failures: ["silent-freeze", "hard-error"],
    jsonOut: resolve(OUT_DIR, "task30-fallback-metrics.json"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--suite") a.suite = String(argv[++i]);
    else if (argv[i] === "--interval") a.intervals = [Number(argv[++i])];
    else if (argv[i] === "--offset") a.offsets = [Number(argv[++i])];
    else if (argv[i] === "--motion") a.motions = [String(argv[++i])];
    else if (argv[i] === "--failure") a.failures = [String(argv[++i])];
    else if (argv[i] === "--out") a.jsonOut = resolve(process.cwd(), argv[++i]);
  }
  if (a.suite === "both-stop") {
    a.failures = ["both-stream-stop"];
    // FS interval only matters pre-freeze; one cell keeps matrix small.
    if (a.intervals.length > 1) a.intervals = [1000];
  } else if (a.suite === "fallback") {
    a.failures = a.failures.filter((f) => f !== "both-stream-stop");
    if (a.failures.length === 0) a.failures = ["silent-freeze", "hard-error"];
  }
  return a;
}

function peerDistAt(tMs, motion) {
  if (motion === "stationary") return 40; // fixed on-route point
  return SPEED_MPS * (tMs / 1000);
}

function makeRtdbRow(tMs, frozenAtMs, senderOffsetMs, motion, frozen) {
  // During outage keep the frozen snapshot; after recovery advance again with local t.
  const srcLocal = frozen ? frozenAtMs : tMs;
  const distM = peerDistAt(srcLocal, motion);
  const speedMps = motion === "stationary" ? 0 : SPEED_MPS;
  return {
    uid: PEER_UID,
    publicationId: PUB,
    distM,
    speedMps,
    ridePhase: "live",
    // Sender client clock — independent of receiver nowMs / FS serverTimestamp.
    serverAtMs: WALL_BASE_MS + srcLocal + senderOffsetMs,
    seq: Math.floor(srcLocal / RTDB_HZ_MS),
  };
}

function makeFsRow(tMs, lastFsAtMs, motion) {
  const src = lastFsAtMs;
  const distM = peerDistAt(src, motion);
  const speedMps = motion === "stationary" ? 0 : SPEED_MPS;
  return {
    uid: PEER_UID,
    publicationId: PUB,
    progressRatio: distM / ROUTE_LEN_M,
    distMeters: distM,
    // Firestore serverTimestamp ≈ receiver wall in this offline model (not sender).
    lastSeenAtMs: WALL_BASE_MS + src,
    receivedAtLocalMs: WALL_BASE_MS + tMs,
    displayName: "Peer",
    speedMps,
    ridePhase: "live",
  };
}

async function loadMods(server) {
  return {
    sync: await server.ssrLoadModule("./src/lib/peerMotion/syncFromPresence.ts"),
    registry: await server.ssrLoadModule("./src/lib/peerMotion/PeerMotionRegistry.ts"),
    policy: await server.ssrLoadModule("./src/lib/trail/trailLivePolicy.ts"),
    extrap: await server.ssrLoadModule("./src/lib/peerMotion/peerSyncPolicy.ts"),
  };
}

function analyzeTimeline(timeline, opts) {
  const {
    freezeAtMs,
    endOutageMs,
    fsIntervalMs,
    peerStaleMs,
    maxExtrapMs,
    motion,
    failureMode,
    requireRtdbRetake,
  } = opts;
  const bothStop = failureMode === "both-stream-stop";
  const outage = timeline.filter((p) => p.tMs >= freezeAtMs && p.tMs <= endOutageMs);
  const recovery = timeline.filter((p) => p.tMs > endOutageMs);
  const violations = [];
  let maxBackM = 0;
  let maxJumpM = 0;
  let maxGapVisibleMs = 0;
  let lastVisibleMs = timeline[0]?.tMs ?? 0;
  let invisibleSpans = [];
  let invisibleStart = null;
  let maxExtrapAheadMs = 0;
  let peerGoneAtMs = null;

  for (let i = 0; i < timeline.length; i += 1) {
    const p = timeline[i];
    if (p.displayDistM < -0.01 || p.displayDistM > ROUTE_LEN_M + 0.01) {
      violations.push(`clamp @${p.tMs}ms dist=${p.displayDistM}`);
    }
    if (p.entityCount > 0) {
      if (invisibleStart != null) {
        invisibleSpans.push({ from: invisibleStart, to: p.tMs, ms: p.tMs - invisibleStart });
        invisibleStart = null;
      }
      maxGapVisibleMs = Math.max(maxGapVisibleMs, p.tMs - lastVisibleMs);
      lastVisibleMs = p.tMs;
    } else if (invisibleStart == null) {
      invisibleStart = p.tMs;
      if (peerGoneAtMs == null && p.tMs >= freezeAtMs) peerGoneAtMs = p.tMs;
    }
    if (i > 0) {
      const back = timeline[i - 1].displayDistM - p.displayDistM;
      if (back > maxBackM) maxBackM = back;
      if (back > BACK_EPS_M && p.tMs >= freezeAtMs && !bothStop) {
        violations.push(
          `back-jump ${back.toFixed(2)}m @${p.tMs}ms (${timeline[i - 1].displayDistM.toFixed(1)}→${p.displayDistM.toFixed(1)})`,
        );
      }
      const jump = Math.abs(p.displayDistM - timeline[i - 1].displayDistM);
      if (jump > maxJumpM) maxJumpM = jump;
    }
    if (typeof p.extrapAheadMs === "number" && p.extrapAheadMs > maxExtrapAheadMs) {
      maxExtrapAheadMs = p.extrapAheadMs;
    }
  }
  if (invisibleStart != null) {
    invisibleSpans.push({
      from: invisibleStart,
      to: timeline[timeline.length - 1]?.tMs ?? invisibleStart,
      ms: (timeline[timeline.length - 1]?.tMs ?? invisibleStart) - invisibleStart,
    });
  }

  const outageInvisible = invisibleSpans.filter((s) => s.to > freezeAtMs && s.from <= endOutageMs);
  const peerGoneInOutage = outage.some((p) => p.entityCount === 0);
  const endOutage = outage[outage.length - 1];
  const end = timeline[timeline.length - 1];
  const expectedEndDist = peerDistAt(end?.tMs ?? 0, motion);
  const lagM = expectedEndDist - (end?.displayDistM ?? 0);
  const staleRiskMarginMs = peerStaleMs - fsIntervalMs;
  /** Both-stop: disappear within existing 15s liveness from freeze (plus one step). */
  const staleDeadlineMs = freezeAtMs + peerStaleMs + STEP_MS;

  if (bothStop) {
    // TASK-30C: both streams frozen → peer must leave within 15s policy (+ source-select bump).
    if (peerGoneAtMs == null || peerGoneAtMs > staleDeadlineMs) {
      violations.push(
        `both-stream-stop: peer still present past ${peerStaleMs}ms stale policy ` +
          `(goneAt=${peerGoneAtMs ?? "never"}, deadline=${staleDeadlineMs})`,
      );
    }
    const stillAlivePastDeadline = timeline.some(
      (p) => p.tMs >= staleDeadlineMs && p.tMs <= endOutageMs && p.entityCount > 0,
    );
    if (stillAlivePastDeadline) {
      violations.push(
        `both-stream-stop: entityCount>0 after stale deadline (manufactured serverAtMs?)`,
      );
    }
  } else if (peerGoneInOutage) {
    violations.push("peer entity missing during RTDB outage while FS continues");
  }
  if (maxExtrapAheadMs > maxExtrapMs + 50) {
    violations.push(`extrap ${maxExtrapAheadMs}ms > cap ${maxExtrapMs}ms`);
  }

  if (!bothStop) {
    if (motion === "moving") {
      const freezeDist = peerDistAt(freezeAtMs, motion);
      const minAdvanceM = SPEED_MPS * Math.max(2, (OUTAGE_MS - fsIntervalMs) / 1000) * 0.35;
      if (endOutage && endOutage.displayDistM < freezeDist + minAdvanceM) {
        violations.push(
          `display stalled near freeze dist (${endOutage.displayDistM.toFixed(1)} vs freeze ${freezeDist.toFixed(1)}, need +${minAdvanceM.toFixed(1)}m) — FS fallback not advancing`,
        );
      }
    } else {
      // Stationary: must remain visible near fixed dist; no requirement to advance.
      const target = peerDistAt(0, "stationary");
      if (endOutage && Math.abs((endOutage.displayDistM ?? 0) - target) > 15) {
        violations.push(
          `stationary display drifted (${endOutage.displayDistM?.toFixed(1)} vs ${target})`,
        );
      }
    }
  }

  let recoveryRtdbRetakeShare = null;
  if (requireRtdbRetake && recovery.length && failureMode === "silent-freeze") {
    const late = recovery.filter((p) => p.tMs >= endOutageMs + 1_000 && p.pick != null);
    const withPick = late.filter((p) => p.pick === "rtdb" || p.pick === "fs");
    recoveryRtdbRetakeShare =
      withPick.length === 0 ? 0 : withPick.filter((p) => p.pick === "rtdb").length / withPick.length;
    if (recoveryRtdbRetakeShare < PRE_FREEZE_RTDB_SHARE_MIN) {
      violations.push(
        `RTDB did not retake after recovery (share=${recoveryRtdbRetakeShare.toFixed(3)} < ${PRE_FREEZE_RTDB_SHARE_MIN})`,
      );
    }
  }

  const pass =
    violations.length === 0 &&
    (bothStop ? peerGoneAtMs != null && peerGoneAtMs <= staleDeadlineMs : !peerGoneInOutage);

  return {
    fsIntervalMs,
    freezeAtMs,
    peerGoneInOutage,
    peerGoneAtMs,
    staleDeadlineMs,
    maxBackM: Math.round(maxBackM * 100) / 100,
    maxJumpM: Math.round(maxJumpM * 100) / 100,
    maxGapVisibleMs,
    outageInvisibleSpans: outageInvisible,
    lagMAtEnd: Math.round(lagM * 100) / 100,
    staleRiskMarginMs,
    staleRiskThin: staleRiskMarginMs < 3_000,
    maxExtrapAheadMs,
    endDisplayDistM: end?.displayDistM ?? null,
    endEntityCount: end?.entityCount ?? 0,
    recoveryRtdbRetakeShare,
    violations: [...new Set(violations)],
    pass,
  };
}

async function runOne(mods, cfg) {
  const { fsIntervalMs, senderOffsetMs, motion, failureMode } = cfg;
  const {
    syncPeerMotionFromPresence,
    selectPeerMotionPacketForIngest,
    noteRtdbContentObservation,
    resetPeerMotionRtdbContentObservations,
  } = mods.sync;
  const { getPeerMotionRegistry, resetPeerMotionRegistry } = mods.registry;
  const freezeAtMs = PRE_FREEZE_MS;
  const endOutageMs = freezeAtMs + OUTAGE_MS;
  const endMs = endOutageMs + RECOVERY_MS;

  resetPeerMotionRegistry();
  if (typeof resetPeerMotionRtdbContentObservations === "function") {
    resetPeerMotionRtdbContentObservations();
  }
  const reg = getPeerMotionRegistry();

  let motionRows = [];
  let liveRideRows = [];
  let lastFsAtMs = 0;
  let nextRtdb = 0;
  let nextFs = 0;
  const timeline = [];
  const selectedSources = [];

  const realNow = Date.now;
  const realDebug = console.debug;
  const realInfo = console.info;
  const realLog = console.log;
  let clockMs = 0;
  Date.now = () => WALL_BASE_MS + clockMs;
  console.debug = (...args) => {
    if (String(args[0] ?? "").includes("[peerSyncChain]")) return;
    realDebug(...args);
  };
  console.info = (...args) => {
    if (String(args[0] ?? "").includes("[peerAlive]")) return;
    realInfo(...args);
  };
  console.log = (...args) => {
    if (String(args[0] ?? "").includes("[peerSmooth]")) return;
    realLog(...args);
  };

  try {
    for (let t = 0; t <= endMs; t += STEP_MS) {
      clockMs = t;
      const nowMs = WALL_BASE_MS + t;
      const inOutage = t >= freezeAtMs && t <= endOutageMs;
      const frozen = inOutage;

      if (t >= nextRtdb) {
        if (failureMode === "hard-error" && inOutage) {
          motionRows = []; // Presence error clear path
        } else {
          motionRows = [makeRtdbRow(t, freezeAtMs, senderOffsetMs, motion, frozen)];
        }
        nextRtdb = t + RTDB_HZ_MS;
      }
      if (t >= nextFs) {
        if (failureMode === "both-stream-stop" && inOutage) {
          // Keep last FS snapshot frozen (redelivered) — both streams stop.
          liveRideRows = [makeFsRow(t, freezeAtMs, motion)];
        } else {
          lastFsAtMs = t;
          liveRideRows = [makeFsRow(t, lastFsAtMs, motion)];
        }
        nextFs = t + fsIntervalMs;
      }

      const rtdbPacket = motionRows[0]
        ? {
            uid: motionRows[0].uid,
            publicationId: PUB,
            distM: motionRows[0].distM,
            speedMps: motionRows[0].speedMps,
            phase: motionRows[0].ridePhase,
            serverAtMs: motionRows[0].serverAtMs,
          }
        : null;
      const fsPacket = liveRideRows[0]
        ? {
            uid: liveRideRows[0].uid,
            publicationId: PUB,
            distM: liveRideRows[0].distMeters,
            speedMps: liveRideRows[0].speedMps,
            phase: liveRideRows[0].ridePhase,
            serverAtMs: liveRideRows[0].lastSeenAtMs,
          }
        : null;

      let changedAt = null;
      if (motionRows[0] && typeof noteRtdbContentObservation === "function") {
        changedAt = noteRtdbContentObservation(PEER_UID, motionRows[0], nowMs);
      }

      const pick =
        typeof selectPeerMotionPacketForIngest === "function"
          ? selectPeerMotionPacketForIngest.length >= 4
            ? selectPeerMotionPacketForIngest(rtdbPacket, fsPacket, nowMs, changedAt)
            : selectPeerMotionPacketForIngest(rtdbPacket, fsPacket, nowMs)
          : null;
      const pickLabel = pick == null ? "n/a" : pick === fsPacket ? "fs" : rtdbPacket ? "rtdb" : "n/a";

      if (t % 500 === 0 || (t >= freezeAtMs && t <= freezeAtMs + 4_000) || t > endOutageMs) {
        selectedSources.push({
          tMs: t,
          pick: pickLabel,
          rtdbT: rtdbPacket?.serverAtMs ?? null,
          fsT: fsPacket?.serverAtMs ?? null,
          rtdbDist: rtdbPacket?.distM ?? null,
          fsDist: fsPacket?.distM ?? null,
          rtdbChangedAt: changedAt,
        });
      }

      syncPeerMotionFromPresence({
        publicationId: PUB,
        myUid: LOCAL_UID,
        motionRows,
        liveRideRows,
        sessionMembers: [{ uid: PEER_UID, displayName: "Peer", memberType: "member" }],
        guestUidsSorted: [],
        routeLenM: ROUTE_LEN_M,
        nowMs,
      });
      reg.step(STEP_MS / 1000, null, nowMs);
      reg.pruneInactive(nowMs);

      const snap = reg.debugSnapshot(nowMs);
      const peer = snap.find((s) => s.uid === PEER_UID.slice(0, 6)) ?? snap[0];
      timeline.push({
        tMs: t,
        entityCount: reg.getEntityCount(),
        displayDistM: peer?.displayDistM ?? 0,
        phase: peer?.phase ?? "gone",
        newestAgeMs: peer?.newestAgeMs ?? -1,
        extrapAheadMs: peer && peer.newestAgeMs > 0 ? Math.min(peer.newestAgeMs, MAX_EXTRAP_MS) : 0,
        pick: pickLabel,
      });
    }
  } finally {
    Date.now = realNow;
    console.debug = realDebug;
    console.info = realInfo;
    console.log = realLog;
    resetPeerMotionRegistry();
    if (typeof resetPeerMotionRtdbContentObservations === "function") {
      resetPeerMotionRtdbContentObservations();
    }
  }

  const metrics = analyzeTimeline(timeline, {
    freezeAtMs,
    endOutageMs,
    fsIntervalMs,
    peerStaleMs: mods.policy.PEER_LIVE_RIDE_STALE_MS ?? PEER_STALE_MS,
    maxExtrapMs: mods.extrap.PEER_INTERP_MAX_EXTRAP_MS ?? MAX_EXTRAP_MS,
    motion,
    failureMode,
    requireRtdbRetake: failureMode === "silent-freeze",
  });
  metrics.senderOffsetMs = senderOffsetMs;
  metrics.motion = motion;
  metrics.failureMode = failureMode;
  metrics.selectionSamples = selectedSources;
  metrics.hasSelectExport = typeof selectPeerMotionPacketForIngest === "function";
  metrics.hasLocalObsExport = typeof noteRtdbContentObservation === "function";

  const pre = selectedSources.filter((s) => s.tMs < freezeAtMs && s.rtdbT != null && s.fsT != null);
  metrics.preFreezeRtdbFirstShare =
    pre.length === 0 ? null : pre.filter((s) => s.pick === "rtdb").length / pre.length;
  if (
    metrics.preFreezeRtdbFirstShare != null &&
    metrics.preFreezeRtdbFirstShare < PRE_FREEZE_RTDB_SHARE_MIN
  ) {
    metrics.violations.push(
      `pre-freeze RTDB-first share ${metrics.preFreezeRtdbFirstShare.toFixed(3)} < ${PRE_FREEZE_RTDB_SHARE_MIN} (senderOffset=${senderOffsetMs})`,
    );
    metrics.pass = false;
  }
  return metrics;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  const results = [];
  let failed = 0;
  try {
    const mods = await loadMods(server);
    const suiteLabel =
      args.suite === "both-stop"
        ? "TASK-30C both-stream-stop"
        : args.suite === "fallback"
          ? "TASK-30B fallback"
          : "TASK-30B/30C all";
    console.log(
      `${suiteLabel} — syncFromPresence + PeerMotionRegistry (vite SSR)\n` +
        `PEER_LIVE_RIDE_STALE_MS=${mods.policy.PEER_LIVE_RIDE_STALE_MS} ` +
        `PEER_INTERP_MAX_EXTRAP_MS=${mods.extrap.PEER_INTERP_MAX_EXTRAP_MS}\n` +
        `selectExport=${typeof mods.sync.selectPeerMotionPacketForIngest === "function"} ` +
        `localObsExport=${typeof mods.sync.noteRtdbContentObservation === "function"}`,
    );

    const failures =
      args.suite === "all"
        ? [...new Set([...args.failures, "both-stream-stop"])]
        : args.failures;
    const intervals =
      args.suite === "all"
        ? args.intervals
        : args.suite === "both-stop"
          ? args.intervals
          : args.intervals;

    for (const interval of intervals) {
      for (const offset of args.offsets) {
        for (const motion of args.motions) {
          for (const failure of failures) {
            // both-stream-stop: only need one FS interval (pre-freeze warm-up).
            if (failure === "both-stream-stop" && interval !== intervals[0] && args.suite === "all") {
              continue;
            }
            const m = await runOne(mods, {
              fsIntervalMs: interval,
              senderOffsetMs: offset,
              motion,
              failureMode: failure,
            });
            results.push(m);
            const mark = m.pass ? "✓" : "✗";
            const goneExtra =
              failure === "both-stream-stop"
                ? `goneAt=${m.peerGoneAtMs ?? "never"} deadline=${m.staleDeadlineMs}`
                : `gone=${m.peerGoneInOutage}`;
            console.log(
              `${mark} fs=${interval}ms off=${offset} ${motion}/${failure} ${goneExtra} ` +
                `maxBack=${m.maxBackM}m maxJump=${m.maxJumpM}m lagEnd=${m.lagMAtEnd}m ` +
                `preRtdb=${m.preFreezeRtdbFirstShare?.toFixed?.(3) ?? m.preFreezeRtdbFirstShare} ` +
                `retake=${m.recoveryRtdbRetakeShare?.toFixed?.(3) ?? "n/a"} ` +
                `endDist=${m.endDisplayDistM}`,
            );
            if (m.violations.length) {
              for (const v of m.violations) console.log(`    · ${v}`);
            }
            if (!m.pass) failed += 1;
          }
        }
      }
    }
  } finally {
    await server.close();
  }

  const report = {
    task: args.suite === "both-stop" ? "TASK-30C" : args.suite === "fallback" ? "TASK-30B" : "TASK-30B+30C",
    suite: args.suite,
    at: new Date().toISOString(),
    note:
      "Offline dual-source replay through syncPeerMotionFromPresence + PeerMotionRegistry. " +
      "Not billed Firebase reads. Publisher cadence unchanged — FS intervals are receive-side simulations. " +
      "Sender clock offset applied only to RTDB t; FS lastSeenAt uses receiver-aligned wall base. " +
      "both-stream-stop: frozen RTDB+FS redelivery must expire peer within PEER_LIVE_RIDE_STALE_MS.",
    results,
    allPass: failed === 0,
    failCount: failed,
    passCount: results.length - failed,
  };
  writeFileSync(args.jsonOut, JSON.stringify(report, null, 2), "utf8");
  console.log(`wrote ${args.jsonOut} (pass=${report.passCount}/${results.length})`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

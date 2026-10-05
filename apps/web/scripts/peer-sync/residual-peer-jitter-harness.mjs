/**
 * 잔여 peer 앞뒤 튐 — 저속 dual RTDB/FS + 공통 D600 제품 경로.
 *
 * truth 상대거리 drift(5vs6)는 residual = displayGap − truthGap 으로 제거.
 * FS 4s · RTDB 200ms · encode/tSrv/stamp/ingest/frame/raw dist.
 *
 *   cd apps/web && node scripts/peer-sync/residual-peer-jitter-harness.mjs
 *   cd apps/web && node scripts/peer-sync/residual-peer-jitter-harness.mjs --scenario low5v6
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { performance } from "node:perf_hooks";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const OUT_DIR = resolve(HERE, ".out");
const OPS_DIR = resolve(WEB_ROOT, "../../document/ops/20261005-peer-spacing-jitter");

const PUB = "pub-residual-jitter";
const UID_A = "rider-A";
const UID_B = "rider-B";
const WALL = 1_700_000_000_000;
const STEP_MS = 1000 / 60;
const RUN_MS = 24_000;
const WARMUP_MS = 5_000;
const RTDB_MS = 200;
const FS_MS = 4_000;
const RTT_MS = 140;
const D = 600;
const ROUTE_LEN = 5000;
const HARD_MS = 120_000;

/** residual peak-peak / frame jump gates (stable window) */
const RESIDUAL_PP_FAIL_M = 0.8;
const FRAME_JUMP_FAIL_M = 0.45;
const BACK_FAIL_M = 0.35;

function parseArgs(argv) {
  const out = {
    scenario:
      "low5v6,cruise20,pauseResumeLow,rtdbStallFs,stallStopResume,stallAccelResume,lateBundle",
    jsonOut: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scenario" && argv[i + 1]) out.scenario = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.jsonOut = resolve(process.cwd(), argv[++i]);
  }
  return out;
}

function vKmh(kmh) {
  return kmh / 3.6;
}

function truthDist(tMs, speedMps, d0 = 0) {
  return d0 + speedMps * (tMs / 1000);
}

function delayAt(pattern, k, intervalMs) {
  if (pattern === "none") return 0;
  if (pattern === "sin") {
    const j = Math.min(intervalMs * 0.9, Math.max(60, intervalMs * 0.45));
    return ((Math.sin(k * 7.13) + 1) / 2) * j;
  }
  const j = Math.min(900, Math.max(80, intervalMs * 0.85));
  return k % 2 === 0 ? j : 0;
}

const SCENARIOS = {
  low5v6: {
    label: "5 vs 6 km/h dual",
    aSpeed: vKmh(5),
    bSpeed: vKmh(6),
    a0: 100,
    b0: 100,
    jitter: "sin",
  },
  cruise20: {
    label: "20 km/h equal dual",
    aSpeed: vKmh(20),
    bSpeed: vKmh(20),
    a0: 100,
    b0: 85,
    jitter: "sin",
  },
  pauseResumeLow: {
    label: "B pause 8–12s @5km/h",
    aSpeed: vKmh(5),
    bSpeed: vKmh(5),
    a0: 100,
    b0: 90,
    jitter: "sin",
    pauseB: [8_000, 12_000],
  },
  rtdbStallFs: {
    label: "RTDB silent 10–14s → FS fallback",
    aSpeed: vKmh(5),
    bSpeed: vKmh(5),
    a0: 100,
    b0: 90,
    jitter: "none",
    stallBRtdb: [10_000, 14_000],
    /**
     * residual 위치일치만 stall 구간 제외(FS 4s 성김 한계 보고용).
     * 점프/역행/axisFlip 게이트는 공백·복구 포함 **전체** 프레임.
     * exclusion 추가·수치 완화로 합격 만들지 말 것(상수속 before 와 동일 상한).
     */
    residualExcludeMs: [10_000, 16_000],
    stallLimit: true,
  },
  stallStopResume: {
    label: "RTDB silent + B stop then RTDB recover",
    aSpeed: vKmh(5),
    bSpeed: vKmh(5),
    a0: 100,
    b0: 90,
    jitter: "none",
    stallBRtdb: [8_000, 16_000],
    pauseB: [10_000, 14_000],
    residualExcludeMs: [8_000, 18_000],
    stallLimit: true,
  },
  stallAccelResume: {
    label: "RTDB silent + B accel 5→15 then recover",
    aSpeed: vKmh(5),
    bSpeed: vKmh(5),
    a0: 100,
    b0: 90,
    jitter: "none",
    stallBRtdb: [8_000, 16_000],
    accelB: { fromMs: 10_000, toMs: 14_000, fromKmh: 5, toKmh: 15 },
    residualExcludeMs: [8_000, 18_000],
    stallLimit: true,
  },
  lateBundle: {
    label: "bundle jitter + late samples @5/6",
    aSpeed: vKmh(5),
    bSpeed: vKmh(6),
    a0: 100,
    b0: 100,
    jitter: "bundle",
  },
};

async function loadView(vite) {
  return {
    registry: await vite.ssrLoadModule("/src/lib/peerMotion/PeerMotionRegistry.ts"),
    sync: await vite.ssrLoadModule("/src/lib/peerMotion/syncFromPresence.ts"),
    encode: await vite.ssrLoadModule("/src/lib/peerMotion/repo/rtdbTrailMotion.ts"),
    clock: await vite.ssrLoadModule("/src/lib/peerMotion/repo/serverClockOffset.ts"),
    selfBuf: await vite.ssrLoadModule("/src/lib/peerMotion/selfDisplayBuffer.ts"),
    disp: await vite.ssrLoadModule("/src/lib/peerMotion/commonDisplayClock.ts"),
    select: null,
  };
}

function speedAt(sc, who, t) {
  if (who === "b" && sc.pauseB) {
    const [p0, p1] = sc.pauseB;
    if (t >= p0 && t < p1) return 0;
  }
  if (who === "b" && sc.accelB) {
    const { fromMs, toMs, fromKmh, toKmh } = sc.accelB;
    if (t < fromMs) return vKmh(fromKmh);
    if (t >= toMs) return vKmh(toKmh);
    const u = (t - fromMs) / Math.max(1, toMs - fromMs);
    return vKmh(fromKmh + (toKmh - fromKmh) * u);
  }
  return who === "a" ? sc.aSpeed : sc.bSpeed;
}

function distAt(sc, who, t) {
  const d0 = who === "a" ? sc.a0 : sc.b0;
  if (who === "b" && sc.pauseB) {
    const speed = sc.bSpeed;
    const [p0, p1] = sc.pauseB;
    if (t < p0) return truthDist(t, speed, d0);
    if (t < p1) return truthDist(p0, speed, d0);
    return truthDist(t - p1, speed, truthDist(p0, speed, d0));
  }
  if (who === "b" && sc.accelB) {
    // 속도 프로파일을 1ms 적분(하네스 전용 — 제품 경로 아님)
    let d = d0;
    const step = 50;
    for (let s = 0; s < t; s += step) {
      const dt = Math.min(step, t - s) / 1000;
      d += speedAt(sc, "b", s) * dt;
    }
    return d;
  }
  const speed = who === "a" ? sc.aSpeed : sc.bSpeed;
  return truthDist(t, speed, d0);
}

function summarize(frames, sc = {}) {
  const excl = sc.residualExcludeMs || null;
  let residualMin = Infinity;
  let residualMax = -Infinity;
  let residualMinAll = Infinity;
  let residualMaxAll = -Infinity;
  let maxPeerJump = 0;
  let maxSelfJump = 0;
  let maxBack = 0;
  let reverse = 0;
  let axisFlip = 0;
  let fsPick = 0;
  let maxFrameVel = 0;
  let prevPeer = null;
  let prevSelf = null;
  let prevT = null;
  let prevAxis = null;
  const residuals = [];

  for (const f of frames) {
    const residual = f.gapA - f.truthGap;
    if (residual < residualMinAll) residualMinAll = residual;
    if (residual > residualMaxAll) residualMaxAll = residual;
    const inExcl = excl && f.t >= excl[0] && f.t < excl[1];
    if (!inExcl) {
      residuals.push(residual);
      if (residual < residualMin) residualMin = residual;
      if (residual > residualMax) residualMax = residual;
    }
    if (f.source === "fs") fsPick += 1;
    if (prevAxis != null && f.serverTimeline !== prevAxis) axisFlip += 1;
    prevAxis = f.serverTimeline;

    if (prevPeer != null && prevT != null) {
      const dt = (f.t - prevT) / 1000;
      const peerJump = Math.abs(f.peerB - prevPeer);
      const selfJump = Math.abs(f.selfA - prevSelf);
      if (peerJump > maxPeerJump) maxPeerJump = peerJump;
      if (selfJump > maxSelfJump) maxSelfJump = selfJump;
      const back = prevPeer - f.peerB;
      if (back > maxBack) maxBack = back;
      if (back > BACK_FAIL_M) reverse += 1;
      if (dt > 0) {
        const vel = Math.abs((f.peerB - prevPeer) / dt);
        if (vel > maxFrameVel) maxFrameVel = vel;
      }
    }
    prevPeer = f.peerB;
    prevSelf = f.selfA;
    prevT = f.t;
  }

  const residualPp = residuals.length ? residualMax - residualMin : 0;
  const residualPpAll =
    Number.isFinite(residualMinAll) ? residualMaxAll - residualMinAll : 0;
  let mean = 0;
  for (const r of residuals) mean += r;
  mean = residuals.length ? mean / residuals.length : 0;
  let varSum = 0;
  for (const r of residuals) varSum += (r - mean) ** 2;
  const residualStd = residuals.length ? Math.sqrt(varSum / residuals.length) : 0;

  const violations = [];
  // 점프/역행/axis — 공백·복구 포함 전체 구간(동일 상한; exclusion 없음)
  if (axisFlip > 0) {
    violations.push(`axisFlipCount=${axisFlip} (serverTimeline↔legacy)`);
  }
  if (maxPeerJump > FRAME_JUMP_FAIL_M) {
    violations.push(`maxPeerJump ${maxPeerJump.toFixed(3)}m > ${FRAME_JUMP_FAIL_M}m`);
  }
  if (reverse > 0) {
    violations.push(`reverseFrames=${reverse} back>${BACK_FAIL_M}m`);
  }
  // 위치 residual — 정상 구간(excl 밖). residualPpAll 은 보고만(합격 완화에 쓰지 않음).
  if (residualPp > RESIDUAL_PP_FAIL_M) {
    violations.push(`residualPp ${residualPp.toFixed(3)}m > ${RESIDUAL_PP_FAIL_M}m`);
  }

  return {
    frames: frames.length,
    residualPpM: round3(residualPp),
    residualPpAllM: round3(residualPpAll),
    residualStdM: round3(residualStd),
    residualMeanM: round3(mean),
    maxPeerJumpM: round3(maxPeerJump),
    maxSelfJumpM: round3(maxSelfJump),
    maxBackM: round3(maxBack),
    reverseFrames: reverse,
    maxFrameVelMps: round3(maxFrameVel),
    axisFlipCount: axisFlip,
    fsPickFrames: fsPick,
    stallLimit: Boolean(sc.stallLimit),
    residualExcludeMs: excl,
    residualGateNote: excl
      ? "residualPp excludes stall window; jump/back/axisFlip use full window"
      : "all gates use full window",
    violations,
    pass: violations.length === 0,
  };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

async function runScenario(viteA, viteB, key) {
  const sc = SCENARIOS[key];
  const A = await loadView(viteA);
  const B = await loadView(viteB);
  A.registry.resetPeerMotionRegistry();
  B.registry.resetPeerMotionRegistry();
  A.sync.resetPeerMotionRtdbContentObservations();
  B.sync.resetPeerMotionRtdbContentObservations();
  A.selfBuf.resetSelfDisplayBuffer();
  B.selfBuf.resetSelfDisplayBuffer();
  A.disp.resetCommonDisplayClock();
  B.disp.resetCommonDisplayClock();
  A.clock.__setServerTimeOffsetForTests(0, { ready: true, uncertain: false });
  B.clock.__setServerTimeOffsetForTests(0, { ready: true, uncertain: false });

  const regA = A.registry.getPeerMotionRegistry();
  const regB = B.registry.getPeerMotionRegistry();
  /** pending deliveries: {at, to, row, kind:'rtdb'|'fs'} */
  const pending = [];
  let seqA = 0;
  let seqB = 0;
  let lastSend = -RTDB_MS;
  let nextFs = FS_MS;
  let lastFsCapA = 0;
  let lastFsCapB = 0;
  const frames = [];
  let activeNow = WALL;
  const realNow = Date.now.bind(Date);
  const realDebug = console.debug;
  const realInfo = console.info;
  const realLog = console.log;
  Date.now = () => activeNow;
  console.debug = (...args) => {
    if (String(args[0] ?? "").includes("[peerSyncChain]")) return;
    realDebug(...args);
  };
  console.info = (...args) => {
    const head = String(args[0] ?? "");
    if (head.includes("[peerAlive]") || head.includes("[peerSmooth]")) return;
    realInfo(...args);
  };
  console.log = (...args) => {
    const head = String(args[0] ?? "");
    if (head.includes("[peerSmooth]") || head.includes("[peerAlive]")) return;
    realLog(...args);
  };

  const motionA = { rows: [] };
  const motionB = { rows: [] };
  const liveA = { rows: [] }; // FS of B as seen by A
  const liveB = { rows: [] };

  function encodeRow(who, t, wall) {
    const dist = distAt(sc, who, t);
    const speed = speedAt(sc, who, t);
    const phase = speed <= 0.02 && sc.pauseB ? "paused" : "live";
    const tSrv = wall; // offset 0
    const snap = {
      publicationId: PUB,
      distM: dist,
      speedMps: speed,
      ridePhase: phase,
      tSrv,
    };
    const mod = who === "a" ? A : B;
    const pay = mod.encode.encodePayload(snap);
    const uid = who === "a" ? UID_A : UID_B;
    const row = mod.encode.decodeTrailMotionPayload(uid, pay);
    row.serverAtMs = wall;
    row.seq = who === "a" ? ++seqA : ++seqB;
    return { row, dist, speed, tSrv, phase };
  }

  function makeFsRow(who, captureMs, recvLocalMs) {
    const dist = distAt(sc, who, captureMs);
    const speed = speedAt(sc, who, captureMs);
    return {
      uid: who === "a" ? UID_A : UID_B,
      publicationId: PUB,
      progressRatio: dist / ROUTE_LEN,
      distMeters: dist,
      lastSeenAtMs: WALL + captureMs,
      receivedAtLocalMs: WALL + recvLocalMs,
      displayName: who === "a" ? "A" : "B",
      speedMps: speed,
      ridePhase: speed <= 0.02 && sc.pauseB ? "paused" : "live",
    };
  }

  function syncView(view, myUid, motionRows, liveRows, wall) {
    activeNow = wall;
    view.sync.syncPeerMotionFromPresence({
      publicationId: PUB,
      myUid,
      motionRows,
      liveRideRows: liveRows,
      sessionMembers: [],
      guestUidsSorted: [],
      routeLenM: ROUTE_LEN,
      nowMs: wall,
    });
  }

  try {
    let sendK = 0;
    for (let t = 0; t <= RUN_MS; t += STEP_MS) {
      const wall = WALL + t;
      activeNow = wall;

      if (t - lastSend >= RTDB_MS - 1e-6) {
        lastSend = t;
        sendK += 1;
        const encA = encodeRow("a", t, wall);
        const encB = encodeRow("b", t, wall);

        // self enqueue (fanout)
        A.selfBuf.pushSelfDisplaySample({
          tSrv: encA.tSrv,
          distM: encA.dist,
          speedMps: encA.speed,
        });
        B.selfBuf.pushSelfDisplaySample({
          tSrv: encB.tSrv,
          distM: encB.dist,
          speedMps: encB.speed,
        });

        const dly = delayAt(sc.jitter, sendK, RTDB_MS);
        const arriveAtoB = t + RTT_MS + dly;
        const arriveBtoA = t + RTT_MS + delayAt(sc.jitter, sendK + 17, RTDB_MS);

        const stallB =
          sc.stallBRtdb && t >= sc.stallBRtdb[0] && t < sc.stallBRtdb[1];

        pending.push({ at: arriveAtoB, to: "B", row: encA.row, kind: "rtdb" });
        if (!stallB) {
          pending.push({ at: arriveBtoA, to: "A", row: encB.row, kind: "rtdb" });
        }
      }

      if (t >= nextFs) {
        nextFs = t + FS_MS;
        // FS capture ≈ now − RTT (commit lag); may lead RTDB under delay
        const cap = Math.max(0, t - RTT_MS);
        lastFsCapA = cap;
        lastFsCapB = cap;
        pending.push({
          at: t + 40,
          to: "A",
          row: makeFsRow("b", lastFsCapB, t),
          kind: "fs",
        });
        pending.push({
          at: t + 40,
          to: "B",
          row: makeFsRow("a", lastFsCapA, t),
          kind: "fs",
        });
      }

      for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i];
        if (p.at > t) continue;
        pending.splice(i, 1);
        if (p.to === "A") {
          if (p.kind === "rtdb") motionA.rows = [p.row];
          else liveA.rows = [p.row];
        } else {
          if (p.kind === "rtdb") motionB.rows = [p.row];
          else liveB.rows = [p.row];
        }
      }

      // Presence sync every frame (product)
      syncView(A, UID_A, motionA.rows, liveA.rows, wall);
      syncView(B, UID_B, motionB.rows, liveB.rows, wall);

      A.disp.setCompanionDisplayActive(true);
      B.disp.setCompanionDisplayActive(true);

      activeNow = wall;
      const rtA = A.disp.ensureFrameDisplayRenderTimeMs(wall);
      const delayedA = A.selfBuf.sampleSelfDisplayDistM(rtA);
      const selfA =
        delayedA != null && A.disp.companionDisplayDelayMs() > 0 ? delayedA : distAt(sc, "a", t);

      const rtB = B.disp.ensureFrameDisplayRenderTimeMs(wall);
      const delayedB = B.selfBuf.sampleSelfDisplayDistM(rtB);
      const selfB =
        delayedB != null && B.disp.companionDisplayDelayMs() > 0 ? delayedB : distAt(sc, "b", t);

      regA.step(STEP_MS / 1000, null, wall);
      regB.step(STEP_MS / 1000, null, wall);

      if (t < WARMUP_MS) continue;

      const peerB = regA.getRawDisplayDistM(UID_B);
      const peerA = regB.getRawDisplayDistM(UID_A);
      if (peerB == null || peerA == null) continue;

      // diagnose from entity axis + whether FS rows are present during RTDB stale window
      let source = "none";
      let serverTimeline = null;
      const ent = regA.entities?.get?.(UID_B);
      if (ent) serverTimeline = ent.serverTimeline;
      const stallB =
        sc.stallBRtdb && t >= sc.stallBRtdb[0] && t < sc.stallBRtdb[1];
      if (stallB && liveA.rows[0]) source = "fs";
      else if (motionA.rows[0]) source = "rtdb";
      else if (liveA.rows[0]) source = "fs";

      const truthA = distAt(sc, "a", Math.max(0, t - D));
      const truthB = distAt(sc, "b", Math.max(0, t - D));
      frames.push({
        t,
        selfA,
        selfB,
        peerB,
        peerA,
        gapA: selfA - peerB,
        truthGap: truthA - truthB,
        source,
        serverTimeline,
      });
    }
  } finally {
    Date.now = realNow;
    console.debug = realDebug;
    console.info = realInfo;
    console.log = realLog;
  }

  const metrics = summarize(frames, sc);
  return {
    scenario: key,
    label: sc.label,
    rtdbMs: RTDB_MS,
    fsMs: FS_MS,
    delayMs: D,
    ...metrics,
  };
}

async function main() {
  const t0 = performance.now();
  const args = parseArgs(process.argv);
  const names = args.scenario.split(",").map((s) => s.trim()).filter(Boolean);

  const viteA = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  const viteB = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  const results = [];
  try {
    for (const name of names) {
      if (!SCENARIOS[name]) throw new Error(`unknown scenario ${name}`);
      if (performance.now() - t0 > HARD_MS) throw new Error("hard timeout");
      const r = await runScenario(viteA, viteB, name);
      results.push(r);
      const mark = r.pass ? "PASS" : "FAIL";
      console.log(
        `${mark} ${name} residualPp=${r.residualPpM}m residualPpAll=${r.residualPpAllM}m ` +
          `peerJump=${r.maxPeerJumpM}m back=${r.maxBackM}m axisFlip=${r.axisFlipCount} ` +
          `fsPick=${r.fsPickFrames} vel=${r.maxFrameVelMps} ${r.violations.join("; ") || "ok"}`,
      );
    }
  } finally {
    await viteA.close();
    await viteB.close();
  }

  const fail = results.filter((r) => !r.pass).length;
  const out = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - t0),
    gates: {
      residualPpFailM: RESIDUAL_PP_FAIL_M,
      frameJumpFailM: FRAME_JUMP_FAIL_M,
      backFailM: BACK_FAIL_M,
    },
    results,
    requiredFail: fail,
    pass: fail === 0,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = args.jsonOut || resolve(OUT_DIR, "residual-peer-jitter-metrics.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  const opsPath = resolve(OPS_DIR, "residual-peer-jitter-metrics.json");
  writeFileSync(opsPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`wrote ${outPath}`);
  console.log(`wrote ${opsPath}`);
  console.log(`elapsed=${out.elapsedMs}ms requiredFail=${fail}`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

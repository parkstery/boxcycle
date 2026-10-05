/**
 * 공통 600ms 표시 — **실제 제품 경로** BEFORE/AFTER 재생.
 *
 * BEFORE: self 즉시 · peer 수신축(과거) — 창 간 순서 불일치 재현
 * AFTER: encodePayload(tSrv) → decode → stamp(tSrv bypass) → Registry×2
 *        + selfDisplayBuffer @ **enqueue 직후 local** (fanout 과 동일)
 *        peer 만 delivery/drop; stall 시 self 표본은 계속
 *
 * 간격/점프는 debugSnapshot 반올림이 아니라 **raw displayDistM**.
 * accel 속도는 거리 도함수.
 *
 *   cd apps/web && node scripts/peer-sync/common-display-product-harness.mjs
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

const PUB = "pub-common-display";
const UID_A = "rider-A";
const UID_B = "rider-B";
const WALL = 1_700_000_000_000;
const STEP_MS = 1000 / 60;
const RUN_MS = 20_000;
const WARMUP_MS = 4_000;
const INTERVAL_MS = 200;
const D = 600;
const TIE_M = 0.05;
const V = 20 / 3.6;
const HARD_TIMEOUT_MS = 120_000;

function parseArgs(argv) {
  const out = {
    scenario: "gap15,gap1,pass,accel,asym,stall,pauseResume,fsOnly,legacyNoTsrv,offsetNotReady,clockJump,oneWayStall,soloLeave",
    eps: "0,100,-100",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scenario" && argv[i + 1]) out.scenario = argv[++i];
    else if (a === "--eps" && argv[i + 1]) out.eps = argv[++i];
  }
  return out;
}

function truthDist(tMs, v0, a = 0, d0 = 0) {
  const t = tMs / 1000;
  return d0 + v0 * t + 0.5 * a * t * t;
}

function truthSpeedAt(fn, tMs, dt = STEP_MS) {
  const t0 = Math.max(0, tMs - dt);
  const d0 = fn(t0);
  const d1 = fn(tMs);
  const sec = (tMs - t0) / 1000;
  return sec > 0 ? (d1 - d0) / sec : V;
}

const SCENARIOS = {
  gap15: {
    label: "const gap15",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(t, V, 0, 85),
    linkAbMs: 40,
    linkBaMs: 40,
  },
  gap1: {
    label: "const gap1",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(t, V, 0, 99),
    linkAbMs: 40,
    linkBaMs: 40,
  },
  pass: {
    label: "pass",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(t, V * 1.25, 0, 80),
    linkAbMs: 40,
    linkBaMs: 40,
  },
  accel: {
    label: "accel 20→30→10",
    a: (t) => {
      if (t < 8_000) return truthDist(t, V, 0, 100);
      if (t < 14_000) return truthDist(t - 8_000, 30 / 3.6, 0, truthDist(8_000, V, 0, 100));
      return truthDist(t - 14_000, 10 / 3.6, 0, truthDist(6_000, 30 / 3.6, 0, truthDist(8_000, V, 0, 100)));
    },
    b: (t) => truthDist(t, V, 0, 90),
    linkAbMs: 40,
    linkBaMs: 40,
  },
  asym: {
    label: "asym link",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(t, V, 0, 88),
    linkAbMs: 20,
    linkBaMs: 180,
  },
  stall: {
    label: "stall B",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(Math.min(t, 10_000), V, 0, 90),
    linkAbMs: 40,
    linkBaMs: 40,
    stallBAfterMs: 10_000,
  },
  pauseResume: {
    label: "B pause 8–12s",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => {
      if (t < 8_000) return truthDist(t, V, 0, 90);
      if (t < 12_000) return truthDist(8_000, V, 0, 90);
      return truthDist(t - 12_000, V, 0, truthDist(8_000, V, 0, 90));
    },
    phaseB: (t) => (t >= 8_000 && t < 12_000 ? "paused" : "live"),
    linkAbMs: 40,
    linkBaMs: 40,
  },
  fsOnly: {
    label: "FS-only (no tSrv)",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(t, V, 0, 88),
    linkAbMs: 40,
    linkBaMs: 40,
    forceLegacyWire: true,
  },
  legacyNoTsrv: {
    label: "legacy no tSrv",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(t, V, 0, 90),
    linkAbMs: 40,
    linkBaMs: 40,
    forceLegacyWire: true,
  },
  offsetNotReady: {
    label: "offset not ready",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(t, V, 0, 90),
    linkAbMs: 40,
    linkBaMs: 40,
    clockReady: false,
  },
  clockJump: {
    label: "clock jump mid-run",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(t, V, 0, 90),
    linkAbMs: 40,
    linkBaMs: 40,
    clockJumpAtMs: 10_000,
    clockJumpDeltaMs: 8_000,
  },
  oneWayStall: {
    label: "A→B stall only",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(t, V, 0, 90),
    linkAbMs: 40,
    linkBaMs: 40,
    stallAAfterMs: 10_000,
  },
  soloLeave: {
    label: "B leaves at 10s (D600→0)",
    a: (t) => truthDist(t, V, 0, 100),
    b: (t) => truthDist(t, V, 0, 90),
    linkAbMs: 40,
    linkBaMs: 40,
    leaveBAtMs: 10_000,
  },
};

async function loadViewModules(vite) {
  const registryMod = await vite.ssrLoadModule("/src/lib/peerMotion/PeerMotionRegistry.ts");
  const syncMod = await vite.ssrLoadModule("/src/lib/peerMotion/syncFromPresence.ts");
  const encodeMod = await vite.ssrLoadModule("/src/lib/peerMotion/repo/rtdbTrailMotion.ts");
  const clockMod = await vite.ssrLoadModule("/src/lib/peerMotion/repo/serverClockOffset.ts");
  const selfBuf = await vite.ssrLoadModule("/src/lib/peerMotion/selfDisplayBuffer.ts");
  const dispClock = await vite.ssrLoadModule("/src/lib/peerMotion/commonDisplayClock.ts");
  return { registryMod, syncMod, encodeMod, clockMod, selfBuf, dispClock };
}

function sign(x, tie = TIE_M) {
  if (Math.abs(x) < tie) return 0;
  return x > 0 ? 1 : -1;
}

function summarize(frames, opts = {}) {
  const nearTieExcl = opts.nearTieExclM ?? null;
  let opposite = 0;
  let oppositeExcl = 0;
  let n = 0;
  let nExcl = 0;
  let maxJump = 0;
  let maxSpeedDisc = 0;
  let prevSelfA = null;
  let prevT = null;
  for (const f of frames) {
    n += 1;
    const sA = sign(f.gapA);
    const sB = sign(f.gapAFromB);
    if (sA !== 0 && sB !== 0 && sA !== sB) opposite += 1;
    const near = nearTieExcl != null && Math.abs(f.truthGap) < nearTieExcl;
    if (!near) {
      nExcl += 1;
      if (sA !== 0 && sB !== 0 && sA !== sB) oppositeExcl += 1;
    }
    if (prevSelfA != null && prevT != null) {
      const jump = Math.abs(f.selfA - prevSelfA);
      if (jump > maxJump) maxJump = jump;
      const dt = (f.t - prevT) / 1000;
      if (dt > 0) {
        const spd = Math.abs((f.selfA - prevSelfA) / dt);
        const expected = f.selfSpeedTruthA ?? V;
        const disc = Math.abs(spd - expected);
        if (disc > maxSpeedDisc) maxSpeedDisc = disc;
      }
    }
    prevSelfA = f.selfA;
    prevT = f.t;
  }
  return {
    frames: n,
    oppositeSign: opposite,
    oppositeSignRate: n ? opposite / n : 0,
    oppositeSignExclNearTie: oppositeExcl,
    oppositeSignExclRate: nExcl ? oppositeExcl / nExcl : 0,
    maxSelfJumpM: Math.round(maxJump * 1000) / 1000,
    maxSpeedDiscMps: Math.round(maxSpeedDisc * 1000) / 1000,
  };
}

async function runPair(viteA, viteB, scenarioKey, epsA, epsB, mode) {
  const sc = SCENARIOS[scenarioKey];
  const A = await loadViewModules(viteA);
  const B = await loadViewModules(viteB);

  A.registryMod.resetPeerMotionRegistry();
  B.registryMod.resetPeerMotionRegistry();
  A.syncMod.resetPeerMotionRtdbContentObservations();
  B.syncMod.resetPeerMotionRtdbContentObservations();
  A.selfBuf.resetSelfDisplayBuffer();
  B.selfBuf.resetSelfDisplayBuffer();
  A.dispClock.resetCommonDisplayClock();
  B.dispClock.resetCommonDisplayClock();

  const clockReady = sc.clockReady !== false;
  A.clockMod.__setServerTimeOffsetForTests(clockReady ? epsA : null, {
    ready: clockReady,
    uncertain: false,
  });
  B.clockMod.__setServerTimeOffsetForTests(clockReady ? epsB : null, {
    ready: clockReady,
    uncertain: false,
  });

  const regA = A.registryMod.getPeerMotionRegistry();
  const regB = B.registryMod.getPeerMotionRegistry();

  const pending = [];
  let lastSend = -INTERVAL_MS;
  const frames = [];
  let publishCount = 0;
  let encodeBytes = 0;
  let tSrvExtraSum = 0;
  let tSrvExtraN = 0;
  let activeNow = WALL;
  let clockJumpApplied = false;
  const realNow = Date.now.bind(Date);
  Date.now = () => activeNow;

  try {
    for (let t = 0; t <= RUN_MS; t += STEP_MS) {
      const wall = WALL + t;
      activeNow = wall;

      if (
        sc.clockJumpAtMs != null &&
        !clockJumpApplied &&
        t >= sc.clockJumpAtMs &&
        mode === "after"
      ) {
        clockJumpApplied = true;
        const nextA = epsA + sc.clockJumpDeltaMs;
        const nextB = epsB + sc.clockJumpDeltaMs;
        // 제품: discontinuity → self buffer + serverTimeline rebase
        A.selfBuf.resetSelfDisplayBuffer();
        B.selfBuf.resetSelfDisplayBuffer();
        A.dispClock.resetCommonDisplayClock();
        B.dispClock.resetCommonDisplayClock();
        regA.rebaseServerTimelineEntities();
        regB.rebaseServerTimelineEntities();
        A.clockMod.__setServerTimeOffsetForTests(nextA, { ready: true, uncertain: true });
        B.clockMod.__setServerTimeOffsetForTests(nextB, { ready: true, uncertain: true });
      }

      const distA = sc.a(t);
      const distB = sc.b(t);
      const speedA = truthSpeedAt(sc.a, t);
      const speedB = truthSpeedAt(sc.b, t);
      const phaseA = "live";
      const phaseB = sc.phaseB ? sc.phaseB(t) : "live";
      const bLeft = sc.leaveBAtMs != null && t >= sc.leaveBAtMs;

      if (t - lastSend >= INTERVAL_MS - 1e-6) {
        lastSend = t;
        activeNow = wall;
        const offA = A.clockMod.peekServerTimeOffsetMs();
        const offB = B.clockMod.peekServerTimeOffsetMs();
        const tSrvA = offA != null ? wall + offA : undefined;
        const tSrvB = offB != null ? wall + offB : undefined;
        const useTsrv = mode === "after" && !sc.forceLegacyWire && clockReady;

        const snapA = {
          publicationId: PUB,
          distM: distA,
          speedMps: phaseA === "paused" ? 0 : speedA,
          ridePhase: phaseA,
          ...(useTsrv && tSrvA != null ? { tSrv: tSrvA } : {}),
        };
        const snapB = {
          publicationId: PUB,
          distM: distB,
          speedMps: phaseB === "paused" ? 0 : speedB,
          ridePhase: phaseB,
          ...(useTsrv && tSrvB != null ? { tSrv: tSrvB } : {}),
        };

        // 제품 fanout: enqueue 직후 **local** self 표본 (delivery 와 무관)
        if (mode === "after" && useTsrv && tSrvA != null) {
          A.selfBuf.pushSelfDisplaySample({
            tSrv: tSrvA,
            distM: distA,
            speedMps: snapA.speedMps,
          });
        }
        if (mode === "after" && useTsrv && tSrvB != null && !bLeft) {
          B.selfBuf.pushSelfDisplaySample({
            tSrv: tSrvB,
            distM: distB,
            speedMps: snapB.speedMps,
          });
        }

        const payA = A.encodeMod.encodePayload(snapA);
        const payB = B.encodeMod.encodePayload(snapB);
        publishCount += bLeft ? 1 : 2;
        encodeBytes +=
          Buffer.byteLength(JSON.stringify(payA), "utf8") +
          (bLeft ? 0 : Buffer.byteLength(JSON.stringify(payB), "utf8"));
        const noT = { ...payA };
        delete noT.tSrv;
        tSrvExtraSum +=
          Buffer.byteLength(JSON.stringify(payA), "utf8") -
          Buffer.byteLength(JSON.stringify(noT), "utf8");
        tSrvExtraN += 1;

        const rowA = A.encodeMod.decodeTrailMotionPayload(UID_A, payA);
        const rowB = B.encodeMod.decodeTrailMotionPayload(UID_B, payB);
        if (!rowA || (!bLeft && !rowB)) throw new Error("decode failed");
        rowA.serverAtMs = wall;
        if (rowB) rowB.serverAtMs = wall;

        const deliverA =
          mode === "before" || sc.forceLegacyWire || !useTsrv
            ? { ...rowA, tSrv: undefined }
            : rowA;
        const deliverB =
          rowB == null
            ? null
            : mode === "before" || sc.forceLegacyWire || !useTsrv
              ? { ...rowB, tSrv: undefined }
              : rowB;

        const stallA = sc.stallAAfterMs != null && t >= sc.stallAAfterMs;
        const stallB = sc.stallBAfterMs != null && t >= sc.stallBAfterMs;

        // peer 만 pending delivery — self 는 이미 local push
        if (!stallA) {
          pending.push({ at: t + sc.linkAbMs, to: "B", row: deliverA });
        }
        if (!stallB && !bLeft && deliverB) {
          pending.push({ at: t + sc.linkBaMs, to: "A", row: deliverB });
        }
      }

      for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i];
        if (p.at > t) continue;
        pending.splice(i, 1);
        if (p.to === "A") {
          activeNow = wall + (A.clockMod.peekServerTimeOffsetMs() ?? 0);
          A.syncMod.syncPeerMotionFromPresence({
            publicationId: PUB,
            myUid: UID_A,
            motionRows: [p.row],
            liveRideRows: [],
            sessionMembers: [],
            guestUidsSorted: [],
            nowMs: wall + (A.clockMod.peekServerTimeOffsetMs() ?? 0),
          });
        } else if (!bLeft) {
          activeNow = wall + (B.clockMod.peekServerTimeOffsetMs() ?? 0);
          B.syncMod.syncPeerMotionFromPresence({
            publicationId: PUB,
            myUid: UID_B,
            motionRows: [p.row],
            liveRideRows: [],
            sessionMembers: [],
            guestUidsSorted: [],
            nowMs: wall + (B.clockMod.peekServerTimeOffsetMs() ?? 0),
          });
        }
      }

      if (bLeft) {
        // leave: companion 비활성 + peer 제거 (제품 sync markActiveUids=[])
        B.dispClock.setCompanionDisplayActive(false);
        A.dispClock.setCompanionDisplayActive(false);
        regA.remove(UID_B);
        A.syncMod.syncPeerMotionFromPresence({
          publicationId: PUB,
          myUid: UID_A,
          motionRows: [],
          liveRideRows: [],
          sessionMembers: [],
          guestUidsSorted: [],
          nowMs: wall + (A.clockMod.peekServerTimeOffsetMs() ?? 0),
        });
      }

      const offANow = A.clockMod.peekServerTimeOffsetMs() ?? 0;
      const offBNow = B.clockMod.peekServerTimeOffsetMs() ?? 0;
      const nowA = wall + (clockReady ? offANow : 0);
      const nowB = wall + (clockReady ? offBNow : 0);

      // 제품 MapView 순서: self sample → peer step (동일 frame renderTime)
      let selfA;
      let selfB;
      if (mode === "after") {
        if (!bLeft) {
          A.dispClock.setCompanionDisplayActive(true);
          B.dispClock.setCompanionDisplayActive(true);
        }
        activeNow = nowA;
        const rtA = A.dispClock.ensureFrameDisplayRenderTimeMs(nowA);
        const delayedA = A.selfBuf.sampleSelfDisplayDistM(rtA);
        const delayA = A.dispClock.companionDisplayDelayMs();
        const catchingA = A.dispClock.isDisplayRenderCatchingUp(nowA);
        selfA =
          delayedA != null && (delayA > 0 || catchingA) ? delayedA : distA;
        activeNow = nowB;
        const rtB = B.dispClock.ensureFrameDisplayRenderTimeMs(nowB);
        const delayedB = B.selfBuf.sampleSelfDisplayDistM(rtB);
        const delayB = B.dispClock.companionDisplayDelayMs();
        const catchingB = B.dispClock.isDisplayRenderCatchingUp(nowB);
        selfB =
          delayedB != null && (delayB > 0 || catchingB) ? delayedB : distB;
      } else {
        selfA = distA;
        selfB = distB;
      }

      activeNow = nowA;
      regA.step(STEP_MS / 1000, null, nowA);
      activeNow = nowB;
      regB.step(STEP_MS / 1000, null, nowB);

      if (t < WARMUP_MS) continue;

      const peerBOnA = regA.getRawDisplayDistM(UID_B);
      const peerAOnB = regB.getRawDisplayDistM(UID_A);

      // soloLeave 이후는 창 간 순서 게이트 대상 아님(peer 없음)
      if (bLeft) {
        frames.push({
          t,
          selfA,
          selfB,
          peerB: null,
          peerA: null,
          gapA: 0,
          gapAFromB: 0,
          truthGap: distA - distB,
          selfSpeedTruthA: speedA,
          solo: true,
          selfJumpProbe: selfA,
        });
        continue;
      }
      if (peerBOnA == null || peerAOnB == null) continue;

      const gapA = selfA - peerBOnA;
      const gapAFromB = peerAOnB - selfB;
      frames.push({
        t,
        selfA,
        selfB,
        peerB: peerBOnA,
        peerA: peerAOnB,
        gapA,
        gapAFromB,
        truthGap: distA - distB,
        selfSpeedTruthA: speedA,
      });
    }
  } finally {
    Date.now = realNow;
  }

  const paired = frames.filter((f) => !f.solo);
  const soloFrames = frames.filter((f) => f.solo);
  let maxSoloJump = 0;
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].t < (sc.leaveBAtMs ?? Infinity) - STEP_MS) continue;
    if (frames[i].t > (sc.leaveBAtMs ?? 0) + 3_000) break;
    const jump = Math.abs(frames[i].selfA - frames[i - 1].selfA);
    if (jump > maxSoloJump) maxSoloJump = jump;
  }

  const bytesPerMsg =
    publishCount > 0 ? Math.round((encodeBytes / publishCount) * 10) / 10 : 0;
  const tSrvExtraPerMsg =
    tSrvExtraN > 0 ? Math.round((tSrvExtraSum / tSrvExtraN) * 10) / 10 : 0;

  return {
    scenario: scenarioKey,
    label: sc.label,
    mode,
    epsA,
    epsB,
    ...summarize(paired, { nearTieExclM: 1.4 }),
    soloFrames: soloFrames.length,
    maxSelfJumpAroundLeaveM: Math.round(maxSoloJump * 1000) / 1000,
    publishCount,
    bytesPerMsgAvg: bytesPerMsg,
    tSrvExtraBytesPerEncodeApprox: tSrvExtraPerMsg,
    intervalMs: INTERVAL_MS,
    delayMs: mode === "after" ? D : null,
    productPathNotes: {
      selfSampleAt: "enqueue_local",
      peerMetric: "raw_displayDistM",
      accelSpeed: "distance_derivative",
      forceLegacyWire: Boolean(sc.forceLegacyWire),
      clockReady,
    },
  };
}

async function main() {
  const started = performance.now();
  const args = parseArgs(process.argv);
  const scenarios = args.scenario.split(",").map((s) => s.trim()).filter(Boolean);
  const epsList = args.eps.split(",").map((s) => Number(s.trim()));

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

  const results = { before: [], after: [], meta: {}, special: [] };
  try {
    for (const sc of scenarios) {
      if (!SCENARIOS[sc]) throw new Error(`unknown scenario ${sc}`);
      const special =
        sc === "offsetNotReady" ||
        sc === "clockJump" ||
        sc === "fsOnly" ||
        sc === "legacyNoTsrv" ||
        sc === "soloLeave" ||
        sc === "pauseResume" ||
        sc === "oneWayStall";
      if (special) {
        // special: ε0/0 only (bounded)
        results.before.push(await runPair(viteA, viteB, sc, 0, 0, "before"));
        results.after.push(await runPair(viteA, viteB, sc, 0, 0, "after"));
        continue;
      }
      for (const epsA of epsList) {
        for (const epsB of epsList) {
          if (
            Math.abs(epsA) + Math.abs(epsB) > 100 &&
            !(epsA === 100 && epsB === -100) &&
            !(epsA === -100 && epsB === 100) &&
            !(epsA === 0 && epsB === 0)
          ) {
            if (!(epsA === 0 || epsB === 0)) continue;
          }
          results.before.push(await runPair(viteA, viteB, sc, epsA, epsB, "before"));
          results.after.push(await runPair(viteA, viteB, sc, epsA, epsB, "after"));
        }
      }
    }
  } finally {
    await viteA.close();
    await viteB.close();
  }

  const elapsedMs = Math.round(performance.now() - started);
  results.meta = {
    kind: "PRODUCT_PATH_COMMON_DISPLAY",
    elapsedMs,
    hardTimeoutMs: HARD_TIMEOUT_MS,
    intervalMs: INTERVAL_MS,
    commonDelayMs: D,
    note:
      "BEFORE=self-now/peer-past(legacy stamp); AFTER=tSrv+selfBuffer@enqueue+D600; raw displayDistM; accel=d(dist)/dt",
  };

  const afterIdeal = results.after.filter(
    (r) =>
      r.epsA === 0 &&
      r.epsB === 0 &&
      !["stall", "oneWayStall", "offsetNotReady", "clockJump", "fsOnly", "legacyNoTsrv", "soloLeave"].includes(
        r.scenario,
      ),
  );
  const beforeGap1 = results.before.find((r) => r.scenario === "gap1" && r.epsA === 0 && r.epsB === 0);
  const afterGap1 = results.after.find((r) => r.scenario === "gap1" && r.epsA === 0 && r.epsB === 0);
  const afterStall = results.after.find((r) => r.scenario === "stall" && r.epsA === 0 && r.epsB === 0);
  const afterSolo = results.after.find((r) => r.scenario === "soloLeave" && r.epsA === 0 && r.epsB === 0);
  const afterOffset = results.after.find((r) => r.scenario === "offsetNotReady");
  const afterFs = results.after.find((r) => r.scenario === "fsOnly");
  const afterJump = results.after.find((r) => r.scenario === "clockJump");

  let fail = false;
  const reasons = [];
  for (const r of afterIdeal) {
    if (r.oppositeSignExclRate > 0.02) {
      fail = true;
      reasons.push(`AFTER ${r.scenario} oppositeExclRate=${r.oppositeSignExclRate}`);
    }
  }
  if (
    beforeGap1 &&
    afterGap1 &&
    beforeGap1.oppositeSignRate <= afterGap1.oppositeSignRate &&
    beforeGap1.oppositeSignRate < 0.05
  ) {
    reasons.push(
      `WARN before gap1 opposite=${beforeGap1.oppositeSignRate} after=${afterGap1.oppositeSignRate}`,
    );
  }
  if (afterStall) {
    reasons.push(
      `NOTE stall opposite=${afterStall.oppositeSignRate} (self continues at enqueue; peer dropped) — not claimed as normal trust`,
    );
  }
  if (afterSolo && afterSolo.maxSelfJumpAroundLeaveM > 2.0) {
    fail = true;
    reasons.push(`FAIL soloLeave maxSelfJumpAroundLeaveM=${afterSolo.maxSelfJumpAroundLeaveM}`);
  } else if (afterSolo) {
    reasons.push(`soloLeave maxSelfJumpAroundLeaveM=${afterSolo.maxSelfJumpAroundLeaveM}`);
  }
  if (afterOffset) {
    reasons.push(
      `offsetNotReady AFTER opposite=${afterOffset.oppositeSignRate} (not common-display claim; clockReady=false)`,
    );
  }
  if (afterFs) {
    reasons.push(
      `fsOnly/legacy AFTER opposite=${afterFs.oppositeSignRate} (legacy path; not common-display claim)`,
    );
  }
  if (afterJump) {
    reasons.push(
      `clockJump AFTER opposite=${afterJump.oppositeSignRate} (uncertain+rebase; not common-display claim during jump)`,
    );
  }

  results.special = {
    afterStallOpposite: afterStall?.oppositeSignRate ?? null,
    afterSoloLeaveJumpM: afterSolo?.maxSelfJumpAroundLeaveM ?? null,
    afterOffsetNotReadyOpposite: afterOffset?.oppositeSignRate ?? null,
    afterFsOnlyOpposite: afterFs?.oppositeSignRate ?? null,
    afterClockJumpOpposite: afterJump?.oppositeSignRate ?? null,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, "common-display-product-metrics.json");
  const opsPath = resolve(OPS_DIR, "common-display-product-metrics.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  writeFileSync(opsPath, JSON.stringify(results, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: !fail,
        elapsedMs,
        beforeGap1Opposite: beforeGap1?.oppositeSignRate ?? null,
        afterGap1Opposite: afterGap1?.oppositeSignRate ?? null,
        afterGap1OppositeExcl: afterGap1?.oppositeSignExclRate ?? null,
        afterStallOpposite: afterStall?.oppositeSignRate ?? null,
        special: results.special,
        reasons,
        outPath,
        opsPath,
      },
      null,
      2,
    ),
  );
  if (elapsedMs > HARD_TIMEOUT_MS) {
    console.error("HARD_TIMEOUT exceeded");
    process.exit(1);
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

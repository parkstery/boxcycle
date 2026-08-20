/**
 * S4-12 — S4-11 120 조합을 새 게이트로 재판정한다. 재실험 아님.
 * 측정값(편향·점프·오차·역전비율)은 S411-combos.json 을 그대로 쓴다.
 * 추가 계산: BASE(제품 10Hz + 보간 160ms)와 역행 크기(연속 구간 누적).
 * 제품 · s411-lead-eval.mjs · S411-* 는 고치지 않는다.
 *
 *   cd apps/web && node scripts/peer-sync/s412-rejudge.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const RELAY = resolve(HERE, "../../../../document/ops/sync-relay");

const GEN_DT_MS = 10;
const FRAME_HZ = 60;
const FRAME_DT = 1 / FRAME_HZ;
const PX_PER_M_FALLBACK = 83.44269102366391;
const PUBLISH_INTERVAL_MS = 100;
const INTERP_DELAY_MS = 160;
const CHIEF_GAP_M = 5;
const GATE3_MAX_ERR_M = 1.5;
const GATE4_JUMP_P99_PX = 2;
const INIT_GAP_M = 3.2;
const SELF_KMH = 5;
const DELAY_MS = [0, 100, 300];
const CLOCK_SHIFT_MS = 10_000;
const ROUTE_LEN_M = 100_000;
const A0_BIAS_TOL = 1e-12;
const A0_JUMP_TOL = 1e-9;
const A0_REV_TOL = 1e-12;
const A1_P3_BIAS_LO = 0.15;
const A1_P3_BIAS_HI = 0.30;

const RETRO_DEF =
  "역행 크기 = 표시 거리(displayDist)가 연속으로 감소한 구간의 누적 감소량. 개수가 아니라 크기. 단위 m와 px.";

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

function mean(xs) {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function loadPxPerM() {
  try {
    const j = JSON.parse(readFileSync(resolve(RELAY, "S47-scale-16m.json"), "utf8"));
    if (Number.isFinite(j.pxPerM) && j.pxPerM > 0) return j.pxPerM;
  } catch {
    /* S4-7 축척 */
  }
  return PX_PER_M_FALLBACK;
}

function toPx(m, pxPerM) {
  return m == null ? null : m * pxPerM;
}

function interpAt(samples, t) {
  const live = samples.filter((s) => !s.paused);
  if (!live.length) return null;
  if (t <= live[0].t) return live[0].distM;
  const last = live[live.length - 1];
  if (t >= last.t) {
    return last.distM + last.speedMps * ((t - last.t) / 1000);
  }
  for (let i = 1; i < live.length; i += 1) {
    if (live[i].t >= t) {
      const s0 = live[i - 1];
      const s1 = live[i];
      const span = s1.t - s0.t;
      const u = span > 0 ? (t - s0.t) / span : 0;
      return s0.distM + (s1.distM - s0.distM) * u;
    }
  }
  return last.distM;
}

function lastPacketAt(published, tMs, delayMs) {
  let last = null;
  for (const p of published) {
    if (p.paused) continue;
    if (p.t + delayMs > tMs) break;
    last = p;
  }
  return last;
}

function predictPacket(pkt, tMs) {
  return pkt.distM + pkt.speedMps * ((tMs - pkt.t) / 1000);
}

function adaptivePublish(truth, eM) {
  const live = truth.filter((s) => !s.paused);
  if (!live.length) return [];
  const out = [live[0]];
  let last = live[0];
  for (const s of live) {
    const pred = last.distM + last.speedMps * ((s.t - last.t) / 1000);
    if (Math.abs(pred - s.distM) > eM) {
      out.push(s);
      last = s;
    }
  }
  return out;
}

function fixedPublish(truth, intervalMs = PUBLISH_INTERVAL_MS) {
  const live = truth.filter((s) => !s.paused);
  if (!live.length) return [];
  const out = [live[0]];
  for (const s of live) {
    if (s.t - out[out.length - 1].t >= intervalMs) out.push(s);
  }
  return out;
}

function runUntil(stepRideSpeedKmh, startKmh, targetKmh, extraHoldMs = 0) {
  let kmh = startKmh;
  let ms = 0;
  const cap = 30_000;
  while (kmh !== targetKmh && ms < cap) {
    kmh = stepRideSpeedKmh(kmh, targetKmh, GEN_DT_MS);
    ms += GEN_DT_MS;
  }
  return { durationMs: ms, segs: [{ durationMs: ms + extraHoldMs, targetKmh }] };
}

function generate(stepRideSpeedKmh, id, startKmh, segments) {
  let t = 0;
  let kmh = startKmh;
  let dist = 20;
  const samples = [];
  for (const seg of segments) {
    let elapsed = 0;
    while (elapsed < seg.durationMs) {
      const prev = kmh;
      kmh = stepRideSpeedKmh(kmh, seg.targetKmh, GEN_DT_MS);
      const speedMps = kmh / 3.6;
      dist += speedMps * (GEN_DT_MS / 1000);
      const paused = seg.paused === true;
      samples.push({
        t,
        distM: dist,
        speedMps: paused ? 0 : speedMps,
        kmh: paused ? 0 : kmh,
        paused,
        maneuvering: paused ? false : Math.abs(kmh - prev) > 1e-9 || kmh !== seg.targetKmh,
      });
      t += GEN_DT_MS;
      elapsed += GEN_DT_MS;
    }
  }
  return { id, startKmh, samples };
}

function selfMAt(samples, tMs) {
  const t0 = samples[0].t;
  const self0 = samples[0].distM - INIT_GAP_M;
  return self0 + (SELF_KMH / 3.6) * ((tMs - t0) / 1000);
}

function jumpStats(excessAbs, pxPerM) {
  const sorted = [...excessAbs].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p90 = percentile(sorted, 90);
  const p99 = percentile(sorted, 99);
  const max = sorted.length ? sorted[sorted.length - 1] : null;
  return {
    n: sorted.length,
    p50m: p50,
    p90m: p90,
    p99m: p99,
    maxM: max,
    p50px: toPx(p50, pxPerM),
    p90px: toPx(p90, pxPerM),
    p99px: toPx(p99, pxPerM),
    maxPx: toPx(max, pxPerM),
  };
}

function simulateDisplay(published, t0, tEnd, { tauAbs, tauLeadSec, delayMs, accelMps2, decelMps2 }) {
  const frames = [];
  let lastPkt = null;
  let displayDist = null;
  let displayVel = 0;
  let offset = 0;
  let catchVel = 0;
  const dtMs = FRAME_DT * 1000;
  const tauLeadMs = (tauLeadSec ?? 0) * 1000;
  const targetOf = (pkt, tMs) => predictPacket(pkt, tMs + tauLeadMs);

  for (let t = t0; t <= tEnd + 1e-9; t += dtMs) {
    const pkt = lastPacketAt(published, t, delayMs);
    if (!pkt) continue;
    const pred = targetOf(pkt, t);

    if (displayDist == null) {
      lastPkt = pkt;
      offset = 0;
      catchVel = 0;
      displayDist = pred;
      displayVel = pkt.speedMps;
      frames.push({ t, displayDist, displayVel, excessM: 0, paused: pkt.paused === true, init: true });
      continue;
    }

    if (lastPkt !== pkt) {
      offset += targetOf(pkt, t) - targetOf(lastPkt, t);
      lastPkt = pkt;
    }

    let newDist;
    let newVel;
    if (tauAbs == null) {
      offset = 0;
      catchVel = 0;
      newDist = pred;
      newVel = pkt.speedMps;
    } else {
      const desiredCatch = offset / tauAbs;
      const dv = desiredCatch - catchVel;
      const maxUp = accelMps2 * FRAME_DT;
      const maxDown = decelMps2 * FRAME_DT;
      const applied = dv >= 0 ? Math.min(dv, maxUp) : -Math.min(-dv, maxDown);
      catchVel += applied;
      offset -= catchVel * FRAME_DT;
      newDist = pred - offset;
      newVel = (newDist - displayDist) / FRAME_DT;
    }

    const actualDelta = newDist - displayDist;
    const cvPortion = displayVel * FRAME_DT;
    const excessM = Math.abs(actualDelta - cvPortion);
    displayDist = newDist;
    displayVel = newVel;
    frames.push({
      t,
      displayDist,
      displayVel,
      excessM,
      paused: pkt.paused === true,
      init: false,
    });
  }

  return { frames };
}

function reverseSize(truth, frames, pxPerM) {
  let runM = 0;
  let maxM = 0;
  let maxFrameM = 0;
  let wrongPeakM = 0;
  let prev = null;
  for (const f of frames) {
    if (f.paused || f.init) {
      runM = 0;
      prev = null;
      continue;
    }
    const truthPeer = interpAt(truth, f.t);
    if (truthPeer == null) {
      prev = f;
      continue;
    }
    const selfM = selfMAt(truth, f.t);
    const actualGap = truthPeer - selfM;
    const shownGap = f.displayDist - selfM;
    if (
      Math.abs(actualGap) <= CHIEF_GAP_M &&
      Math.sign(actualGap) !== 0 &&
      Math.sign(shownGap) !== Math.sign(actualGap)
    ) {
      const w = Math.abs(shownGap);
      if (w > wrongPeakM) wrongPeakM = w;
    }
    if (prev) {
      const d = f.displayDist - prev.displayDist;
      if (d < -1e-12) {
        const back = -d;
        runM += back;
        if (runM > maxM) maxM = runM;
        if (back > maxFrameM) maxFrameM = back;
      } else {
        runM = 0;
      }
    }
    prev = f;
  }
  return {
    maxRetrogradeM: maxM,
    maxRetrogradePx: toPx(maxM, pxPerM),
    maxFrameRetrogradeM: maxFrameM,
    maxFrameRetrogradePx: toPx(maxFrameM, pxPerM),
    wrongSidePeakM: wrongPeakM,
    wrongSidePeakPx: toPx(wrongPeakM, pxPerM),
  };
}

function cruiseBiasM(truth, frames, cruiseKmh) {
  const xs = [];
  for (const f of frames) {
    if (f.paused || f.init) continue;
    const s = truth.find((q) => q.t >= f.t) ?? truth.at(-1);
    if (!s || Math.abs(s.kmh - cruiseKmh) > 0.05) continue;
    const truthPeer = interpAt(truth, f.t);
    if (truthPeer == null) continue;
    xs.push(f.displayDist - truthPeer);
  }
  return mean(xs);
}

function evaluateFrames(truth, displayFrames, pxPerM) {
  const signed = [];
  const gapBias = [];
  const excess = [];
  let abreast = 0;
  let reverse = 0;
  for (const f of displayFrames) {
    if (f.paused || f.init) continue;
    const truthPeer = interpAt(truth, f.t);
    if (truthPeer == null) continue;
    const err = f.displayDist - truthPeer;
    signed.push(err);
    excess.push(f.excessM);
    const selfM = selfMAt(truth, f.t);
    const actualGap = truthPeer - selfM;
    const shownGap = f.displayDist - selfM;
    gapBias.push(shownGap - actualGap);
    if (Math.abs(actualGap) <= CHIEF_GAP_M) {
      abreast += 1;
      if (Math.sign(actualGap) !== 0 && Math.sign(shownGap) !== Math.sign(actualGap)) reverse += 1;
    }
  }
  const abs = signed.map((x) => Math.abs(x)).sort((a, b) => a - b);
  const retro = reverseSize(truth, displayFrames, pxPerM);
  return {
    n: signed.length,
    maxM: abs.length ? abs[abs.length - 1] : null,
    rankBiasM: mean(gapBias),
    reverseRatio: abreast > 0 ? reverse / abreast : null,
    jump: jumpStats(excess, pxPerM),
    ...retro,
  };
}

function makeProfiles(stepRideSpeedKmh) {
  const p1Stop = runUntil(stepRideSpeedKmh, 20, 0, 2000);
  const p2Go = runUntil(stepRideSpeedKmh, 0, 20, 2000);
  const p3Stop = runUntil(stepRideSpeedKmh, 5, 0, 1000);
  const p3Go = runUntil(stepRideSpeedKmh, 0, 5, 2000);
  const p4Up = runUntil(stepRideSpeedKmh, 5, 12, 400);
  const p4Down = runUntil(stepRideSpeedKmh, 12, 5, 400);
  const specs = [
    {
      id: "P1-brake-20-0",
      label: "최대 제동 20→0",
      startKmh: 20,
      segments: [{ durationMs: 2000, targetKmh: 20 }, ...p1Stop.segs],
    },
    {
      id: "P2-accel-0-20",
      label: "최대 가속 0→20",
      startKmh: 0,
      segments: [{ durationMs: 1000, targetKmh: 0 }, ...p2Go.segs],
    },
    {
      id: "P3-chief-5-0-5",
      label: "Chief 저속 5→0→5",
      startKmh: 5,
      segments: [
        { durationMs: 3000, targetKmh: 5 },
        ...p3Stop.segs,
        ...p3Go.segs,
        { durationMs: 2000, targetKmh: 5 },
      ],
    },
    {
      id: "P4-5-12-x3",
      label: "5↔12 왕복 3회",
      startKmh: 5,
      segments: [
        { durationMs: 1500, targetKmh: 5 },
        ...p4Up.segs,
        ...p4Down.segs,
        ...p4Up.segs,
        ...p4Down.segs,
        ...p4Up.segs,
        ...p4Down.segs,
        { durationMs: 1500, targetKmh: 5 },
      ],
    },
  ];
  return specs.map((sp) => {
    const g = generate(stepRideSpeedKmh, sp.id, sp.startKmh, sp.segments);
    return { ...g, label: sp.label };
  });
}

async function loadModules() {
  const vite = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    const ramp = await vite.ssrLoadModule("./src/lib/rideSpeedRamp.ts");
    const integrator = await vite.ssrLoadModule("./src/lib/peerMotion/integrator.ts");
    const policy = await vite.ssrLoadModule("./src/lib/rideSyncPolicy.ts");
    return { ramp, integrator, policy };
  } finally {
    await vite.close();
  }
}

function simulateBaseDisplay(integrator, published, t0, tEnd, delayMs) {
  const { createPeerMotionEntity, applyPeerMotionIngest, stepPeerMotionEntity } = integrator;
  const dtMs = FRAME_DT * 1000;
  const frames = [];
  const realNow = Date.now;
  let clockMs = t0 + CLOCK_SHIFT_MS;
  Date.now = () => clockMs;
  let entity = null;
  let pi = 0;
  try {
    for (let t = t0; t <= tEnd + 1e-9; t += dtMs) {
      const nowMs = t + delayMs + CLOCK_SHIFT_MS;
      clockMs = nowMs;
      while (pi < published.length && published[pi].t <= t) {
        const s = published[pi];
        const packet = {
          uid: "base-peer",
          publicationId: "s412-base",
          distM: s.distM,
          speedMps: s.speedMps,
          phase: s.paused ? "paused" : "live",
          serverAtMs: s.t + CLOCK_SHIFT_MS,
          seq: pi,
        };
        if (!entity) entity = createPeerMotionEntity(packet, "base");
        else applyPeerMotionIngest(entity, packet, "base");
        pi += 1;
      }
      if (!entity) continue;
      const prev = entity.displayDistM;
      stepPeerMotionEntity(entity, FRAME_DT, ROUTE_LEN_M, nowMs);
      const newDist = entity.displayDistM;
      const excessM =
        frames.length === 0 ? 0 : Math.abs(newDist - prev - (frames.at(-1).displayVel ?? 0) * FRAME_DT);
      const displayVel = frames.length === 0 ? (published[0]?.speedMps ?? 0) : (newDist - prev) / FRAME_DT;
      frames.push({
        t,
        displayDist: newDist,
        displayVel,
        excessM,
        paused: entity.phase === "paused",
        init: frames.length === 0,
      });
    }
  } finally {
    Date.now = realNow;
  }
  return { frames };
}

function newGates(row, base) {
  const g1 =
    row.rankBiasM == null || base.rankBiasM == null
      ? null
      : Math.abs(row.rankBiasM) <= Math.abs(base.rankBiasM) + 1e-12;
  const g2 =
    row.maxRetrogradeM == null || base.maxRetrogradeM == null
      ? null
      : row.maxRetrogradeM <= base.maxRetrogradeM + 1e-12;
  const g3 = row.maxM == null ? null : row.maxM <= GATE3_MAX_ERR_M;
  const g4 = row.jumpP99px == null ? null : row.jumpP99px <= GATE4_JUMP_P99_PX;
  return {
    g1_bias: g1,
    g2_retrograde: g2,
    g3_maxErr: g3,
    g4_jumpP99: g4,
    pass: g1 === true && g2 === true && g3 === true && g4 === true,
  };
}

function makeProfilesAndRamp(stepRideSpeedKmh) {
  return makeProfiles(stepRideSpeedKmh);
}

async function main() {
  mkdirSync(RELAY, { recursive: true });
  const pxPerM = loadPxPerM();
  const s411 = JSON.parse(readFileSync(resolve(RELAY, "S411-combos.json"), "utf8"));
  if (!Array.isArray(s411.combos) || s411.combos.length !== 120) {
    console.error(`S411-combos.json 조합 수 ${s411.combos?.length} ≠ 120`);
    process.exit(1);
  }

  const { ramp, integrator, policy } = await loadModules();
  if (policy.PEER_MOTION_PUBLISH_INTERVAL_MS !== PUBLISH_INTERVAL_MS) {
    console.error("제품 발행 간격이 100ms 가 아니다.");
    process.exit(1);
  }
  if (policy.PEER_INTERP_DELAY_MS !== INTERP_DELAY_MS) {
    console.error("제품 보간 지연이 160ms 가 아니다.");
    process.exit(1);
  }

  const { stepRideSpeedKmh, RIDE_SPEED_ACCEL_KMH_PER_SEC, RIDE_SPEED_DECEL_KMH_PER_SEC } = ramp;
  const accelMps2 = RIDE_SPEED_ACCEL_KMH_PER_SEC / 3.6;
  const decelMps2 = RIDE_SPEED_DECEL_KMH_PER_SEC / 3.6;
  const profiles = makeProfilesAndRamp(stepRideSpeedKmh);
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const anchorStored = s411.combos.find(
    (c) => c.eM === 0.3 && c.tauAbs === 0.3 && c.tauLeadRatio === 0 && c.delayMs === 0,
  );
  const a0 = [];
  for (const row of anchorStored.perProfile) {
    const p = byId[row.id];
    const pub = adaptivePublish(p.samples, 0.3);
    const sim = simulateDisplay(pub, p.samples[0].t, p.samples.at(-1).t, {
      tauAbs: 0.3,
      tauLeadSec: 0,
      delayMs: 0,
      accelMps2,
      decelMps2,
    });
    const ev = evaluateFrames(p.samples, sim.frames, pxPerM);
    a0.push({
      id: row.id,
      stored: {
        rankBiasM: row.rankBiasM,
        jumpP99px: row.jumpP99px,
        reverseRatio: row.reverseRatio,
        maxM: row.maxM,
      },
      replayed: {
        rankBiasM: ev.rankBiasM,
        jumpP99px: ev.jump.p99px,
        reverseRatio: ev.reverseRatio,
        maxM: ev.maxM,
        maxRetrogradeM: ev.maxRetrogradeM,
        maxRetrogradePx: ev.maxRetrogradePx,
      },
      biasOk: Math.abs(ev.rankBiasM - row.rankBiasM) <= A0_BIAS_TOL,
      jumpOk: Math.abs(ev.jump.p99px - row.jumpP99px) <= A0_JUMP_TOL,
      revOk: Math.abs((ev.reverseRatio ?? 0) - (row.reverseRatio ?? 0)) <= A0_REV_TOL,
    });
  }
  const a0ok = a0.every((r) => r.biasOk && r.jumpOk && r.revOk);
  const a0P2 = a0.find((r) => r.id === "P2-accel-0-20");
  const a0P3 = a0.find((r) => r.id === "P3-chief-5-0-5");
  console.log("=== A0 측정 불변 ===");
  console.log(
    `P2 bias ${a0P2.replayed.rankBiasM} vs S4-11 ${a0P2.stored.rankBiasM} ok=${a0P2.biasOk}`,
  );
  console.log(
    `P2 jump p99 ${a0P2.replayed.jumpP99px.toFixed(4)} vs ${a0P2.stored.jumpP99px.toFixed(4)} ok=${a0P2.jumpOk}`,
  );
  console.log(
    `P3 rev ${(a0P3.replayed.reverseRatio * 100).toFixed(2)}% vs ${(a0P3.stored.reverseRatio * 100).toFixed(2)}% ok=${a0P3.revOk}`,
  );
  if (!a0ok) {
    console.error("A0 실패 — 재판정이 아니라 재실험이 됐다. 나머지를 쓰지 않는다.");
    writeFileSync(
      resolve(RELAY, "S412-summary.json"),
      JSON.stringify({ instruction: "S4-12", a0ok: false, a0, verdict: "측정 불변 실패" }, null, 2),
    );
    process.exit(1);
  }

  const base = [];
  for (const p of profiles) {
    const pub = fixedPublish(p.samples, PUBLISH_INTERVAL_MS);
    for (const delayMs of DELAY_MS) {
      const sim = simulateBaseDisplay(integrator, pub, p.samples[0].t, p.samples.at(-1).t, delayMs);
      const ev = evaluateFrames(p.samples, sim.frames, pxPerM);
      const cruiseKmh = p.id.startsWith("P1") ? 20 : p.id.startsWith("P2") ? null : 5;
      base.push({
        id: p.id,
        delayMs,
        publishN: pub.length,
        rankBiasM: ev.rankBiasM,
        cruiseBiasM: cruiseKmh == null ? null : cruiseBiasM(p.samples, sim.frames, cruiseKmh),
        maxM: ev.maxM,
        reverseRatio: ev.reverseRatio,
        maxRetrogradeM: ev.maxRetrogradeM,
        maxRetrogradePx: ev.maxRetrogradePx,
        maxFrameRetrogradeM: ev.maxFrameRetrogradeM,
        maxFrameRetrogradePx: ev.maxFrameRetrogradePx,
        wrongSidePeakM: ev.wrongSidePeakM,
        wrongSidePeakPx: ev.wrongSidePeakPx,
        jumpP99px: ev.jump.p99px,
        jumpMaxPx: ev.jump.maxPx,
      });
    }
  }
  const baseAt = (id, delayMs) => base.find((b) => b.id === id && b.delayMs === delayMs);
  const p3d0 = baseAt("P3-chief-5-0-5", 0);
  const p1d0 = baseAt("P1-brake-20-0", 0);
  const p2d0 = baseAt("P2-accel-0-20", 0);
  const p4d0 = baseAt("P4-5-12-x3", 0);
  const p3cruise = p3d0?.cruiseBiasM;
  const a1p3ok =
    Number.isFinite(p3cruise) &&
    Math.abs(p3cruise) >= A1_P3_BIAS_LO &&
    Math.abs(p3cruise) <= A1_P3_BIAS_HI;
  const a1nonzero = base.every((b) => Number.isFinite(b.rankBiasM) && Math.abs(b.rankBiasM) > 0.01);
  const a1speed =
    Math.abs(p1d0.cruiseBiasM ?? p1d0.rankBiasM) > Math.abs(p3cruise) &&
    Math.abs(p2d0.rankBiasM) > Math.abs(p3d0.rankBiasM);
  const a1ok = a1p3ok && a1nonzero && a1speed;
  console.log("=== A1 BASE 생존 ===");
  console.log(
    `P3 delay0 cruise bias ${p3cruise?.toFixed?.(4)} (기대 ~0.22) mean ${p3d0.rankBiasM?.toFixed?.(4)} ok=${a1p3ok}`,
  );
  console.log(
    `P1 ${p1d0.rankBiasM?.toFixed?.(3)}  P2 ${p2d0.rankBiasM?.toFixed?.(3)}  P4 ${p4d0.rankBiasM?.toFixed?.(3)}  speedOk=${a1speed}`,
  );
  writeFileSync(
    resolve(RELAY, "S412-base.json"),
    JSON.stringify(
      {
        instruction: "S4-12",
        retroDef: RETRO_DEF,
        publishIntervalMs: PUBLISH_INTERVAL_MS,
        interpDelayMs: INTERP_DELAY_MS,
        pxPerM,
        a1ok,
        rows: base,
      },
      null,
      2,
    ),
  );
  if (!a1ok) {
    console.error("A1 실패 — 기준선이 죽어 A4~A7 을 쓰지 않는다.");
    writeFileSync(
      resolve(RELAY, "S412-summary.json"),
      JSON.stringify({ instruction: "S4-12", a0ok: true, a1ok: false, base, verdict: "BASE 생존 실패" }, null, 2),
    );
    process.exit(1);
  }

  const comboOut = [];
  for (const stored of s411.combos) {
    const perProfile = [];
    for (const row of stored.perProfile) {
      const p = byId[row.id];
      const pub = adaptivePublish(p.samples, stored.eM);
      const sim = simulateDisplay(pub, p.samples[0].t, p.samples.at(-1).t, {
        tauAbs: stored.tauAbs,
        tauLeadSec: stored.tauLeadSec,
        delayMs: stored.delayMs,
        accelMps2,
        decelMps2,
      });
      const ev = evaluateFrames(p.samples, sim.frames, pxPerM);
      const measureOk =
        Math.abs(ev.rankBiasM - row.rankBiasM) <= A0_BIAS_TOL &&
        Math.abs(ev.jump.p99px - row.jumpP99px) <= A0_JUMP_TOL &&
        Math.abs((ev.reverseRatio ?? 0) - (row.reverseRatio ?? 0)) <= A0_REV_TOL;
      if (!measureOk) {
        console.error(`측정값 불일치 ${row.id} E=${stored.eM} τ=${stored.tauAbs} L=${stored.tauLeadRatio} d=${stored.delayMs}`);
        process.exit(1);
      }
      const b = baseAt(row.id, stored.delayMs);
      const judged = {
        id: row.id,
        rankBiasM: row.rankBiasM,
        maxM: row.maxM,
        jumpP99px: row.jumpP99px,
        jumpMaxPx: row.jumpMaxPx,
        reverseRatio: row.reverseRatio,
        maxRetrogradeM: ev.maxRetrogradeM,
        maxRetrogradePx: ev.maxRetrogradePx,
        wrongSidePeakM: ev.wrongSidePeakM,
        wrongSidePeakPx: ev.wrongSidePeakPx,
        baseRankBiasM: b.rankBiasM,
        baseMaxRetrogradeM: b.maxRetrogradeM,
        baseMaxRetrogradePx: b.maxRetrogradePx,
        gates: newGates(
          {
            rankBiasM: row.rankBiasM,
            maxM: row.maxM,
            jumpP99px: row.jumpP99px,
            maxRetrogradeM: ev.maxRetrogradeM,
          },
          b,
        ),
      };
      perProfile.push(judged);
    }
    const passAll = perProfile.every((r) => r.gates.pass === true);
    comboOut.push({
      eM: stored.eM,
      tauAbs: stored.tauAbs,
      tauLeadRatio: stored.tauLeadRatio,
      tauLeadSec: stored.tauLeadSec,
      delayMs: stored.delayMs,
      publishSum: stored.publishSum,
      passAll,
      perProfile,
      failGates: ["g1_bias", "g2_retrograde", "g3_maxErr", "g4_jumpP99"].filter((g) =>
        perProfile.some((r) => r.gates[g] === false),
      ),
    });
  }

  const passAll = comboOut.filter((c) => c.passAll);
  const passLead0 = passAll.filter((c) => c.tauLeadRatio === 0);
  passLead0.sort((a, b) => a.publishSum - b.publishSum || a.delayMs - b.delayMs || a.tauAbs - b.tauAbs);
  const rec = passLead0[0] ?? null;
  const recP3 = rec?.perProfile.find((p) => p.id === "P3-chief-5-0-5");

  const delayHold = {};
  if (rec) {
    for (const d of DELAY_MS) {
      const hit = comboOut.find(
        (c) =>
          c.eM === rec.eM &&
          c.tauAbs === rec.tauAbs &&
          c.tauLeadRatio === 0 &&
          c.delayMs === d,
      );
      delayHold[d] = hit
        ? { passAll: hit.passAll, failGates: hit.failGates }
        : { passAll: false, failGates: ["missing"] };
    }
  }

  const failCounts = { g1_bias: 0, g2_retrograde: 0, g3_maxErr: 0, g4_jumpP99: 0 };
  for (const c of comboOut) {
    for (const g of c.failGates) failCounts[g] += 1;
  }

  const summary = {
    instruction: "S4-12",
    retroDef: RETRO_DEF,
    pxPerM,
    a0ok: true,
    a1ok: true,
    nCombos: comboOut.length,
    passN: passAll.length,
    passLead0N: passLead0.length,
    pass: passAll.map((c) => ({
      eM: c.eM,
      tauAbs: c.tauAbs,
      tauLeadRatio: c.tauLeadRatio,
      delayMs: c.delayMs,
      publishSum: c.publishSum,
    })),
    passLead0: passLead0.map((c) => ({
      eM: c.eM,
      tauAbs: c.tauAbs,
      delayMs: c.delayMs,
      publishSum: c.publishSum,
    })),
    recommended: rec
      ? {
          eM: rec.eM,
          tauAbs: rec.tauAbs,
          delayMs: rec.delayMs,
          publishSum: rec.publishSum,
          p3: {
            rankBiasM: recP3.rankBiasM,
            jumpP99px: recP3.jumpP99px,
            maxM: recP3.maxM,
            maxRetrogradeM: recP3.maxRetrogradeM,
            maxRetrogradePx: recP3.maxRetrogradePx,
            reverseRatio: recP3.reverseRatio,
          },
        }
      : null,
    delayHold,
    failCounts,
    verdict: rec
      ? `(E, τ_abs) = (${rec.eM}, ${rec.tauAbs}) · delay ${rec.delayMs}ms · 발행합 ${rec.publishSum}`
      : "불가",
  };

  writeFileSync(
    resolve(RELAY, "S412-combos.json"),
    JSON.stringify({ instruction: "S4-12", retroDef: RETRO_DEF, pxPerM, nCombos: comboOut.length, combos: comboOut }, null, 2),
  );
  writeFileSync(resolve(RELAY, "S412-summary.json"), JSON.stringify(summary, null, 2));

  console.log(`\n=== A4 재판정 ${comboOut.length}/120 ===`);
  console.log(`A5 통과 ${passAll.length}  그중 lead=0 ${passLead0.length}`);
  console.log(`A6 ${summary.verdict}`);
  console.log("A7 지연", JSON.stringify(delayHold));
  console.log("탈락 게이트 수", JSON.stringify(failCounts));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

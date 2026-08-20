/**
 * S4-11 — S4-10 추종기는 그대로 두고 τ_abs 세분 + 선보상(목표=예측(now+τ_lead))만 추가한다.
 * 제품 · s410-absorb-eval.mjs · S410-* 는 고치지 않는다.
 *
 * accelOk = 흡수기가 만드는 |a| 가 제품 램프 이하. 원본 속도열 가속도와 분리한다.
 *
 *   cd apps/web && node scripts/peer-sync/s411-lead-eval.mjs
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
const DELAY_FLOOR_MS = 160;
const CURRENT_BIAS_M = 0.22;
const BIAS_RELAX = [0.22, 0.25, 0.3];
const CHIEF_GAP_M = 5;
const GATE3_MAX_ERR_M = 1.5;
const GATE4_JUMP_P99_PX = 2;
const INIT_GAP_M = 3.2;
const SELF_KMH = 5;
const E_M = [0.3, 0.5];
const TAU_ABS = [0.1, 0.15, 0.2, 0.25, 0.3];
const TAU_LEAD_RATIO = [0, 0.5, 1.0, 1.5];
const DELAY_MS = [0, 100, 300];
const Y0_E = 0.5;
const Y0_MIN_FRAC = 0.8;
const Y0_MAX_FRAC = 1.2;
const JUMP_GROW_PX = 0.05;
const S410_P2_BIAS = -0.24446303753324364;
const S410_JUMP_MAX_PX = 1.5108964629809274;
const S410_BIAS_TOL = 0.002;
const S410_JUMP_TOL_PX = 0.05;

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
      const maneuvering = paused ? false : Math.abs(kmh - prev) > 1e-9 || kmh !== seg.targetKmh;
      samples.push({
        t,
        distM: dist,
        speedMps: paused ? 0 : speedMps,
        kmh: paused ? 0 : kmh,
        paused,
        maneuvering,
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

function sourceAccel(samples) {
  let maxAccel = 0;
  let maxDecel = 0;
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].paused || samples[i - 1].paused) continue;
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (dt < 0.0005) continue;
    const a = (samples[i].speedMps - samples[i - 1].speedMps) / dt;
    if (a > maxAccel) maxAccel = a;
    if (-a > maxDecel) maxDecel = -a;
  }
  return { maxAccelMps2: maxAccel, maxDecelMps2: maxDecel };
}

/**
 * τ_lead=0 이면 S4-10 과 동일. 선보상은 목표만 예측(now+τ_lead)로 옮긴다.
 * 흡수기 가속도는 catchVel 변화만 잰다. 스냅(흡수 off) 속도 점프는 넣지 않는다.
 */
function simulateDisplay(published, t0, tEnd, { tauAbs, tauLeadSec, delayMs, accelMps2, decelMps2 }) {
  const frames = [];
  let lastPkt = null;
  let displayDist = null;
  let displayVel = 0;
  let offset = 0;
  let catchVel = 0;
  let absorbMaxAccel = 0;
  let absorbMaxDecel = 0;
  let displaySnapAccel = 0;
  let displaySnapDecel = 0;
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
      frames.push({
        t,
        displayDist,
        displayVel,
        targetDist: pred,
        excessM: 0,
        paused: pkt.paused === true,
        init: true,
      });
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
      const a = (newVel - displayVel) / FRAME_DT;
      if (Number.isFinite(a)) {
        if (a > displaySnapAccel) displaySnapAccel = a;
        if (-a > displaySnapDecel) displaySnapDecel = -a;
      }
    } else {
      const desiredCatch = offset / tauAbs;
      const dv = desiredCatch - catchVel;
      const maxUp = accelMps2 * FRAME_DT;
      const maxDown = decelMps2 * FRAME_DT;
      const applied = dv >= 0 ? Math.min(dv, maxUp) : -Math.min(-dv, maxDown);
      const a = applied / FRAME_DT;
      if (a > absorbMaxAccel) absorbMaxAccel = a;
      if (-a > absorbMaxDecel) absorbMaxDecel = -a;
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
      targetDist: pred,
      excessM,
      paused: pkt.paused === true,
      init: false,
    });
  }

  return {
    frames,
    absorbMaxAccel,
    absorbMaxDecel,
    displaySnapAccel,
    displaySnapDecel,
  };
}

function evaluateFrames(truth, displayFrames, pxPerM) {
  const signed = [];
  const gapBias = [];
  const excess = [];
  let abreast = 0;
  let reverse = 0;
  let worst = null;
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
    const abs = Math.abs(err);
    if (worst == null || abs > worst.absM) {
      worst = { tMs: f.t, errM: err, absM: abs, jumpM: f.excessM };
    }
  }
  const abs = signed.map((x) => Math.abs(x)).sort((a, b) => a - b);
  const p50 = percentile(abs, 50);
  const p90 = percentile(abs, 90);
  const max = abs.length ? abs[abs.length - 1] : null;
  return {
    n: signed.length,
    p50m: p50,
    p90m: p90,
    maxM: max,
    p50px: toPx(p50, pxPerM),
    p90px: toPx(p90, pxPerM),
    maxPx: toPx(max, pxPerM),
    rankBiasM: mean(gapBias),
    reverseRatio: abreast > 0 ? reverse / abreast : null,
    abreastFrames: abreast,
    reverseFrames: reverse,
    jump: jumpStats(excess, pxPerM),
    worst,
  };
}

function currentReverse(truth) {
  const t0 = truth[0].t;
  const tEnd = truth[truth.length - 1].t;
  const dtMs = FRAME_DT * 1000;
  let abreast = 0;
  let reverse = 0;
  const gapBias = [];
  for (let t = t0; t <= tEnd + 1e-9; t += dtMs) {
    const truthPeer = interpAt(truth, t);
    const shown = interpAt(truth, t - DELAY_FLOOR_MS);
    if (truthPeer == null || shown == null) continue;
    const selfM = selfMAt(truth, t);
    const actualGap = truthPeer - selfM;
    const shownGap = shown - selfM;
    gapBias.push(shownGap - actualGap);
    if (Math.abs(actualGap) <= CHIEF_GAP_M) {
      abreast += 1;
      if (Math.sign(actualGap) !== 0 && Math.sign(shownGap) !== Math.sign(actualGap)) reverse += 1;
    }
  }
  return {
    reverseRatio: abreast > 0 ? reverse / abreast : null,
    rankBiasM: mean(gapBias),
  };
}

function gates(ev, currentRev, biasLimit = CURRENT_BIAS_M) {
  const g1 = ev.rankBiasM == null ? null : Math.abs(ev.rankBiasM) <= biasLimit;
  const g2 =
    ev.reverseRatio == null || currentRev.reverseRatio == null
      ? null
      : ev.reverseRatio <= currentRev.reverseRatio + 1e-12;
  const g3 = ev.maxM == null ? null : ev.maxM <= GATE3_MAX_ERR_M;
  const g4 = ev.jump.p99px == null ? null : ev.jump.p99px <= GATE4_JUMP_P99_PX;
  return {
    g1_bias: g1,
    g2_reverse: g2,
    g3_maxErr: g3,
    g4_jumpP99: g4,
    pass: g1 === true && g2 === true && g3 === true && g4 === true,
  };
}

async function loadRamp() {
  const vite = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    return await vite.ssrLoadModule("./src/lib/rideSpeedRamp.ts");
  } finally {
    await vite.close();
  }
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
    return { ...g, label: sp.label, sourceAccel: sourceAccel(g.samples) };
  });
}

async function main() {
  mkdirSync(RELAY, { recursive: true });
  const pxPerM = loadPxPerM();
  const expectedY0Px = Y0_E * pxPerM;
  const ramp = await loadRamp();
  const { stepRideSpeedKmh, RIDE_SPEED_ACCEL_KMH_PER_SEC, RIDE_SPEED_DECEL_KMH_PER_SEC } = ramp;
  const accelMps2 = RIDE_SPEED_ACCEL_KMH_PER_SEC / 3.6;
  const decelMps2 = RIDE_SPEED_DECEL_KMH_PER_SEC / 3.6;
  const accelOkDef =
    "accelOk = 흡수기(catchVel)가 만드는 |a| ≤ 제품 램프 0.741/1.852. 원본 속도열 가속도와 흡수 off 스냅 가속도는 포함하지 않는다.";

  const profiles = makeProfiles(stepRideSpeedKmh);
  const jumpDef =
    "60 fps(16.7 ms) 프레임 간 표시 변위에서 직전 표시속도×dt(등속 진행분)를 뺀 절대값. 등속으로 나아가는 몫은 튐이 아니다.";

  const y0 = [];
  for (const p of profiles) {
    const pub = adaptivePublish(p.samples, Y0_E);
    const sim = simulateDisplay(pub, p.samples[0].t, p.samples.at(-1).t, {
      tauAbs: null,
      tauLeadSec: 0,
      delayMs: 0,
      accelMps2,
      decelMps2,
    });
    const ev = evaluateFrames(p.samples, sim.frames, pxPerM);
    y0.push({
      id: p.id,
      publishN: pub.length,
      jump: ev.jump,
      maxErrM: ev.maxM,
      rankBiasM: ev.rankBiasM,
      reverseRatio: ev.reverseRatio,
      absorbMaxAccel: sim.absorbMaxAccel,
      absorbMaxDecel: sim.absorbMaxDecel,
      displaySnapAccel: sim.displaySnapAccel,
      displaySnapDecel: sim.displaySnapDecel,
      sourceAccel: p.sourceAccel,
    });
  }
  const y0MaxPx = Math.max(...y0.map((r) => r.jump.maxPx ?? 0));
  const y0ok = y0MaxPx >= expectedY0Px * Y0_MIN_FRAC && y0MaxPx <= expectedY0Px * Y0_MAX_FRAC;
  console.log("=== Z0-1 흡수 off · E=0.5 점프 ===");
  console.log(`기대 ${expectedY0Px.toFixed(1)} px · 관측 max ${y0MaxPx.toFixed(1)} px · ok=${y0ok}`);

  const combos = [];
  const publishByKey = new Map();
  for (const p of profiles) {
    const cur = currentReverse(p.samples);
    for (const eM of E_M) {
      const pub = adaptivePublish(p.samples, eM);
      publishByKey.set(`${p.id}|${eM}`, pub.length);
      for (const tauAbs of TAU_ABS) {
        for (const leadRatio of TAU_LEAD_RATIO) {
          const tauLeadSec = leadRatio * tauAbs;
          for (const delayMs of DELAY_MS) {
            const sim = simulateDisplay(pub, p.samples[0].t, p.samples.at(-1).t, {
              tauAbs,
              tauLeadSec,
              delayMs,
              accelMps2,
              decelMps2,
            });
            const ev = evaluateFrames(p.samples, sim.frames, pxPerM);
            const accelOk =
              sim.absorbMaxAccel <= accelMps2 + 1e-6 && sim.absorbMaxDecel <= decelMps2 + 1e-6;
            combos.push({
              profileId: p.id,
              eM,
              tauAbs,
              tauLeadRatio: leadRatio,
              tauLeadSec,
              delayMs,
              publishN: pub.length,
              sourceAccel: p.sourceAccel,
              absorbMaxAccel: sim.absorbMaxAccel,
              absorbMaxDecel: sim.absorbMaxDecel,
              accelOk,
              jump: ev.jump,
              maxM: ev.maxM,
              rankBiasM: ev.rankBiasM,
              reverseRatio: ev.reverseRatio,
              currentReverseRatio: cur.reverseRatio,
              gates: gates(ev, cur, CURRENT_BIAS_M),
              gatesByBias: Object.fromEntries(
                BIAS_RELAX.map((lim) => [String(lim), gates(ev, cur, lim)]),
              ),
            });
          }
        }
      }
    }
  }

  const y6ok = combos.every((c) => c.publishN === publishByKey.get(`${c.profileId}|${c.eM}`));
  if (!y6ok) {
    console.error("발행 횟수가 흡수·선보상에 새어 들어갔다.");
    process.exit(1);
  }

  const anchorRows = combos.filter(
    (c) => c.eM === 0.3 && c.tauAbs === 0.3 && c.tauLeadRatio === 0 && c.delayMs === 0,
  );
  const anchorP2 = anchorRows.find((r) => r.profileId === "P2-accel-0-20");
  const anchorJumpMax = Math.max(...anchorRows.map((r) => r.jump.maxPx ?? 0));
  const z02biasOk = Math.abs((anchorP2?.rankBiasM ?? 0) - S410_P2_BIAS) <= S410_BIAS_TOL;
  const z02jumpOk = Math.abs(anchorJumpMax - S410_JUMP_MAX_PX) <= S410_JUMP_TOL_PX;
  const z0ok = y0ok && z02biasOk && z02jumpOk;
  console.log("=== Z0-2 S4-10 앵커 τ_lead=0 τ_abs=0.3 E=0.3 ===");
  console.log(
    `P2 bias ${anchorP2?.rankBiasM?.toFixed?.(6)} (S4-10 ${S410_P2_BIAS.toFixed(6)}) ok=${z02biasOk}`,
  );
  console.log(
    `jump max ${anchorJumpMax.toFixed(3)} px (S4-10 ${S410_JUMP_MAX_PX.toFixed(3)}) ok=${z02jumpOk}`,
  );

  const z0Out = {
    instruction: "S4-11",
    jumpDef,
    y0: { expectedPx: expectedY0Px, observedMaxPx: y0MaxPx, ok: y0ok, perProfile: y0 },
    s410Anchor: {
      eM: 0.3,
      tauAbs: 0.3,
      tauLead: 0,
      delayMs: 0,
      p2Bias: anchorP2?.rankBiasM,
      expectedP2Bias: S410_P2_BIAS,
      jumpMaxPx: anchorJumpMax,
      expectedJumpMaxPx: S410_JUMP_MAX_PX,
      biasOk: z02biasOk,
      jumpOk: z02jumpOk,
      perProfile: anchorRows.map((r) => ({
        id: r.profileId,
        rankBiasM: r.rankBiasM,
        jumpP99px: r.jump.p99px,
        jumpMaxPx: r.jump.maxPx,
        maxM: r.maxM,
        reverseRatio: r.reverseRatio,
      })),
    },
    ok: z0ok,
  };
  writeFileSync(resolve(RELAY, "S411-z0.json"), JSON.stringify(z0Out, null, 2));
  if (!z0ok) {
    console.error("Z0 실패 — 격자를 바꾸다 지표가 깨졌다. 나머지를 쓰지 않는다.");
    writeFileSync(
      resolve(RELAY, "S411-summary.json"),
      JSON.stringify({ instruction: "S4-11", z0ok: false, verdict: "계측 생존 실패" }, null, 2),
    );
    process.exit(1);
  }

  const comboKeys = [];
  for (const eM of E_M) {
    for (const tauAbs of TAU_ABS) {
      for (const leadRatio of TAU_LEAD_RATIO) {
        for (const delayMs of DELAY_MS) {
          const rows = combos.filter(
            (c) =>
              c.eM === eM &&
              c.tauAbs === tauAbs &&
              c.tauLeadRatio === leadRatio &&
              c.delayMs === delayMs,
          );
          const lead0 = combos.filter(
            (c) => c.eM === eM && c.tauAbs === tauAbs && c.tauLeadRatio === 0 && c.delayMs === delayMs,
          );
          const jumpGrew =
            leadRatio !== 0 &&
            rows.some((r) => {
              const base = lead0.find((b) => b.profileId === r.profileId);
              if (!base) return false;
              return (r.jump.maxPx ?? 0) > (base.jump.maxPx ?? 0) + JUMP_GROW_PX;
            });
          const jumpP99Grew =
            leadRatio !== 0 &&
            rows.some((r) => {
              const base = lead0.find((b) => b.profileId === r.profileId);
              if (!base) return false;
              return (r.jump.p99px ?? 0) > (base.jump.p99px ?? 0) + JUMP_GROW_PX;
            });
          const passAll = rows.every((r) => r.gates.pass === true) && !jumpGrew;
          const accelOk = rows.every((r) => r.accelOk);
          const worstJump = rows.reduce((w, r) => (!w || (r.jump.maxPx ?? 0) > (w.jump.maxPx ?? 0) ? r : w), null);
          const worstErr = rows.reduce((w, r) => (!w || (r.maxM ?? 0) > (w.maxM ?? 0) ? r : w), null);
          const worstBias = rows.reduce(
            (w, r) => (!w || Math.abs(r.rankBiasM ?? 0) > Math.abs(w.rankBiasM ?? 0) ? r : w),
            null,
          );
          comboKeys.push({
            eM,
            tauAbs,
            tauLeadRatio: leadRatio,
            tauLeadSec: leadRatio * tauAbs,
            delayMs,
            passAll,
            accelOk,
            jumpGrew,
            jumpP99Grew,
            publishSum: rows.reduce((s, r) => s + r.publishN, 0),
            publishN: rows.map((r) => ({ id: r.profileId, n: r.publishN })),
            perProfile: rows.map((r) => ({
              id: r.profileId,
              jumpP99px: r.jump.p99px,
              jumpMaxPx: r.jump.maxPx,
              maxM: r.maxM,
              rankBiasM: r.rankBiasM,
              reverseRatio: r.reverseRatio,
              absorbMaxAccel: r.absorbMaxAccel,
              absorbMaxDecel: r.absorbMaxDecel,
              sourceAccel: r.sourceAccel,
              gates: r.gates,
              gatesByBias: r.gatesByBias,
            })),
            worstJumpPx: worstJump?.jump.maxPx,
            worstJumpP99px: Math.max(...rows.map((r) => r.jump.p99px ?? 0)),
            worstJumpProfile: worstJump?.profileId,
            worstErrM: worstErr?.maxM,
            worstErrProfile: worstErr?.profileId,
            worstBiasM: worstBias?.rankBiasM,
            worstBiasProfile: worstBias?.profileId,
            anyG3fail: rows.some((r) => r.gates.g3_maxErr === false),
          });
        }
      }
    }
  }

  const nCombos = comboKeys.length;
  const z1ok = nCombos === 120;

  const pass022 = comboKeys.filter((c) => c.passAll && c.accelOk && !c.jumpGrew);
  pass022.sort((a, b) => a.publishSum - b.publishSum || a.delayMs - b.delayMs || a.tauAbs - b.tauAbs);
  const recommended = pass022[0] ?? null;

  const passByBias = {};
  for (const lim of BIAS_RELAX) {
    const hits = comboKeys.filter((c) => {
      if (c.jumpGrew || !c.accelOk) return false;
      return c.perProfile.every((r) => r.gatesByBias[String(lim)].pass === true);
    });
    hits.sort((a, b) => a.publishSum - b.publishSum || a.delayMs - b.delayMs);
    passByBias[String(lim)] = hits.map((c) => ({
      eM: c.eM,
      tauAbs: c.tauAbs,
      tauLeadRatio: c.tauLeadRatio,
      tauLeadSec: c.tauLeadSec,
      delayMs: c.delayMs,
      publishSum: c.publishSum,
      worstBiasM: c.worstBiasM,
      worstJumpPx: c.worstJumpPx,
      worstErrM: c.worstErrM,
    }));
  }

  const overshoot = [];
  for (const eM of E_M) {
    for (const tauAbs of TAU_ABS) {
      for (const delayMs of DELAY_MS) {
        const byRatio = TAU_LEAD_RATIO.map((ratio) => {
          const c = comboKeys.find(
            (x) => x.eM === eM && x.tauAbs === tauAbs && x.tauLeadRatio === ratio && x.delayMs === delayMs,
          );
          return { ratio, worstBiasM: c?.worstBiasM, perProfile: c?.perProfile.map((p) => ({ id: p.id, rankBiasM: p.rankBiasM })) };
        });
        const firstPos = byRatio.find((r) => (r.worstBiasM ?? 0) > 0);
        const p2Flip = byRatio.find((r) => (r.perProfile?.find((p) => p.id === "P2-accel-0-20")?.rankBiasM ?? 0) > 0);
        if (firstPos || p2Flip) {
          overshoot.push({
            eM,
            tauAbs,
            delayMs,
            worstBiasByRatio: byRatio.map((r) => ({ ratio: r.ratio, worstBiasM: r.worstBiasM })),
            firstPositiveWorst: firstPos?.ratio ?? null,
            p2PositiveAt: p2Flip?.ratio ?? null,
          });
        }
      }
    }
  }

  const jumpGrewCombos = comboKeys.filter((c) => c.jumpGrew);
  const g3fail = comboKeys.filter((c) => c.anyG3fail);

  const summary = {
    instruction: "S4-11",
    pxPerM,
    jumpDef,
    accelOkDef,
    rampMps2: { accel: accelMps2, decel: decelMps2 },
    z0ok: true,
    z1ok,
    nCombos,
    y6ok,
    z0: { y0MaxPx, expectedY0Px, anchorP2Bias: anchorP2?.rankBiasM, anchorJumpMaxPx: anchorJumpMax },
    pass022: pass022.map((c) => ({
      eM: c.eM,
      tauAbs: c.tauAbs,
      tauLeadRatio: c.tauLeadRatio,
      tauLeadSec: c.tauLeadSec,
      delayMs: c.delayMs,
      publishSum: c.publishSum,
      worstBiasM: c.worstBiasM,
      worstJumpPx: c.worstJumpPx,
      worstJumpP99px: c.worstJumpP99px,
      worstErrM: c.worstErrM,
    })),
    recommended: recommended
      ? {
          eM: recommended.eM,
          tauAbs: recommended.tauAbs,
          tauLeadRatio: recommended.tauLeadRatio,
          tauLeadSec: recommended.tauLeadSec,
          delayMs: recommended.delayMs,
          publishSum: recommended.publishSum,
        }
      : null,
    passByBias,
    overshoot,
    jumpGrewN: jumpGrewCombos.length,
    jumpP99GrewN: comboKeys.filter((c) => c.jumpP99Grew).length,
    g3failN: g3fail.length,
    g3failSample: g3fail.slice(0, 12).map((c) => ({
      eM: c.eM,
      tauAbs: c.tauAbs,
      tauLeadRatio: c.tauLeadRatio,
      delayMs: c.delayMs,
      worstErrM: c.worstErrM,
    })),
    verdict: recommended
      ? `(E, τ_abs, τ_lead, 지연) = (${recommended.eM}, ${recommended.tauAbs}, ${recommended.tauLeadSec}, ${recommended.delayMs}ms)`
      : "불가",
  };

  writeFileSync(
    resolve(RELAY, "S411-combos.json"),
    JSON.stringify({ instruction: "S4-11", jumpDef, accelOkDef, pxPerM, nCombos, combos: comboKeys }, null, 2),
  );
  writeFileSync(resolve(RELAY, "S411-summary.json"), JSON.stringify(summary, null, 2));

  console.log(`\n=== Z1 격자 ${nCombos}/120 ok=${z1ok} ===`);
  console.log("=== delay=0 · E=0.3 편향(부호) ===");
  for (const tauAbs of TAU_ABS) {
    const line = TAU_LEAD_RATIO.map((ratio) => {
      const c = comboKeys.find(
        (x) => x.eM === 0.3 && x.tauAbs === tauAbs && x.tauLeadRatio === ratio && x.delayMs === 0,
      );
      return `L${ratio}=${c?.worstBiasM?.toFixed?.(3)}/${c?.perProfile.find((p) => p.id === "P2-accel-0-20")?.rankBiasM?.toFixed?.(3)}`;
    });
    console.log(`τ=${tauAbs}  ${line.join("  ")}  pass=${comboKeys.find((x) => x.eM === 0.3 && x.tauAbs === tauAbs && x.tauLeadRatio === 0 && x.delayMs === 0)?.passAll}`);
  }
  console.log(`\nZ5 pass@0.22 n=${pass022.length}  recommended=${summary.verdict}`);
  console.log(`Z7 jumpGrew n=${jumpGrewCombos.length}`);
  console.log(
    `Z9 0.22=${passByBias["0.22"]?.length ?? 0}  0.25=${passByBias["0.25"]?.length ?? 0}  0.30=${passByBias["0.3"]?.length ?? 0}`,
  );
  for (const tauAbs of [0.1, 0.15, 0.25, 0.3]) {
    const c = comboKeys.find(
      (x) => x.eM === 0.3 && x.tauAbs === tauAbs && x.tauLeadRatio === 0 && x.delayMs === 0,
    );
    console.log(
      `detail E0.3 τ=${tauAbs} L0 d0  ` +
        c.perProfile
          .map(
            (p) =>
              `${p.id} bias=${p.rankBiasM.toFixed(3)} p99=${p.jumpP99px.toFixed(2)} maxE=${p.maxM.toFixed(3)} rev=${((p.reverseRatio ?? 0) * 100).toFixed(1)}% g=${p.gates.g1_bias}/${p.gates.g2_reverse}/${p.gates.g3_maxErr}/${p.gates.g4_jumpP99}`,
          )
          .join(" | "),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

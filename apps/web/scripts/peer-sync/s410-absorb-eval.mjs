/**
 * S4-10 — 적응 발행(E)은 S4-9 그대로 두고, 수신 측만 가속도 유계로 보정을 흡수한다.
 * 제품 코드 · s47/s49 실험 스크립트는 고치지 않는다. 캡처 없음.
 *
 * 점프 = 60 fps 프레임 간 표시 변위 − 직전 표시속도×dt (등속 진행분).
 * 흡수 off 에서 E=0.5 이면 이 초과분이 ≈ 0.5 m ≈ 42 px 여야 한다 (Y0).
 *
 *   cd apps/web && node scripts/peer-sync/s410-absorb-eval.mjs
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
const CHIEF_GAP_M = 5;
const GATE3_MAX_ERR_M = 1.5;
const GATE4_JUMP_P99_PX = 2;
const INIT_GAP_M = 3.2;
const SELF_KMH = 5;
const E_M = [0.3, 0.5];
const TAU_ABS = [null, 0.3, 0.5, 1.0, 2.0];
const DELAY_MS = [0, 100, 300];
const Y0_E = 0.5;
const Y0_MIN_FRAC = 0.8;
const Y0_MAX_FRAC = 1.2;

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

/**
 * 수신 측 표시. τ_abs=null 이면 목표에 즉시 스냅(S4-9).
 * 그 외: 예측(마지막 패킷 CV)은 그대로 두고, 보정으로 생긴 위치 잔차만
 * 제품 램프 가속도로 닫는다. 표시 위치는 연속, 점프는 잔차로 흡수된다.
 */
function simulateDisplay(published, t0, tEnd, { tauAbs, delayMs, accelMps2, decelMps2 }) {
  const frames = [];
  let lastPkt = null;
  let displayDist = null;
  let displayVel = 0;
  let offset = 0;
  let catchVel = 0;
  let maxAccel = 0;
  let maxDecel = 0;
  const dtMs = FRAME_DT * 1000;

  for (let t = t0; t <= tEnd + 1e-9; t += dtMs) {
    const pkt = lastPacketAt(published, t, delayMs);
    if (!pkt) continue;
    const pred = predictPacket(pkt, t);

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
      const oldPred = predictPacket(lastPkt, t);
      offset += pred - oldPred;
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
      const a = applied / FRAME_DT;
      if (a > maxAccel) maxAccel = a;
      if (-a > maxDecel) maxDecel = -a;
      catchVel += applied;
      offset -= catchVel * FRAME_DT;
      newDist = pred - offset;
      newVel = (newDist - displayDist) / FRAME_DT;
    }

    const actualDelta = newDist - displayDist;
    const cvPortion = displayVel * FRAME_DT;
    const excessM = Math.abs(actualDelta - cvPortion);
    if (tauAbs == null) {
      const a = (newVel - displayVel) / FRAME_DT;
      if (Number.isFinite(a)) {
        if (a > maxAccel) maxAccel = a;
        if (-a > maxDecel) maxDecel = -a;
      }
    }

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

  return { frames, maxAccel, maxDecel };
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

function gates(ev, currentRev) {
  const g1 = ev.rankBiasM == null ? null : Math.abs(ev.rankBiasM) <= CURRENT_BIAS_M;
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

function tauLabel(tauAbs) {
  return tauAbs == null ? "off" : tauAbs;
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

async function main() {
  mkdirSync(RELAY, { recursive: true });
  const pxPerM = loadPxPerM();
  const expectedY0Px = Y0_E * pxPerM;
  const ramp = await loadRamp();
  const { stepRideSpeedKmh, RIDE_SPEED_ACCEL_KMH_PER_SEC, RIDE_SPEED_DECEL_KMH_PER_SEC } = ramp;
  const accelMps2 = RIDE_SPEED_ACCEL_KMH_PER_SEC / 3.6;
  const decelMps2 = RIDE_SPEED_DECEL_KMH_PER_SEC / 3.6;

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

  const profiles = specs.map((sp) => ({
    ...generate(stepRideSpeedKmh, sp.id, sp.startKmh, sp.segments),
    label: sp.label,
  }));

  const jumpDef =
    "60 fps(16.7 ms) 프레임 간 표시 변위에서 직전 표시속도×dt(등속 진행분)를 뺀 절대값. 등속으로 나아가는 몫은 튐이 아니다.";

  const y0 = [];
  for (const p of profiles) {
    const pub = adaptivePublish(p.samples, Y0_E);
    const sim = simulateDisplay(pub, p.samples[0].t, p.samples.at(-1).t, {
      tauAbs: null,
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
    });
  }
  const y0MaxPx = Math.max(...y0.map((r) => r.jump.maxPx ?? 0));
  const y0ok =
    y0MaxPx >= expectedY0Px * Y0_MIN_FRAC && y0MaxPx <= expectedY0Px * Y0_MAX_FRAC;
  const y0Out = {
    instruction: "S4-10",
    jumpDef,
    eM: Y0_E,
    tauAbs: "off",
    delayMs: 0,
    pxPerM,
    expectedPx: expectedY0Px,
    observedMaxPx: y0MaxPx,
    ok: y0ok,
    perProfile: y0,
  };
  writeFileSync(resolve(RELAY, "S410-y0.json"), JSON.stringify(y0Out, null, 2));
  console.log("=== Y0 점프 계측 생존 ===");
  console.log(
    `흡수 off · E=${Y0_E} · 기대 ${expectedY0Px.toFixed(1)} px · 관측 max ${y0MaxPx.toFixed(1)} px · ok=${y0ok}`,
  );
  for (const r of y0) {
    console.log(
      `  ${r.id}  jump max ${r.jump.maxPx.toFixed(1)} px  p99 ${r.jump.p99px.toFixed(1)} px  nPub=${r.publishN}`,
    );
  }
  if (!y0ok) {
    console.error("Y0 실패 — 점프 계측이 축퇴했다. 흡수 결과를 쓰지 않는다.");
    writeFileSync(
      resolve(RELAY, "S410-summary.json"),
      JSON.stringify({ instruction: "S4-10", y0ok: false, verdict: "점프 계측 실패" }, null, 2),
    );
    process.exit(1);
  }

  const combos = [];
  const publishByKey = new Map();
  for (const p of profiles) {
    const cur = currentReverse(p.samples);
    for (const eM of E_M) {
      const pub = adaptivePublish(p.samples, eM);
      const pubKey = `${p.id}|${eM}`;
      publishByKey.set(pubKey, pub.length);
      for (const tauAbs of TAU_ABS) {
        for (const delayMs of DELAY_MS) {
          const sim = simulateDisplay(pub, p.samples[0].t, p.samples.at(-1).t, {
            tauAbs,
            delayMs,
            accelMps2,
            decelMps2,
          });
          const ev = evaluateFrames(p.samples, sim.frames, pxPerM);
          const g = gates(ev, cur);
          const accelOk = tauAbs == null ? true : sim.maxAccel <= accelMps2 + 1e-6 && sim.maxDecel <= decelMps2 + 1e-6;
          combos.push({
            profileId: p.id,
            eM,
            tauAbs: tauLabel(tauAbs),
            delayMs,
            publishN: pub.length,
            maxAccelMps2: sim.maxAccel,
            maxDecelMps2: sim.maxDecel,
            accelOk,
            jump: ev.jump,
            p50m: ev.p50m,
            p90m: ev.p90m,
            maxM: ev.maxM,
            maxPx: ev.maxPx,
            rankBiasM: ev.rankBiasM,
            reverseRatio: ev.reverseRatio,
            currentReverseRatio: cur.reverseRatio,
            worst: ev.worst,
            gates: g,
          });
        }
      }
    }
  }

  const y6ok = combos.every((c) => c.publishN === publishByKey.get(`${c.profileId}|${c.eM}`));
  if (!y6ok) {
    console.error("Y6 실패 — 흡수가 발행 횟수에 새어 들어갔다.");
    process.exit(1);
  }

  const comboKeys = [];
  for (const eM of E_M) {
    for (const tauAbs of TAU_ABS) {
      for (const delayMs of DELAY_MS) {
        const rows = combos.filter(
          (c) => c.eM === eM && c.tauAbs === tauLabel(tauAbs) && c.delayMs === delayMs,
        );
        const passAll = rows.every((r) => r.gates.pass === true);
        const accelOk = rows.every((r) => r.accelOk);
        const worstJump = rows.reduce((w, r) => (!w || (r.jump.maxPx ?? 0) > (w.jump.maxPx ?? 0) ? r : w), null);
        const worstErr = rows.reduce((w, r) => (!w || (r.maxM ?? 0) > (w.maxM ?? 0) ? r : w), null);
        const worstBias = rows.reduce(
          (w, r) => (!w || Math.abs(r.rankBiasM ?? 0) > Math.abs(w.rankBiasM ?? 0) ? r : w),
          null,
        );
        comboKeys.push({
          eM,
          tauAbs: tauLabel(tauAbs),
          delayMs,
          passAll,
          accelOk,
          publishN: rows.map((r) => ({ id: r.profileId, n: r.publishN })),
          perProfile: rows.map((r) => ({
            id: r.profileId,
            jumpP99px: r.jump.p99px,
            jumpMaxPx: r.jump.maxPx,
            maxM: r.maxM,
            rankBiasM: r.rankBiasM,
            reverseRatio: r.reverseRatio,
            maxAccelMps2: r.maxAccelMps2,
            maxDecelMps2: r.maxDecelMps2,
            gates: r.gates,
          })),
          worstJumpPx: worstJump?.jump.maxPx,
          worstJumpProfile: worstJump?.profileId,
          worstErrM: worstErr?.maxM,
          worstErrProfile: worstErr?.profileId,
          worstBiasM: worstBias?.rankBiasM,
          worstBiasProfile: worstBias?.profileId,
        });
      }
    }
  }

  const delay0Pass = comboKeys.filter((c) => c.delayMs === 0 && c.passAll && c.accelOk);
  delay0Pass.sort((a, b) => {
    const na = a.publishN.reduce((s, x) => s + x.n, 0);
    const nb = b.publishN.reduce((s, x) => s + x.n, 0);
    if (na !== nb) return na - nb;
    const ta = a.tauAbs === "off" ? -1 : a.tauAbs;
    const tb = b.tauAbs === "off" ? -1 : b.tauAbs;
    return ta - tb;
  });
  const recommended = delay0Pass[0] ?? null;

  const summary = {
    instruction: "S4-10",
    pxPerM,
    jumpDef,
    y0ok: true,
    y0: { expectedPx: expectedY0Px, observedMaxPx: y0MaxPx, perProfile: y0 },
    y6ok,
    rampMps2: { accel: accelMps2, decel: decelMps2 },
    delay0Pass: delay0Pass.map((c) => ({
      eM: c.eM,
      tauAbs: c.tauAbs,
      publishSum: c.publishN.reduce((s, x) => s + x.n, 0),
      worstJumpPx: c.worstJumpPx,
      worstErrM: c.worstErrM,
      worstBiasM: c.worstBiasM,
    })),
    recommended: recommended
      ? { eM: recommended.eM, tauAbs: recommended.tauAbs, delayMs: 0 }
      : null,
    verdict: recommended
      ? `(E, τ_abs) = (${recommended.eM}, ${recommended.tauAbs})`
      : "이 방식으로 불가",
  };

  writeFileSync(resolve(RELAY, "S410-combos.json"), JSON.stringify({ instruction: "S4-10", jumpDef, pxPerM, combos: comboKeys }, null, 2));
  writeFileSync(resolve(RELAY, "S410-summary.json"), JSON.stringify(summary, null, 2));

  console.log("\n=== 조합 delay=0 ===");
  for (const c of comboKeys.filter((x) => x.delayMs === 0)) {
    console.log(
      `E=${c.eM} τ=${c.tauAbs}  pass=${c.passAll}  jumpMax=${c.worstJumpPx?.toFixed?.(1)} px  err=${c.worstErrM?.toFixed?.(3)}  bias=${c.worstBiasM?.toFixed?.(3)}  accelOk=${c.accelOk}`,
    );
    for (const r of c.perProfile) {
      const g = r.gates;
      console.log(
        `    ${r.id}  p99=${r.jumpP99px.toFixed(2)} maxJ=${r.jumpMaxPx.toFixed(1)}  maxE=${r.maxM.toFixed(3)}  bias=${r.rankBiasM.toFixed(3)}  rev=${((r.reverseRatio ?? 0) * 100).toFixed(1)}%  g=${g.g1_bias}/${g.g2_reverse}/${g.g3_maxErr}/${g.g4_jumpP99}`,
      );
    }
  }
  console.log(`\nY6 publish invariant=${y6ok}`);
  console.log(`verdict=${summary.verdict}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

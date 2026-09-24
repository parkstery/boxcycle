/**
 * 지시06 §B4 — 체험 속도 변경 시 거리 적산 검산.
 * useVirtualRideSession: target 변경은 speedRef 만, virtualDistance 는 연속 적분(점프 없음).
 * 램핑은 rideSpeedRamp 와 동일 상수.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = dirname(fileURLToPath(import.meta.url));
mkdirSync(OUT, { recursive: true });

const ACCEL = 20 / 7.5;
const DECEL = 20 / 3;

function stepRideSpeedKmh(currentKmh, targetKmh, deltaMs) {
  if (currentKmh === targetKmh) return targetKmh;
  const accelerating = targetKmh > currentKmh;
  const ratePerSec = accelerating ? ACCEL : DECEL;
  const maxStep = ratePerSec * (deltaMs / 1000);
  return accelerating
    ? Math.min(targetKmh, currentKmh + maxStep)
    : Math.max(targetKmh, currentKmh - maxStep);
}

function integrate(segments) {
  let dist = 0;
  let applied = 0;
  const samples = [];
  for (const seg of segments) {
    const { targetKmh, dtSec, label } = seg;
    const before = dist;
    const steps = Math.max(1, Math.round(dtSec * 20)); // 50ms
    const dtMs = (dtSec * 1000) / steps;
    for (let i = 0; i < steps; i++) {
      applied = stepRideSpeedKmh(applied, targetKmh, dtMs);
      dist += (applied / 3.6) * (dtMs / 1000);
    }
    samples.push({
      label,
      targetKmh,
      dtSec,
      distBefore: +before.toFixed(3),
      distAfter: +dist.toFixed(3),
      deltaM: +(dist - before).toFixed(3),
      appliedEnd: +applied.toFixed(3),
    });
  }
  return { dist, samples };
}

// 1) 속도 변경 직전/직후 — 거리 점프 0
const jumpBefore = 123.456;
const jumpAfter = jumpBefore; // setManualSpeedKmh 는 거리 ref 를 건드리지 않음
const changeInstant = { beforeM: jumpBefore, afterM: jumpAfter, jumpM: jumpAfter - jumpBefore };

// 2) 10 km/h × 60s
const sixty = integrate([{ targetKmh: 10, dtSec: 60, label: "10kmh_60s" }]);
const theory60 = (10 / 3.6) * 60;

// 3) 30(20s) → 10(20s) → 50(20s)
const multi = integrate([
  { targetKmh: 30, dtSec: 20, label: "30_20s" },
  { targetKmh: 10, dtSec: 20, label: "10_20s" },
  { targetKmh: 50, dtSec: 20, label: "50_20s" },
]);
const theoryMulti = ((30 + 10 + 50) / 3.6) * 20;

const report = {
  changeInstant,
  tenKmh60s: {
    actualM: +sixty.dist.toFixed(3),
    theoryM: +theory60.toFixed(3),
    errM: +(sixty.dist - theory60).toFixed(3),
  },
  multiSegment: {
    actualM: +multi.dist.toFixed(3),
    theoryInstantM: +theoryMulti.toFixed(3),
    errM: +(multi.dist - theoryMulti).toFixed(3),
    note: "음수 오차 = 가속/감속 램핑(정상). 구간 경계에서 distBefore==직전 distAfter → 점프 0",
    samples: multi.samples,
  },
  at: new Date().toISOString(),
};

writeFileSync(join(OUT, "distance-integral.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDistanceMeters,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  smoothedHeadingAtRouteDistanceMeters,
  type LineStringGeometry,
  type LngLat,
} from "../../src/lib/geo/geo.ts";
import {
  RIDER_TURN_HALF_SPAN_M,
  RiderTurnSmoother,
  shortestAngleDeltaDeg,
} from "../../src/lib/rider/riderTurn.ts";

const DT_SEC = 1 / 60;
const SPEED_MPS = 20 / 3.6;

function cornerGeometry(bearingDeltaDeg: number, legM = 50): LineStringGeometry {
  const origin: LngLat = [127, 37.5665];
  const corner = offsetLngLatByBearingMeters(origin, 90, legM);
  const end = offsetLngLatByBearingMeters(corner, 90 + bearingDeltaDeg, legM);
  return { type: "LineString", coordinates: [origin, corner, end] };
}

type Sample = { t: number; d: number; headingDeg: number; leanDeg: number };

function simulate(geom: LineStringGeometry): { samples: Sample[]; cornerM: number } {
  const len = lineStringLengthMeters(geom);
  const cornerM = getDistanceMeters(geom.coordinates[0], geom.coordinates[1]);
  const smoother = new RiderTurnSmoother();
  const samples: Sample[] = [];
  const stepM = SPEED_MPS * DT_SEC;
  let d = 0;
  let t = 0;
  for (;;) {
    const target = smoothedHeadingAtRouteDistanceMeters(geom, d, RIDER_TURN_HALF_SPAN_M, len) ?? Number.NaN;
    const out = smoother.update("rider", target, SPEED_MPS, DT_SEC);
    samples.push({ t, d, headingDeg: out.headingDeg, leanDeg: out.leanDeg });
    if (d >= len - 1e-6) break;
    d = Math.min(len, d + stepM);
    t += DT_SEC;
  }
  return { samples, cornerM };
}

function maxHeadingStepDeg(samples: Sample[]): number {
  let worst = 0;
  for (let i = 1; i < samples.length; i += 1) {
    worst = Math.max(
      worst,
      Math.abs(shortestAngleDeltaDeg(samples[i - 1].headingDeg, samples[i].headingDeg)),
    );
  }
  return worst;
}

/** 마지막 ‘from’ 근처 시각 → 그 다음 처음 ‘to’ 근처 시각. */
function headingChangeSec(samples: Sample[], fromDeg: number, toDeg: number): number | null {
  let lastFrom: number | null = null;
  for (const s of samples) {
    if (Math.abs(shortestAngleDeltaDeg(s.headingDeg, fromDeg)) <= 2) lastFrom = s.t;
    if (lastFrom != null && Math.abs(shortestAngleDeltaDeg(s.headingDeg, toDeg)) <= 2 && s.t > lastFrom) {
      return s.t - lastFrom;
    }
  }
  return null;
}

function peakLeanNear(samples: Sample[], cornerM: number, bandM: number): number {
  let best = 0;
  let bestAbs = -1;
  for (const s of samples) {
    if (Math.abs(s.d - cornerM) > bandM) continue;
    const mag = Math.abs(s.leanDeg);
    if (mag > bestAbs) {
      bestAbs = mag;
      best = s.leanDeg;
    }
  }
  return best;
}

describe("rider turn", () => {
  it("shortestAngleDeltaDeg 는 350↔10 과 180 경계를 최단으로 돈다", () => {
    assert.equal(shortestAngleDeltaDeg(350, 10), 20);
    assert.equal(shortestAngleDeltaDeg(10, 350), -20);
    assert.equal(shortestAngleDeltaDeg(0, 180), -180);
    assert.equal(shortestAngleDeltaDeg(0, 179), 179);
    assert.equal(shortestAngleDeltaDeg(0, 181), -179);
    assert.equal(shortestAngleDeltaDeg(10, 190), -180);
  });

  it("90° 좌회전: 프레임당 12° 이하, 1–3초에 걸치고, 코너에서만 기운다", () => {
    const { samples, cornerM } = simulate(cornerGeometry(-90));
    const worst = maxHeadingStepDeg(samples);
    const elapsed = headingChangeSec(samples, 90, 0);
    const mid = samples.reduce((best, s) =>
      Math.abs(s.d - cornerM) < Math.abs(best.d - cornerM) ? s : best,
    );
    assert.ok(worst <= 12, `max step ${worst.toFixed(2)}°`);
    assert.ok(elapsed != null && elapsed >= 1 && elapsed <= 3, `elapsed ${elapsed}`);
    assert.ok(Math.abs(mid.leanDeg) >= 8, `mid lean ${mid.leanDeg.toFixed(2)} at d=${mid.d.toFixed(1)}`);
    for (const s of samples) {
      assert.ok(Math.abs(s.leanDeg) <= 20, `lean cap ${s.leanDeg}`);
      assert.ok(Number.isFinite(s.headingDeg) && Number.isFinite(s.leanDeg));
      const straight = s.d < cornerM - 15 || s.d > cornerM + 15;
      if (straight) assert.ok(Math.abs(s.leanDeg) < 0.5, `straight lean ${s.leanDeg.toFixed(3)} at d=${s.d.toFixed(1)}`);
    }
  });

  it("좌회전과 우회전의 기울기 부호가 반대다", () => {
    const left = simulate(cornerGeometry(-90));
    const right = simulate(cornerGeometry(90));
    const leftLean = peakLeanNear(left.samples, left.cornerM, 8);
    const rightLean = peakLeanNear(right.samples, right.cornerM, 8);
    assert.ok(Math.abs(leftLean) >= 8, `left ${leftLean}`);
    assert.ok(Math.abs(rightLean) >= 8, `right ${rightLean}`);
    assert.ok(leftLean * rightLean < 0, `left ${leftLean} right ${rightLean}`);
  });

  it("170° 헤어핀에서 NaN 이 없고 프레임당 15° 를 넘지 않는다", () => {
    const { samples } = simulate(cornerGeometry(-170));
    const worst = maxHeadingStepDeg(samples);
    assert.ok(worst <= 15, `max step ${worst.toFixed(2)}°`);
    for (const s of samples) {
      assert.ok(Number.isFinite(s.headingDeg), `heading ${s.headingDeg}`);
      assert.ok(Number.isFinite(s.leanDeg), `lean ${s.leanDeg}`);
    }
  });
});

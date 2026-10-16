import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bearingDegrees,
  getDistanceMeters,
  getPointOnRouteByDistance,
  headingAtRouteDistanceMeters,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  smoothedCurveHeadingAtRouteDistanceMeters,
  smoothedHeadingAtRouteDistanceMeters,
  smoothedRoutePoint,
  type LineStringGeometry,
  type LngLat,
} from "../../src/lib/geo/geo.ts";
import {
  RIDER_CURVE_HALF_SPAN_M,
  RIDER_TURN_HEADING_TAU_ROUTE_S,
  RIDER_TURN_HEADING_TAU_S,
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

type Sample = { t: number; d: number; headingDeg: number; leanDeg: number; pos: LngLat };

function simulate(geom: LineStringGeometry): { samples: Sample[]; cornerM: number; len: number } {
  const len = lineStringLengthMeters(geom);
  const cornerM = getDistanceMeters(geom.coordinates[0], geom.coordinates[1]);
  const smoother = new RiderTurnSmoother();
  const samples: Sample[] = [];
  const stepM = SPEED_MPS * DT_SEC;
  let d = 0;
  let t = 0;
  for (;;) {
    const pos = smoothedRoutePoint(geom, d, RIDER_CURVE_HALF_SPAN_M, len);
    const target =
      smoothedCurveHeadingAtRouteDistanceMeters(geom, d, RIDER_CURVE_HALF_SPAN_M, len) ?? Number.NaN;
    const out = smoother.update("rider", target, SPEED_MPS, DT_SEC, RIDER_TURN_HEADING_TAU_ROUTE_S);
    if (pos) samples.push({ t, d, headingDeg: out.headingDeg, leanDeg: out.leanDeg, pos });
    if (d >= len - 1e-6) break;
    d = Math.min(len, d + stepM);
    t += DT_SEC;
  }
  return { samples, cornerM, len };
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

function eastNorthMeters(origin: LngLat, p: LngLat): { e: number; n: number } {
  const midLat = ((origin[1] + p[1]) / 2) * (Math.PI / 180);
  return {
    e: ((p[0] - origin[0]) * Math.PI) / 180 * 6378137 * Math.cos(midLat),
    n: ((p[1] - origin[1]) * Math.PI) / 180 * 6378137,
  };
}

function distanceToSegmentMeters(p: LngLat, a: LngLat, b: LngLat): number {
  const ab = eastNorthMeters(a, b);
  const ap = eastNorthMeters(a, p);
  const ab2 = ab.e * ab.e + ab.n * ab.n;
  if (ab2 <= 0) return Math.hypot(ap.e, ap.n);
  const t = Math.max(0, Math.min(1, (ap.e * ab.e + ap.n * ab.n) / ab2));
  return Math.hypot(ap.e - ab.e * t, ap.n - ab.n * t);
}

function distanceToRouteMeters(geom: LineStringGeometry, p: LngLat): number {
  let best = Number.POSITIVE_INFINITY;
  const coords = geom.coordinates;
  for (let i = 0; i < coords.length - 1; i += 1) {
    best = Math.min(best, distanceToSegmentMeters(p, coords[i], coords[i + 1]));
  }
  return best;
}

const WEB_MERCATOR_R = 6378137;

function toMerc(ll: LngLat): { x: number; y: number } {
  const λ = (ll[0] * Math.PI) / 180;
  const φ = (ll[1] * Math.PI) / 180;
  return {
    x: WEB_MERCATOR_R * λ,
    y: WEB_MERCATOR_R * Math.log(Math.tan(Math.PI / 4 + φ / 2)),
  };
}

function fromMerc(x: number, y: number): LngLat {
  const lng = ((x / WEB_MERCATOR_R) * 180) / Math.PI;
  const lat = ((2 * Math.atan(Math.exp(y / WEB_MERCATOR_R)) - Math.PI / 2) * 180) / Math.PI;
  return [lng, lat];
}

/** C1 중점. 반경 3 m, 머캐이터에서 양 끝의 평균. */
function c1Midpoint(geom: LineStringGeometry, d: number, len: number): LngLat | null {
  const h = 3;
  const lo = Math.max(0, d - h);
  const hi = Math.min(len, d + h);
  const a = getPointOnRouteByDistance(geom, lo);
  const b = getPointOnRouteByDistance(geom, hi);
  if (!a || !b) return null;
  if (lo === hi) return a;
  const pa = toMerc(a);
  const pb = toMerc(b);
  return fromMerc((pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
}

/** C1 방향. 중점 곡선을 ±0.5 m 로 차분. */
function c1EpsilonHeading(geom: LineStringGeometry, d: number, len: number): number | null {
  const eps = 0.5;
  const a = c1Midpoint(geom, d - eps, len);
  const b = c1Midpoint(geom, d + eps, len);
  if (a && b && getDistanceMeters(a, b) > 0.05) return bearingDegrees(a, b);
  return headingAtRouteDistanceMeters(geom, d);
}

function intervalPoint(geom: LineStringGeometry, d: number, len: number): LngLat | null {
  return smoothedRoutePoint(geom, d, RIDER_CURVE_HALF_SPAN_M, len);
}

function intervalHeading(geom: LineStringGeometry, d: number, len: number): number | null {
  return smoothedCurveHeadingAtRouteDistanceMeters(geom, d, RIDER_CURVE_HALF_SPAN_M, len);
}

/** 방향 함수와 다음 프레임 위치 이동의 최대 차. */
function maxGeometricDriftDeg(
  geom: LineStringGeometry,
  pointAt: (geom: LineStringGeometry, d: number, len: number) => LngLat | null,
  headingAt: (geom: LineStringGeometry, d: number, len: number) => number | null,
  stepM = SPEED_MPS * DT_SEC,
): number {
  const len = lineStringLengthMeters(geom);
  let worst = 0;
  let d = 0;
  for (;;) {
    const here = pointAt(geom, d, len);
    const nextD = Math.min(len, d + stepM);
    const there = pointAt(geom, nextD, len);
    // 한 프레임 이동(현)과 비교할 방향은 그 프레임 **중간 지점**의 접선이다(Supervisor 정정).
    // 시작점 접선과 비교하면 곡선 위에서는 이동 길이에 비례하는 이산화 차(Δ/2h rad)가 섞인다.
    const body = headingAt(geom, (d + nextD) / 2, len);
    if (here && there && body != null && getDistanceMeters(here, there) > 1e-4) {
      const move = bearingDegrees(here, there);
      worst = Math.max(worst, Math.abs(shortestAngleDeltaDeg(body, move)));
    }
    if (d >= len - 1e-6) break;
    d = nextD;
  }
  return worst;
}

/** 스무더 출력과 다음 프레임 위치 이동의 최대 차. */
function maxRenderedDriftDeg(
  geom: LineStringGeometry,
  pointAt: (geom: LineStringGeometry, d: number, len: number) => LngLat | null,
  headingAt: (geom: LineStringGeometry, d: number, len: number) => number | null,
  tau: number,
): number {
  const len = lineStringLengthMeters(geom);
  const smoother = new RiderTurnSmoother();
  const stepM = SPEED_MPS * DT_SEC;
  let worst = 0;
  let prev: LngLat | null = null;
  let prevHeading = 0;
  let d = 0;
  for (;;) {
    const pos = pointAt(geom, d, len);
    const target = headingAt(geom, d, len) ?? Number.NaN;
    const out = smoother.update("cmp", target, SPEED_MPS, DT_SEC, tau);
    if (pos && prev && getDistanceMeters(prev, pos) > 1e-4) {
      const move = bearingDegrees(prev, pos);
      worst = Math.max(worst, Math.abs(shortestAngleDeltaDeg(prevHeading, move)));
    }
    if (pos) {
      prev = pos;
      prevHeading = out.headingDeg;
    }
    if (d >= len - 1e-6) break;
    d = Math.min(len, d + stepM);
  }
  return worst;
}

function cornerInsetM(
  geom: LineStringGeometry,
  pointAt: (geom: LineStringGeometry, d: number, len: number) => LngLat | null,
): number {
  const len = lineStringLengthMeters(geom);
  const cornerM = getDistanceMeters(geom.coordinates[0], geom.coordinates[1]);
  const at = pointAt(geom, cornerM, len);
  if (!at) return Number.NaN;
  return getDistanceMeters(at, geom.coordinates[1]);
}

/** 2 m 마다 직각으로 꺾는 짧은 선분. */
function zigzag2m(): LineStringGeometry {
  let cursor: LngLat = [127, 37.5665];
  const coords: LngLat[] = [cursor];
  for (let i = 0; i < 16; i += 1) {
    cursor = offsetLngLatByBearingMeters(cursor, i % 2 === 0 ? 90 : 0, 2);
    coords.push(cursor);
  }
  return { type: "LineString", coordinates: coords };
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

  it("90° 좌회전: 프레임당 12° 이하, 0.5–3초에 걸치고, 코너에서만 기운다", () => {
    const { samples, cornerM } = simulate(cornerGeometry(-90));
    const worst = maxHeadingStepDeg(samples);
    const elapsed = headingChangeSec(samples, 90, 0);
    const mid = samples.reduce((best, s) =>
      Math.abs(s.d - cornerM) < Math.abs(best.d - cornerM) ? s : best,
    );
    console.log(
      `corner90 step=${worst.toFixed(2)}° elapsed=${elapsed?.toFixed(3)}s midLean=${mid.leanDeg.toFixed(2)}°`,
    );
    assert.ok(worst <= 12, `max step ${worst.toFixed(2)}°`);
    assert.ok(elapsed != null && elapsed >= 0.5 && elapsed <= 3, `elapsed ${elapsed}`);
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
    console.log(`lean left=${leftLean.toFixed(2)}° right=${rightLean.toFixed(2)}°`);
    assert.ok(Math.abs(leftLean) >= 8, `left ${leftLean}`);
    assert.ok(Math.abs(rightLean) >= 8, `right ${rightLean}`);
    assert.ok(leftLean * rightLean < 0, `left ${leftLean} right ${rightLean}`);
  });

  it("170° 헤어핀에서 NaN 이 없고 프레임당 15° 를 넘지 않는다", () => {
    const { samples } = simulate(cornerGeometry(-170));
    const worst = maxHeadingStepDeg(samples);
    console.log(`hairpin170 step=${worst.toFixed(2)}°`);
    assert.ok(worst <= 15, `max step ${worst.toFixed(2)}°`);
    for (const s of samples) {
      assert.ok(Number.isFinite(s.headingDeg), `heading ${s.headingDeg}`);
      assert.ok(Number.isFinite(s.leanDeg), `lean ${s.leanDeg}`);
    }
  });

  it("90° 코너에서 구간 평균 위치와 끝점 현이 어긋나지 않는다", () => {
    const geom = cornerGeometry(-90);
    const len = lineStringLengthMeters(geom);
    const cornerM = getDistanceMeters(geom.coordinates[0], geom.coordinates[1]);
    const h = RIDER_CURVE_HALF_SPAN_M;
    // 90°: ∫들어오는 (−h²/2, 0) + ∫나가는 (0, h²/2), 창 2h 로 나누면 (−h/4, h/4).
    // 꼭짓점까지 거리 = (h/4)·√2 = h/(2√2).
    const expectInset = h / (2 * Math.SQRT2);
    const inset = cornerInsetM(geom, intervalPoint);
    const c1Inset = cornerInsetM(geom, c1Midpoint);
    assert.ok(Math.abs(inset - expectInset) <= 0.05, `inset ${inset.toFixed(3)} expect ${expectInset.toFixed(3)}`);

    const stepM = SPEED_MPS * DT_SEC;
    let straightWorst = 0;
    for (let d = 0; d <= len; d += stepM) {
      const curveH = intervalHeading(geom, d, len);
      const chordH = smoothedHeadingAtRouteDistanceMeters(geom, d, h, len);
      assert.equal(curveH, chordH);
      if (Math.abs(d - cornerM) <= h + 1) continue;
      const p = intervalPoint(geom, d, len);
      assert.ok(p);
      const off = distanceToRouteMeters(geom, p);
      straightWorst = Math.max(straightWorst, off);
      assert.ok(off <= 0.01, `off ${off.toFixed(4)} m at d=${d.toFixed(2)}`);
    }

    const c1Geometric = maxGeometricDriftDeg(geom, c1Midpoint, c1EpsilonHeading);
    const geometric = maxGeometricDriftDeg(geom, intervalPoint, intervalHeading);
    const geometricMm = maxGeometricDriftDeg(geom, intervalPoint, intervalHeading, 0.001);
    const c1Rendered = maxRenderedDriftDeg(geom, c1Midpoint, c1EpsilonHeading, RIDER_TURN_HEADING_TAU_S);
    const rendered = maxRenderedDriftDeg(geom, intervalPoint, intervalHeading, RIDER_TURN_HEADING_TAU_ROUTE_S);
    console.log(
      [
        "metric | c1-midpoint | interval-mean",
        `geometric-deg | ${c1Geometric.toFixed(2)} | ${geometric.toFixed(2)}`,
        `geometric-1mm-deg | | ${geometricMm.toFixed(4)}`,
        `rendered-deg | ${c1Rendered.toFixed(2)} | ${rendered.toFixed(2)}`,
        `inset-m | ${c1Inset.toFixed(3)} | ${inset.toFixed(3)}`,
        `straight-off-m | | ${straightWorst.toFixed(4)}`,
        `expect-inset-m | | ${expectInset.toFixed(4)}`,
      ].join("\n"),
    );
    assert.ok(geometric <= 0.5, `geometric ${geometric.toFixed(2)}°`);
    assert.ok(rendered <= 3, `rendered ${rendered.toFixed(2)}°`);
  });

  it("2 m 지그재그와 경로 끝에서 NaN 과 튐이 없다", () => {
    const paths = [zigzag2m(), cornerGeometry(-90, 1.5)];
    for (const geom of paths) {
      const len = lineStringLengthMeters(geom);
      for (const d of [-1, 0, len, len + 5]) {
        const p = smoothedRoutePoint(geom, d, RIDER_CURVE_HALF_SPAN_M, len);
        const hdg = smoothedCurveHeadingAtRouteDistanceMeters(geom, d, RIDER_CURVE_HALF_SPAN_M, len);
        assert.ok(p && Number.isFinite(p[0]) && Number.isFinite(p[1]), `pos d=${d}`);
        assert.ok(hdg != null && Number.isFinite(hdg), `hdg d=${d}`);
      }
      const probe = 0.05;
      let prev: LngLat | null = null;
      let prevH: number | null = null;
      let worstStep = 0;
      let worstTurn = 0;
      for (let d = 0; ; ) {
        const p = smoothedRoutePoint(geom, d, RIDER_CURVE_HALF_SPAN_M, len);
        const hdg = smoothedCurveHeadingAtRouteDistanceMeters(geom, d, RIDER_CURVE_HALF_SPAN_M, len);
        assert.ok(p && hdg != null && Number.isFinite(hdg));
        if (prev && prevH != null) {
          const step = getDistanceMeters(prev, p);
          const turn = Math.abs(shortestAngleDeltaDeg(prevH, hdg));
          worstStep = Math.max(worstStep, step);
          worstTurn = Math.max(worstTurn, turn);
          assert.ok(step <= 0.2, `pos jump ${step.toFixed(4)} m at d=${d.toFixed(2)}`);
          assert.ok(turn <= 12, `heading jump ${turn.toFixed(2)}° at d=${d.toFixed(2)}`);
        }
        prev = p;
        prevH = hdg;
        if (d >= len - 1e-9) break;
        d = Math.min(len, d + probe);
      }
      console.log(`continuity len=${len.toFixed(2)} pos=${worstStep.toFixed(4)} m turn=${worstTurn.toFixed(2)}°`);
    }
  });

  it("경로 방향 τ 는 0.03 s 이고 생략하면 0.15 s 다", () => {
    const gps = new RiderTurnSmoother();
    const route = new RiderTurnSmoother();
    gps.update("a", 0, 0, DT_SEC);
    route.update("a", 0, 0, DT_SEC, RIDER_TURN_HEADING_TAU_ROUTE_S);
    const g = gps.update("a", 90, SPEED_MPS, DT_SEC);
    const r = route.update("a", 90, SPEED_MPS, DT_SEC, RIDER_TURN_HEADING_TAU_ROUTE_S);
    const expectDeg = (tau: number) => 90 * (1 - Math.exp(-DT_SEC / tau));
    assert.equal(RIDER_TURN_HEADING_TAU_S, 0.15);
    assert.equal(RIDER_TURN_HEADING_TAU_ROUTE_S, 0.03);
    assert.ok(Math.abs(g.headingDeg - expectDeg(RIDER_TURN_HEADING_TAU_S)) < 1e-6, `gps ${g.headingDeg}`);
    assert.ok(Math.abs(r.headingDeg - expectDeg(RIDER_TURN_HEADING_TAU_ROUTE_S)) < 1e-6, `route ${r.headingDeg}`);
  });
});

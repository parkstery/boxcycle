import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  distanceOnRouteByProjectedPoint,
  getPointOnRouteByDistance,
  headingAtRouteDistanceMeters,
  lineStringLengthMeters,
  smoothedHeadingAtRouteDistanceMeters,
  smoothedRoutePoint,
  type LineStringGeometry,
  type LngLat,
} from "../../src/lib/geo/geo.ts";
import { BASIC_INTRO_AMSTERDAM_VONDELPARK_ROUTE } from "../../src/lib/route/basicIntroHubRouteGeometries.ts";

/** 색인 도입 전의 선형 검색. 제품 함수와 1e-9 로 맞춘다. */
function haversineMeters(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const WEB_MERCATOR_R = 6378137;

function toMercator(lngLat: LngLat): { x: number; y: number } {
  const λ = (lngLat[0] * Math.PI) / 180;
  const φ = (lngLat[1] * Math.PI) / 180;
  return {
    x: WEB_MERCATOR_R * λ,
    y: WEB_MERCATOR_R * Math.log(Math.tan(Math.PI / 4 + φ / 2)),
  };
}

function fromMercator(x: number, y: number): LngLat {
  const lng = ((x / WEB_MERCATOR_R) * 180) / Math.PI;
  const lat = ((2 * Math.atan(Math.exp(y / WEB_MERCATOR_R)) - Math.PI / 2) * 180) / Math.PI;
  return [lng, lat];
}

function interpolateMercator(a: LngLat, b: LngLat, ratio: number): LngLat {
  const t = Math.min(1, Math.max(0, ratio));
  const pa = toMercator(a);
  const pb = toMercator(b);
  return fromMercator(pa.x + (pb.x - pa.x) * t, pa.y + (pb.y - pa.y) * t);
}

function linearPoint(geometry: LineStringGeometry, distanceMeters: number): LngLat | null {
  const coords = geometry.coordinates;
  if (!coords.length) return null;
  if (coords.length === 1) return coords[0];
  let remaining = Math.max(0, distanceMeters);
  for (let i = 0; i < coords.length - 1; i += 1) {
    const segmentDistance = haversineMeters(coords[i], coords[i + 1]);
    if (segmentDistance <= 0) continue;
    if (remaining <= segmentDistance) {
      return interpolateMercator(coords[i], coords[i + 1], remaining / segmentDistance);
    }
    remaining -= segmentDistance;
  }
  return coords[coords.length - 1];
}

function linearLength(geometry: LineStringGeometry): number {
  const coords = geometry.coordinates;
  let sum = 0;
  for (let i = 1; i < coords.length; i += 1) sum += haversineMeters(coords[i - 1], coords[i]);
  return sum;
}

function linearHeading(geometry: LineStringGeometry, distanceMeters: number): number | null {
  const coords = geometry.coordinates;
  if (coords.length < 2) return null;
  let idx = 0;
  let remain = Math.max(0, distanceMeters);
  while (idx < coords.length - 1) {
    const seg = haversineMeters(coords[idx], coords[idx + 1]);
    if (seg <= 0) {
      idx += 1;
      continue;
    }
    if (remain <= seg) return bearing(coords[idx], coords[idx + 1]);
    remain -= seg;
    idx += 1;
  }
  return bearing(coords[coords.length - 2], coords[coords.length - 1]);
}

function bearing(from: LngLat, to: LngLat): number {
  const φ1 = (from[1] * Math.PI) / 180;
  const φ2 = (to[1] * Math.PI) / 180;
  const Δλ = ((to[0] - from[0]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

function linearSmooth(geometry: LineStringGeometry, distanceMeters: number, halfSpanM: number, routeLenM: number): LngLat | null {
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(halfSpanM) || !Number.isFinite(routeLenM)) return null;
  const coords = geometry.coordinates;
  if (!coords.length) return null;
  if (coords.length === 1) return coords[0];
  const span = Math.max(0, halfSpanM);
  const total = Math.max(0, routeLenM);
  const lo = Math.max(0, Math.min(total, distanceMeters - span));
  const hi = Math.max(lo, Math.min(total, distanceMeters + span));
  if (hi - lo <= 1e-9) return linearPoint(geometry, lo);
  let acc = 0;
  let sumX = 0;
  let sumY = 0;
  let sumLen = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversineMeters(a, b);
    if (segLen <= 0) continue;
    const segStart = acc;
    acc += segLen;
    if (acc <= lo) continue;
    if (segStart >= hi) break;
    const overlapLo = Math.max(lo, segStart);
    const overlapHi = Math.min(hi, acc);
    const overlap = overlapHi - overlapLo;
    if (overlap <= 0) continue;
    const tMid = ((overlapLo + overlapHi) / 2 - segStart) / segLen;
    const pa = toMercator(a);
    const pb = toMercator(b);
    sumX += (pa.x + (pb.x - pa.x) * tMid) * overlap;
    sumY += (pa.y + (pb.y - pa.y) * tMid) * overlap;
    sumLen += overlap;
  }
  if (!(sumLen > 0)) return linearPoint(geometry, lo);
  return fromMercator(sumX / sumLen, sumY / sumLen);
}

function linearProject(geometry: LineStringGeometry, point: LngLat): number | null {
  const coords = geometry.coordinates;
  if (coords.length < 2) return null;
  let cumulative = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestRouteDistance = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversineMeters(a, b);
    if (segLen <= 0) continue;
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = point[0] - a[0];
    const apy = point[1] - a[1];
    const denom = abx * abx + aby * aby;
    const rawT = denom > 0 ? (apx * abx + apy * aby) / denom : 0;
    const t = Math.max(0, Math.min(1, rawT));
    const projected: LngLat = [a[0] + abx * t, a[1] + aby * t];
    const d = haversineMeters(projected, point);
    if (d < bestDistance) {
      bestDistance = d;
      bestRouteDistance = cumulative + segLen * t;
    }
    cumulative += segLen;
  }
  return bestRouteDistance;
}

function angDelta(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function assertLngLat(actual: LngLat | null, expected: LngLat | null, label: string): void {
  assert.ok(actual && expected, label);
  if (!actual || !expected) return;
  assert.ok(Math.abs(actual[0] - expected[0]) <= 1e-9, `${label} lng ${actual[0]} vs ${expected[0]}`);
  assert.ok(Math.abs(actual[1] - expected[1]) <= 1e-9, `${label} lat ${actual[1]} vs ${expected[1]}`);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function vondel(): LineStringGeometry {
  return { type: "LineString", coordinates: BASIC_INTRO_AMSTERDAM_VONDELPARK_ROUTE.coordinates.map((p) => [p[0], p[1]]) };
}

function zigzag(): LineStringGeometry {
  const coordinates: LngLat[] = [[4.87, 52.36]];
  let lng = 4.87;
  let lat = 52.36;
  for (let i = 0; i < 40; i += 1) {
    lng += i % 2 === 0 ? 0.0004 : -0.00005;
    lat += 0.00012;
    coordinates.push([lng, lat]);
    if (i % 7 === 0) coordinates.push([lng, lat]);
  }
  return { type: "LineString", coordinates };
}

describe("route distance index", () => {
  it("무작위 거리 1만 개 — 점·방위·구간평균이 선형 검색과 1e-9", () => {
    const geometries = [vondel(), zigzag()];
    const rand = mulberry32(20261016);
    let worstHead = 0;
    for (const geometry of geometries) {
      const len = linearLength(geometry);
      assert.ok(Math.abs(lineStringLengthMeters(geometry) - len) <= 1e-9);
      for (let n = 0; n < 10000; n += 1) {
        const d = (rand() * 1.2 - 0.1) * len;
        assertLngLat(getPointOnRouteByDistance(geometry, d), linearPoint(geometry, d), `point ${d}`);
        const h0 = linearHeading(geometry, d);
        const h1 = headingAtRouteDistanceMeters(geometry, d);
        assert.equal(h1 == null, h0 == null);
        if (h0 != null && h1 != null) assert.ok(angDelta(h0, h1) <= 1e-9, `heading ${d}`);
        const span = 4;
        assertLngLat(
          smoothedRoutePoint(geometry, d, span, len),
          linearSmooth(geometry, d, span, len),
          `smooth ${d}`,
        );
        const lo = Math.max(0, d - span);
        const hi = Math.min(len, d + span);
        const a = linearPoint(geometry, lo);
        const b = linearPoint(geometry, hi);
        const shLinear =
          a && b && haversineMeters(a, b) > 0.05 ? bearing(a, b) : linearHeading(geometry, d);
        const sh = smoothedHeadingAtRouteDistanceMeters(geometry, d, span, len);
        assert.equal(sh == null, shLinear == null);
        if (sh != null && shLinear != null) {
          const delta = angDelta(sh, shLinear);
          if (delta > worstHead) worstHead = delta;
          assert.ok(delta <= 1e-7, `shead ${d} delta=${delta}`);
        }
      }
    }
    assert.ok(worstHead <= 1e-7);
  });

  it("같은 거리 재호출과 좌표 배열 교체", () => {
    const geometry = vondel();
    const len = lineStringLengthMeters(geometry);
    const first = getPointOnRouteByDistance(geometry, len * 0.3);
    const second = getPointOnRouteByDistance(geometry, len * 0.3);
    assertLngLat(first, second, "repeat");
    geometry.coordinates = geometry.coordinates.slice(0, 4);
    const short = lineStringLengthMeters(geometry);
    assert.ok(short < len / 2);
    assertLngLat(getPointOnRouteByDistance(geometry, short), linearPoint(geometry, short), "replaced");
  });

  it("빈 선·한 점·끝 너머·투영", () => {
    const empty: LineStringGeometry = { type: "LineString", coordinates: [] };
    assert.equal(getPointOnRouteByDistance(empty, 10), null);
    assert.equal(lineStringLengthMeters(empty), 0);
    const one: LineStringGeometry = { type: "LineString", coordinates: [[4.8, 52.3]] };
    assert.deepEqual(getPointOnRouteByDistance(one, 5), [4.8, 52.3]);
    const geometry = zigzag();
    const len = linearLength(geometry);
    assertLngLat(getPointOnRouteByDistance(geometry, -5), linearPoint(geometry, -5), "neg");
    assertLngLat(getPointOnRouteByDistance(geometry, len + 50), linearPoint(geometry, len + 50), "past");
    const off: LngLat = [geometry.coordinates[3][0] + 0.0002, geometry.coordinates[3][1] - 0.0001];
    const projected = distanceOnRouteByProjectedPoint(geometry, off);
    const linear = linearProject(geometry, off);
    assert.ok(projected != null && linear != null);
    if (projected != null && linear != null) assert.ok(Math.abs(projected - linear) <= 1e-9);
  });
});

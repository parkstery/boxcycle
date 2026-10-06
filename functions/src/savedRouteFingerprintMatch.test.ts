/**
 * 저장 경로 지문 대조 — 옛 규칙 저장값·geometry 재계산·백필 판정.
 * 실행: `npm test` (functions). `node --test lib/savedRouteFingerprintMatch.test.js`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { computeRouteFingerprintHex, type LngLat } from "./routeFingerprintCore.js";
import {
  SAVED_ROUTE_GEOMETRY_UNREADABLE_REASON,
  SAVED_ROUTE_SHAPE_MISMATCH_REASON,
  matchSavedRouteFingerprint,
} from "./savedRouteFingerprintMatch.js";

const COORDS_A: LngLat[] = [
  [127.0276, 37.4979],
  [127.03, 37.5],
  [127.035, 37.505],
];
const COORDS_B: LngLat[] = [
  [126.978, 37.5665],
  [126.98, 37.57],
  [126.985, 37.575],
];
const PROFILE = "cycling" as const;
const FP_A = computeRouteFingerprintHex(COORDS_A, PROFILE);
const FP_B = computeRouteFingerprintHex(COORDS_B, PROFILE);
/** 옛 규칙(좌표열 해시)처럼 보이는 가짜 64자 — 현재 규칙 FP_A 와 다름 */
const OLD_RULE_FP = "a".repeat(64);

assert.notEqual(OLD_RULE_FP, FP_A);
assert.notEqual(FP_A, FP_B);

test("(a) 옛 규칙 저장값 + 같은 geometry → 통과·백필 필요", () => {
  const r = matchSavedRouteFingerprint({
    applicantFingerprint: FP_A,
    savedRouteFingerprint: OLD_RULE_FP,
    geometryCoordsJson: JSON.stringify(COORDS_A),
    geometry: undefined,
    profile: PROFILE,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.needsBackfill, true);
  }
});

test("(b) 새 규칙 저장값 일치 → 통과·백필 불필요", () => {
  const r = matchSavedRouteFingerprint({
    applicantFingerprint: FP_A,
    savedRouteFingerprint: FP_A,
    geometryCoordsJson: JSON.stringify(COORDS_A),
    geometry: undefined,
    profile: PROFILE,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.needsBackfill, false);
  }
});

test("(c) geometry 다름 → 거절(모양 불일치 문구)", () => {
  const r = matchSavedRouteFingerprint({
    applicantFingerprint: FP_A,
    savedRouteFingerprint: FP_B,
    geometryCoordsJson: JSON.stringify(COORDS_B),
    geometry: undefined,
    profile: PROFILE,
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, SAVED_ROUTE_SHAPE_MISMATCH_REASON);
  }
});

test("(d1) geometry 없음 + 저장값 일치 → 통과", () => {
  const r = matchSavedRouteFingerprint({
    applicantFingerprint: FP_A,
    savedRouteFingerprint: FP_A,
    geometryCoordsJson: undefined,
    geometry: undefined,
    profile: PROFILE,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.needsBackfill, false);
  }
});

test("(d2) geometry 없음 + 저장값 불일치 → 거절", () => {
  const r = matchSavedRouteFingerprint({
    applicantFingerprint: FP_A,
    savedRouteFingerprint: OLD_RULE_FP,
    geometryCoordsJson: null,
    geometry: null,
    profile: PROFILE,
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, SAVED_ROUTE_GEOMETRY_UNREADABLE_REASON);
  }
});

test("legacy geometry.coordinates 도 재계산에 사용", () => {
  const r = matchSavedRouteFingerprint({
    applicantFingerprint: FP_A,
    savedRouteFingerprint: OLD_RULE_FP,
    geometryCoordsJson: undefined,
    geometry: { type: "LineString", coordinates: COORDS_A },
    profile: PROFILE,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.needsBackfill, true);
  }
});

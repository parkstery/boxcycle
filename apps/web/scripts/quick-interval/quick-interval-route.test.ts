// 간편 인터벌 주행 — 목표 거리와 무작위 방향 재시도 계약(순수 함수).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bearingGapDeg,
  pickQuickIntervalBearing,
  QUICK_INTERVAL_DISTANCE_MARGIN,
  QUICK_INTERVAL_MAX_ATTEMPTS,
  QUICK_INTERVAL_MIN_BEARING_GAP_DEG,
  resolveQuickIntervalTargetKm,
  runQuickIntervalAttempts,
} from "../../src/lib/ride/quickIntervalRoute.ts";
import {
  INTERVAL_ROUTE_BASIS_KMH,
  resolveIntervalBasisKmh,
} from "../../src/lib/route/intervalRouteDistance.ts";

/** 주입용 결정적 난수열 — 소진되면 처음부터 되돌아간다 */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("M0 · 시험 자가 검산", () => {
  it("기준 속도 25, 여유분 1.3, 최대 3회가 실제 상수와 같다", () => {
    assert.equal(INTERVAL_ROUTE_BASIS_KMH, 25);
    assert.equal(resolveIntervalBasisKmh(), 25);
    assert.equal(QUICK_INTERVAL_DISTANCE_MARGIN, 1.3);
    assert.equal(QUICK_INTERVAL_MAX_ATTEMPTS, 3);
  });
});

describe("목표 거리", () => {
  it("15분 → 15/60 × 25 × 1.3 = 8.125 → 8.1 km", () => {
    assert.equal(resolveQuickIntervalTargetKm(15 * 60), 8.1);
  });
  it("여유분 없는 거리(6.3 km)보다 항상 길다 — 25분 기본 루틴", () => {
    const km = resolveQuickIntervalTargetKm(25 * 60);
    assert.ok(km > (25 / 60) * 25, `${km}`);
    assert.equal(km, 13.5);
  });
  it("하한 0.5 · 상한 120 으로 제한한다", () => {
    assert.equal(resolveQuickIntervalTargetKm(10), 0.5);
    assert.equal(resolveQuickIntervalTargetKm(0), 0.5);
    assert.equal(resolveQuickIntervalTargetKm(Number.NaN), 0.5);
    assert.equal(resolveQuickIntervalTargetKm(100 * 3600), 120);
  });
  it("기준 속도를 바꾸면 목표 거리가 따라 바뀐다(25 를 직접 적지 않았다)", () => {
    const base = resolveQuickIntervalTargetKm(3600);
    assert.equal(base, 32.5);
    assert.equal(resolveQuickIntervalTargetKm(3600, 20), 26);
    assert.equal(resolveQuickIntervalTargetKm(3600, 40), 52);
    assert.notEqual(resolveQuickIntervalTargetKm(3600, 20), base);
  });
});

describe("방위 재시도", () => {
  it("bearingGapDeg 는 0~180 이고 360 경계를 넘는다", () => {
    assert.equal(bearingGapDeg(10, 350), 20);
    assert.equal(bearingGapDeg(0, 180), 180);
    assert.equal(bearingGapDeg(90, 270), 180);
    assert.equal(bearingGapDeg(-10, 10), 20);
  });
  it("실패한 방위들과 모두 90° 이상 떨어진 방위를 고른다", () => {
    // 첫 난수 0.01(≈3.6°)·0.3(108°)는 실패 방위 0° 와 90° 안/밖 — 거절 표집 확인
    const failed = [0];
    const picked = pickQuickIntervalBearing(failed, seq([0.01, 0.1, 0.3]));
    assert.ok(picked >= 90 && picked <= 270, `${picked}`);
    assert.equal(picked, 0.3 * 360);
  });
  it("무작위 100 조합에서도 항상 간격을 지킨다", () => {
    let s = 12345;
    const lcg = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let i = 0; i < 100; i += 1) {
      const first = pickQuickIntervalBearing([], lcg);
      const second = pickQuickIntervalBearing([first], lcg);
      assert.ok(bearingGapDeg(first, second) >= QUICK_INTERVAL_MIN_BEARING_GAP_DEG);
    }
  });
  it("실패 방위가 거의 반대편이라 90° 구간이 없으면 최대 간격 방위로 대신한다", () => {
    const picked = pickQuickIntervalBearing([0, 180], seq([0.0, 0.5]));
    assert.equal(bearingGapDeg(picked, 0), 90);
    assert.equal(bearingGapDeg(picked, 180), 90);
  });
});

describe("탐색 루프", () => {
  it("3회 모두 실패하면 정확히 3번 요청하고 failed", async () => {
    const calls: number[] = [];
    const result = await runQuickIntervalAttempts({
      random: seq([0.05, 0.4, 0.75, 0.2, 0.6, 0.9]),
      search: async (bearing) => {
        calls.push(bearing);
        return "failed";
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.attempts, 3);
    assert.equal(calls.length, QUICK_INTERVAL_MAX_ATTEMPTS);
    assert.deepEqual(result.bearings, calls);
  });
  it("재시도 방위는 앞서 실패한 모든 방위와 90° 이상 떨어져 있다", async () => {
    const result = await runQuickIntervalAttempts({
      random: seq([0.05, 0.1, 0.4, 0.2, 0.75, 0.9]),
      search: async () => "failed",
    });
    const [a, b, c] = result.bearings as [number, number, number];
    assert.ok(bearingGapDeg(a, b) >= 90);
    assert.ok(bearingGapDeg(a, c) >= 90);
    assert.ok(bearingGapDeg(b, c) >= 90);
  });
  it("두 번째에 성공하면 거기서 멈춘다", async () => {
    let n = 0;
    const result = await runQuickIntervalAttempts({
      random: seq([0.1, 0.6, 0.3]),
      search: async () => (++n === 2 ? "found" : "failed"),
    });
    assert.equal(result.status, "found");
    assert.equal(result.attempts, 2);
    assert.equal(n, 2);
  });
  it("취소(늦은 응답)면 다시 시도하지 않는다", async () => {
    let n = 0;
    const result = await runQuickIntervalAttempts({ search: async () => (++n, "cancelled" as const) });
    assert.equal(result.status, "cancelled");
    assert.equal(n, 1);
  });
});

// 예상 시간 계약 — 5A-R2 §4.3.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISTANCE_AUTO_ROUTE_FALLBACK_KMH,
  formatDistanceAutoRouteEta,
  resolveDistanceAutoRouteEta,
  resolveUserAverageKmh,
} from "../../src/lib/distanceAutoRouteEta.ts";

describe("M0 · 시험 자가 검산", () => {
  it("폴백 속도가 상수 0 이 아니다", () => {
    assert.ok(DISTANCE_AUTO_ROUTE_FALLBACK_KMH > 0);
  });
  it("누적 평균과 폴백이 서로 다른 값이라 분기를 구별한다", () => {
    const avg = resolveUserAverageKmh(100_000, 3600 * 4); // 25 km/h
    assert.ok(avg != null && Math.abs(avg - 25) < 1e-9);
    assert.notEqual(avg, DISTANCE_AUTO_ROUTE_FALLBACK_KMH);
  });
});

describe("§4.3 · 누적 평균을 쓴다", () => {
  it("5 km · 평균 24.3 km/h → 약 12분, 「내 평균」 표기", () => {
    const eta = resolveDistanceAutoRouteEta({
      targetKm: 5,
      mileageTotalMeters: 243_000,
      mileageTotalSec: 3600 * 10,
    });
    assert.equal(eta.fromUserAverage, true);
    assert.ok(Math.abs(eta.kmh - 24.3) < 0.01, `${eta.kmh}`);
    assert.equal(eta.minutes, 12);
    assert.match(formatDistanceAutoRouteEta(eta), /내 평균 24\.3 km\/h/);
  });
});

describe("§4.3 · 폴백 — 축퇴값이 조용히 통과하지 않는다", () => {
  const bad: Array<[unknown, unknown, string]> = [
    [null, null, "누적 없음(신규 사용자)"],
    [0, 0, "0/0"],
    [1000, 0, "시간 0 — 0 나눗셈"],
    [0, 3600, "거리 0"],
    [Number.NaN, 3600, "NaN"],
    [1000, Number.NaN, "NaN"],
    [-1000, 3600, "음수"],
    [1_000_000, 3600, "1000 km/h — 센서 폭주"],
    [1000, 3600 * 100, "0.01 km/h — 비현실적"],
  ];
  for (const [m, sec, label] of bad) {
    it(`${label} → 폴백, 「내 평균」 표기 없음`, () => {
      assert.equal(resolveUserAverageKmh(m as number, sec as number), null);
      const eta = resolveDistanceAutoRouteEta({
        targetKm: 5,
        mileageTotalMeters: m as number,
        mileageTotalSec: sec as number,
      });
      assert.equal(eta.fromUserAverage, false);
      assert.equal(eta.kmh, DISTANCE_AUTO_ROUTE_FALLBACK_KMH);
      assert.doesNotMatch(formatDistanceAutoRouteEta(eta), /내 평균/);
    });
  }

  it("목표 거리가 퇴화해도 최소 1분을 준다", () => {
    for (const km of [0, -1, Number.NaN]) {
      const eta = resolveDistanceAutoRouteEta({ targetKm: km });
      assert.ok(eta.minutes >= 1 && Number.isFinite(eta.minutes));
    }
  });
});

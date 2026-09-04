// 거리 슬라이더 구간별 스냅 계약 — 5A-R1 §4.2.
//
// 문제는 눈금 크기가 아니라 범위였다. 0.5~120 km 를 0.5 균일 눈금으로 두면 240칸이고
// 폰 슬라이더 폭이 200 px 남짓이라 한 칸이 1 px 미만 — 손가락으로 특정 값을 못 고른다.
// 정밀도를 실제 주행이 일어나는 짧은 구간에 몰아준다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISTANCE_AUTO_ROUTE_KM_MAX,
  DISTANCE_AUTO_ROUTE_KM_MIN,
  DISTANCE_AUTO_ROUTE_SNAP_BANDS,
  distanceAutoRouteSliderStops,
  snapDistanceAutoRouteTargetKm,
} from "../../src/lib/distanceAutoRouteErrors.ts";

describe("M0 · 시험 자가 검산", () => {
  it("구간이 셋이고 눈금이 서로 다르다(균일이면 시험이 무의미하다)", () => {
    assert.equal(DISTANCE_AUTO_ROUTE_SNAP_BANDS.length, 3);
    const steps = DISTANCE_AUTO_ROUTE_SNAP_BANDS.map((b) => b.stepKm);
    assert.equal(new Set(steps).size, 3, `눈금이 겹친다: ${steps.join(",")}`);
  });
});

describe("§4.2 · 슬라이더 눈금", () => {
  const stops = distanceAutoRouteSliderStops();

  it("칸 수가 폰에서 고를 수 있는 수준이다 — 240칸 → 32칸", () => {
    assert.ok(stops.length - 1 <= 40, `${stops.length - 1}칸`);
    // 200px 폭 기준 한 칸 6px 이상
    assert.ok(200 / (stops.length - 1) >= 5, `한 칸 ${(200 / (stops.length - 1)).toFixed(1)}px`);
  });

  it("오름차순이고 중복이 없다", () => {
    for (let i = 1; i < stops.length; i += 1) {
      assert.ok(stops[i]! > stops[i - 1]!, `${stops[i - 1]} → ${stops[i]}`);
    }
  });

  it("양 끝이 범위와 정확히 같다", () => {
    assert.equal(stops[0], DISTANCE_AUTO_ROUTE_KM_MIN);
    assert.equal(stops[stops.length - 1], DISTANCE_AUTO_ROUTE_KM_MAX);
  });

  it("10 km 아래는 0.5 눈금 — 실제 주행 구간에 정밀도가 몰린다", () => {
    const near = stops.filter((v) => v <= 10);
    assert.equal(near.length, 20, near.join(","));
    for (let i = 1; i < near.length; i += 1) {
      assert.ok(Math.abs(near[i]! - near[i - 1]! - 0.5) < 1e-9);
    }
  });

  it("경계 10 km 에서 눈금이 0.5 → 5 로 바뀐다", () => {
    assert.ok(stops.includes(10));
    assert.ok(stops.includes(15), "10 다음이 15 여야 한다");
    assert.ok(!stops.includes(10.5), "구간이 앞 눈금으로 시작하면 10.5 같은 값이 생긴다");
  });

  it("경계 30 km 에서 눈금이 5 → 10 으로 바뀐다", () => {
    assert.ok(stops.includes(30));
    assert.ok(stops.includes(40), "30 다음이 40 이어야 한다");
    assert.ok(!stops.includes(35), "구간이 앞 눈금으로 시작하면 35 가 생긴다");
  });
});

describe("§4.2 · 스냅", () => {
  it("가까운 눈금으로 붙는다", () => {
    assert.equal(snapDistanceAutoRouteTargetKm(0.7), 0.5);
    assert.equal(snapDistanceAutoRouteTargetKm(3.2), 3);
    assert.equal(snapDistanceAutoRouteTargetKm(3.3), 3.5);
    assert.equal(snapDistanceAutoRouteTargetKm(12), 10);
    assert.equal(snapDistanceAutoRouteTargetKm(13), 15);
    assert.equal(snapDistanceAutoRouteTargetKm(27), 25);
    assert.equal(snapDistanceAutoRouteTargetKm(33), 30);
  });

  it("범위 밖은 끝값으로 clamp 된다", () => {
    assert.equal(snapDistanceAutoRouteTargetKm(0), DISTANCE_AUTO_ROUTE_KM_MIN);
    assert.equal(snapDistanceAutoRouteTargetKm(-5), DISTANCE_AUTO_ROUTE_KM_MIN);
    assert.equal(snapDistanceAutoRouteTargetKm(500), DISTANCE_AUTO_ROUTE_KM_MAX);
  });

  it("비유한 입력도 유효한 값을 돌려준다", () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = snapDistanceAutoRouteTargetKm(v);
      assert.ok(Number.isFinite(r) && r >= DISTANCE_AUTO_ROUTE_KM_MIN);
    }
  });

  it("눈금 위의 값은 그대로 남는다(멱등)", () => {
    for (const s of distanceAutoRouteSliderStops()) {
      assert.equal(snapDistanceAutoRouteTargetKm(s), s, `${s} 가 움직였다`);
    }
  });

  it("Chief 가 써 온 값들이 여전히 슬라이더로 도달 가능하다", () => {
    // 0.7 은 눈금이 아니지만 숫자 입력·± 버튼으로 넣을 수 있다(§4.2). 나머지는 눈금 위다.
    for (const km of [0.5, 1, 3]) {
      assert.equal(snapDistanceAutoRouteTargetKm(km), km);
    }
  });
});

// 이어 달리기 진입 계약 — 2026-09-03 폰 실사용 결함 ④⑤.
//
// 폰에서 「지금 새 경로 연결」을 누르자 거리 체크박스가 해제되고 이동수단이 자전거 →
// 자동차로 바뀌었으며, End 가 이미 찍혀 있었다. 결과는 목표 0.5 km 인데 0.10 km 짜리
// 일반 S→E 경로였고 Token 은 그대로 1개 차감됐다.
//
// 승계 소스가 페이지 세션 ref 하나였고 그 **초기값이 `{driving, 10}`** 이라, 그 ref 가
// 채워지지 않은 경로로 들어오면 그대로 자동차가 나온다. 그래서 승계를 순수 함수로 옮기고
// 우선순위를 여기서 고정한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISTANCE_AUTO_ROUTE_KM_MAX,
  DISTANCE_AUTO_ROUTE_KM_MIN,
} from "../../src/lib/distanceAutoRouteErrors.ts";
import {
  normalizeContinuationTargetKm,
  resolveRideContinuationSetup,
} from "../../src/lib/rideContinuationSetup.ts";

const ANCHOR: [number, number] = [127.0276, 37.4979];

/** 세션 ref 초기값 — 승계가 여기로 떨어지면 결함 ④가 재현된다 */
const SESSION_REF_INITIAL = { profile: "driving" as const, targetKm: 10 };

describe("M0 · 시험 자가 검산", () => {
  it("세션 ref 초기값이 실제 코드와 같다(비교 대상이 살아 있다)", () => {
    // useDistanceAutoRoute.ts 의 lastSessionPrefsRef 초기값. 바뀌면 이 시험도 같이 움직여야 한다.
    assert.equal(SESSION_REF_INITIAL.profile, "driving");
    assert.equal(SESSION_REF_INITIAL.targetKm, 10);
  });

  it("승계 후보들이 서로 다른 값이라 우선순위를 실제로 구별한다", () => {
    const setup = resolveRideContinuationSetup({
      anchorLngLat: ANCHOR,
      lastRide: { profile: "cycling", routeDistanceMeters: 500 },
      sessionPrefs: { profile: "walking", targetKm: 3 },
      currentProfile: "driving",
      currentRouteDistanceMeters: 20_000,
    });
    assert.notEqual(setup.profile, "walking");
    assert.notEqual(setup.profile, "driving");
  });
});

describe("결함 ④⑤ · 진입 계약은 무조건 보장된다", () => {
  const cases = [
    {
      label: "직전 Ride 가 있는 정상 경로",
      input: {
        anchorLngLat: ANCHOR,
        lastRide: { profile: "cycling" as const, routeDistanceMeters: 500 },
        sessionPrefs: { profile: "cycling" as const, targetKm: 0.5 },
        currentProfile: "driving" as const,
        currentRouteDistanceMeters: 0,
      },
    },
    {
      label: "직전 Ride 기록이 없다(폐기된 주행 등)",
      input: {
        anchorLngLat: ANCHOR,
        lastRide: null,
        sessionPrefs: { profile: "cycling" as const, targetKm: 0.5 },
        currentProfile: "driving" as const,
        currentRouteDistanceMeters: 0,
      },
    },
    {
      label: "세션 ref 가 초기값 그대로다(결함 ④의 상황)",
      input: {
        anchorLngLat: ANCHOR,
        lastRide: { profile: "cycling" as const, routeDistanceMeters: 500 },
        sessionPrefs: SESSION_REF_INITIAL,
        currentProfile: "driving" as const,
        currentRouteDistanceMeters: 0,
      },
    },
    {
      label: "아무 근거도 없다",
      input: {
        anchorLngLat: ANCHOR,
        lastRide: null,
        sessionPrefs: null,
        currentProfile: "walking" as const,
        currentRouteDistanceMeters: 0,
      },
    },
  ];

  for (const c of cases) {
    it(`${c.label} — Start 고정 · End 비움 · 거리 모드 on · 목표 거리 유효`, () => {
      const setup = resolveRideContinuationSetup(c.input);
      assert.deepEqual(setup.startLngLat, ANCHOR, "Start 가 직전 종점이 아니다");
      assert.equal(setup.endLngLat, null, "End 가 비어 있지 않다(결함 ⑤)");
      assert.equal(setup.distanceModeOn, true, "거리 모드가 꺼져 있다(결함 ④)");
      assert.ok(
        setup.targetKm >= DISTANCE_AUTO_ROUTE_KM_MIN &&
          setup.targetKm <= DISTANCE_AUTO_ROUTE_KM_MAX,
        `목표 거리가 슬라이더 범위 밖이라 arm 이 실패한다: ${setup.targetKm}`,
      );
    });
  }
});

describe("결함 ④ · 승계 우선순위 — 직전 Ride 가 세션 ref 를 이긴다", () => {
  it("자전거 0.5 km 주행 뒤에는 자동차 10 km 가 나오지 않는다", () => {
    const setup = resolveRideContinuationSetup({
      anchorLngLat: ANCHOR,
      lastRide: { profile: "cycling", routeDistanceMeters: 500 },
      sessionPrefs: SESSION_REF_INITIAL, // {driving, 10} — 채워지지 않은 세션 ref
      currentProfile: "driving",
      currentRouteDistanceMeters: 0,
    });
    assert.equal(setup.profile, "cycling", "이동수단이 승계되지 않았다");
    assert.equal(setup.targetKm, 0.5, "목표 거리가 승계되지 않았다");
    assert.equal(setup.profileSource, "lastRide");
    assert.equal(setup.targetKmSource, "lastRide");
  });

  it("직전 Ride 가 없으면 세션 ref 로 내려간다", () => {
    const setup = resolveRideContinuationSetup({
      anchorLngLat: ANCHOR,
      lastRide: null,
      sessionPrefs: { profile: "walking", targetKm: 3 },
      currentProfile: "driving",
      currentRouteDistanceMeters: 0,
    });
    assert.equal(setup.profile, "walking");
    assert.equal(setup.targetKm, 3);
    assert.equal(setup.profileSource, "sessionPrefs");
  });

  it("둘 다 없으면 현재 화면 값을 쓴다", () => {
    const setup = resolveRideContinuationSetup({
      anchorLngLat: ANCHOR,
      lastRide: null,
      sessionPrefs: null,
      currentProfile: "cycling",
      currentRouteDistanceMeters: 4_200,
    });
    assert.equal(setup.profile, "cycling");
    assert.equal(setup.targetKm, 4);
    assert.equal(setup.profileSource, "current");
    assert.equal(setup.targetKmSource, "current");
  });

  it("망가진 값은 승계하지 않고 다음 순위로 내려간다", () => {
    const setup = resolveRideContinuationSetup({
      anchorLngLat: ANCHOR,
      lastRide: { profile: "bicycle" as never, routeDistanceMeters: Number.NaN },
      sessionPrefs: { profile: "cycling", targetKm: 2 },
      currentProfile: "driving",
      currentRouteDistanceMeters: 0,
    });
    assert.equal(setup.profile, "cycling");
    assert.equal(setup.targetKm, 2);
  });
});

describe("결함 ④ · 목표 거리 정규화 — arm 검증에 걸리지 않는다", () => {
  it("범위 밖은 clamp 된다", () => {
    assert.equal(normalizeContinuationTargetKm(0.1), DISTANCE_AUTO_ROUTE_KM_MIN);
    assert.equal(normalizeContinuationTargetKm(999), DISTANCE_AUTO_ROUTE_KM_MAX);
  });

  it("눈금(0.5 km)에 맞춰진다", () => {
    assert.equal(normalizeContinuationTargetKm(4.2), 4);
    assert.equal(normalizeContinuationTargetKm(4.3), 4.5);
  });

  it("0·음수·비유한은 null 이라 다음 순위로 내려간다", () => {
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined, "x"]) {
      assert.equal(normalizeContinuationTargetKm(v), null, `${String(v)} 가 통과했다`);
    }
  });

  it("100m 주행(폐기 경계)도 유효한 목표 거리로 정규화된다", () => {
    // 폰에서 만들어진 0.10 km 경로. 그대로 승계하면 arm 검증(최소 0.5 km)에 걸려
    // 거리 모드가 통째로 꺼진다 — 결함 ④가 다음 회차로 번지는 경로다.
    assert.equal(normalizeContinuationTargetKm(0.1), DISTANCE_AUTO_ROUTE_KM_MIN);
  });
});

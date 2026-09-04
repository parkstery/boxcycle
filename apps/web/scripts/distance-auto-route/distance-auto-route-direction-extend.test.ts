// 방향 확장 계약 — 5A-R1 §3.1·§3.2.
//
// 클릭 지점이 목표보다 가까울 때 부족분을 **옆으로 도는 우회**로 채우면 같은 도로를
// 되밟아 정복을 잃는다(5A-1 실측: detoured 평균 3.7 % · 최대 17.1 % 중복).
// 대신 **같은 방위로 더 멀리** 잡는다. 확장 거리는 고정값이 아니라 그 방위에서 실제로 잰
// λ̂ = 도로거리/직선거리 에서 유도한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLICK_SNAP_FAIL_M,
  DETOUR_CALL_BUDGET,
  DIRECTION_EXTEND_MAX_ATTEMPTS,
  getDistanceMeters,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  resolveDirectionExtendStraightMeters,
  searchDistanceAutoRoute,
  type DirectionsRouteLike,
  type FetchDirectionsFn,
  type LngLat,
} from "../../../../functions/src/distanceAutoRouteCore.ts";

const START: LngLat = [127.0347, 37.5051];
const D = 700;

describe("M0 · 시험 자가 검산", () => {
  it("λ̂ 가 서로 다른 두 경우를 실제로 구별한다", () => {
    const straight = resolveDirectionExtendStraightMeters({
      straightM: 400,
      directRoadM: 400, // λ̂ = 1.0
      targetDistanceMeters: D,
    });
    const winding = resolveDirectionExtendStraightMeters({
      straightM: 400,
      directRoadM: 560, // λ̂ = 1.4
      targetDistanceMeters: D,
    });
    assert.ok(straight != null && winding != null);
    assert.notEqual(straight, winding, "λ̂ 가 결과에 반영되지 않는다(고정값을 쓴 것)");
  });

  it("우회 예산 상수가 살아 있다", () => {
    assert.equal(DIRECTION_EXTEND_MAX_ATTEMPTS, 2);
    assert.equal(DETOUR_CALL_BUDGET, 12, "provider 예산을 늘리면 안 된다");
  });
});

describe("§3.1 · 확장 거리는 실측 λ̂ 에서 유도한다", () => {
  it("곧은 방향(λ̂ = 1.0)은 부족분만큼만 늘린다", () => {
    // 직선 400m · 도로 400m · 목표 700m → 부족 300m, λ̂ = 1.0 → 직선 700m 지점
    const r = resolveDirectionExtendStraightMeters({
      straightM: 400,
      directRoadM: 400,
      targetDistanceMeters: D,
    });
    assert.ok(Math.abs(r! - 700) < 1e-9, `${r}`);
  });

  it("구불구불한 방향(λ̂ = 1.4)은 덜 늘린다 — 도로로 가면 더 길어지므로", () => {
    // 직선 400m · 도로 560m · 목표 700m → 부족 140m, λ̂ = 1.4 → 100m 만 더 → 직선 500m
    const r = resolveDirectionExtendStraightMeters({
      straightM: 400,
      directRoadM: 560,
      targetDistanceMeters: D,
    });
    assert.ok(Math.abs(r! - 500) < 1e-9, `${r}`);
  });

  it("고정값이 아니다 — λ̂ 가 커질수록 확장이 줄어든다(단조)", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (const roadM of [400, 450, 500, 560, 650]) {
      const r = resolveDirectionExtendStraightMeters({
        straightM: 400,
        directRoadM: roadM,
        targetDistanceMeters: D,
      })!;
      assert.ok(r < prev, `λ̂ 가 커졌는데 확장이 안 줄었다: ${r} vs ${prev}`);
      prev = r;
    }
  });

  it("이미 목표를 채웠으면(deficit ≤ 0) 확장하지 않는다", () => {
    assert.equal(
      resolveDirectionExtendStraightMeters({ straightM: 400, directRoadM: 700, targetDistanceMeters: D }),
      null,
    );
    assert.equal(
      resolveDirectionExtendStraightMeters({ straightM: 400, directRoadM: 900, targetDistanceMeters: D }),
      null,
    );
  });

  it("퇴화 입력은 null — straightM 0 이 무한대 확장을 만들지 않는다", () => {
    for (const bad of [
      { straightM: 0, directRoadM: 400, targetDistanceMeters: D },
      { straightM: -10, directRoadM: 400, targetDistanceMeters: D },
      { straightM: Number.NaN, directRoadM: 400, targetDistanceMeters: D },
      { straightM: 400, directRoadM: 0, targetDistanceMeters: D },
      { straightM: 400, directRoadM: Number.NaN, targetDistanceMeters: D },
      { straightM: 400, directRoadM: 400, targetDistanceMeters: 0 },
    ]) {
      assert.equal(resolveDirectionExtendStraightMeters(bad), null, JSON.stringify(bad));
    }
  });

  it("도로가 직선보다 짧게 보고돼도(snap 오차) λ̂ 는 1 아래로 내려가지 않는다", () => {
    // λ̂ < 1 을 그대로 쓰면 확장이 과도해진다.
    const r = resolveDirectionExtendStraightMeters({
      straightM: 400,
      directRoadM: 380, // λ̂ = 0.95
      targetDistanceMeters: D,
    })!;
    assert.ok(Math.abs(r - (400 + 320)) < 1e-9, `λ̂ 바닥이 안 걸렸다: ${r}`);
  });
});

// ── 3단계 폴백 fixture (§3.2) ──────────────────────────────────
/** 지정 길이의 직선 route — 요청 길이 이상으로 수렴시킨다 */
function straightRoute(from: LngLat, bearing: number, meters: number): DirectionsRouteLike {
  const build = (step: number) => {
    const coords: LngLat[] = [from];
    let cur = from;
    for (let i = 0; i < 20; i += 1) {
      cur = offsetLngLatByBearingMeters(cur, bearing, step);
      coords.push(cur);
    }
    return { type: "LineString" as const, coordinates: coords };
  };
  let step = meters / 20;
  let g = build(step);
  for (let i = 0; i < 4; i += 1) {
    const len = lineStringLengthMeters(g);
    if (len >= meters) break;
    step *= (meters / len) * (1 + 1e-12);
    g = build(step);
  }
  return {
    geometry: g,
    distance: lineStringLengthMeters(g),
    duration: 120,
    snappedEnd: g.coordinates[g.coordinates.length - 1]!,
    endSnapDistanceMeters: 0,
  };
}

/** 클릭 지점에서 끝나는 우회 route — START → 북쪽 정점 → 클릭점, 총 길이 `meters` */
function detourRoute(from: LngLat, click: LngLat, meters: number): DirectionsRouteLike {
  const build = (apexM: number) => ({
    type: "LineString" as const,
    coordinates: [from, offsetLngLatByBearingMeters(from, 0, apexM), click],
  });
  let lo = 0;
  let hi = meters;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (lineStringLengthMeters(build(mid)) < meters) lo = mid;
    else hi = mid;
  }
  const g = build(hi);
  return {
    geometry: g,
    distance: lineStringLengthMeters(g),
    duration: 200,
    snappedEnd: click,
    endSnapDistanceMeters: 0,
  };
}

describe("§3.2 · 3단계 폴백 — ① 확장 → ② 우회 → ③ shortfall", () => {
  const CLICK = offsetLngLatByBearingMeters(START, 90, 400);

  it("① 확장이 되면 extended 로 끝난다 — 우회를 돌지 않는다", async () => {
    let detourWaypointCalls = 0;
    const fetchDirections: FetchDirectionsFn = async (_p, waypoints) => {
      if (waypoints.length === 3) detourWaypointCalls += 1;
      const end = waypoints[waypoints.length - 1]!;
      // 직선거리 그대로가 도로거리(λ̂ = 1.0)
      return straightRoute(START, 90, getDistanceMeters(START, end));
    };

    const r = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: CLICK,
      profile: "driving",
      targetDistanceMeters: D,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(r.status, "found");
    if (r.status !== "found") return;
    assert.equal(r.outcome, "extended", `outcome 이 ${r.outcome}`);
    assert.equal(detourWaypointCalls, 0, "확장으로 됐는데 우회를 돌았다");
    assert.ok(Math.abs(r.distance - D) <= 5, `거리 계약 위반: ${r.distance}`);
    // Stage 0 1회 + 확장 최대 2회. 우회 예산(12)과 비교하면 압도적으로 적다.
    assert.ok(
      r.diagnostics.providerCallCount <= 1 + DIRECTION_EXTEND_MAX_ATTEMPTS,
      `호출 ${r.diagnostics.providerCallCount}회`,
    );
  });

  it("② 확장 지점에 도로가 없으면 우회로 내려간다", async () => {
    let detourWaypointCalls = 0;
    const fetchDirections: FetchDirectionsFn = async (_p, waypoints) => {
      const end = waypoints[waypoints.length - 1]!;
      if (waypoints.length === 3) {
        detourWaypointCalls += 1;
        // 우회는 **클릭 지점에서 끝난다**. 지나쳐 끝나면 endMiss > 200m 로
        // offered 강등 게이트에 걸려 우회 시험이 아니라 강등 시험이 된다.
        return detourRoute(START, CLICK, D + 20);
      }
      const straightM = getDistanceMeters(START, end);
      const route = straightRoute(START, 90, straightM);
      // 클릭보다 먼 지점 = 확장 시도 → snap 실패로 버려지게 한다
      if (straightM > 450) {
        return { ...route, endSnapDistanceMeters: CLICK_SNAP_FAIL_M + 1 };
      }
      return route;
    };

    const r = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: CLICK,
      profile: "driving",
      targetDistanceMeters: D,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(r.status, "found");
    if (r.status !== "found") return;
    assert.ok(detourWaypointCalls > 0, "우회 폴백이 돌지 않았다");
    assert.equal(r.outcome, "detoured", `outcome 이 ${r.outcome}`);
  });

  it("③ 확장도 우회도 안 되면 shortfall 로 고지한다", async () => {
    const fetchDirections: FetchDirectionsFn = async (_p, waypoints) => {
      const end = waypoints[waypoints.length - 1]!;
      if (waypoints.length === 3) {
        // 우회를 아무리 늘려도 목표에 못 미친다
        return detourRoute(START, CLICK, 450);
      }
      const straightM = getDistanceMeters(START, end);
      const route = straightRoute(START, 90, Math.min(450, straightM));
      if (straightM > 450) return { ...route, endSnapDistanceMeters: CLICK_SNAP_FAIL_M + 1 };
      return route;
    };

    const r = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: CLICK,
      profile: "driving",
      targetDistanceMeters: D,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(r.status, "found");
    if (r.status !== "found") return;
    assert.equal(r.outcome, "shortfall", `outcome 이 ${r.outcome}`);
    assert.ok(r.distance < D, "shortfall 인데 목표를 채웠다");
  });

  it("확장은 provider 예산을 넘기지 않는다", async () => {
    // 확장이 계속 모자라도 시도는 2회로 끝난다.
    let calls = 0;
    const fetchDirections: FetchDirectionsFn = async (_p, waypoints) => {
      calls += 1;
      const end = waypoints[waypoints.length - 1]!;
      return straightRoute(START, 90, Math.min(500, getDistanceMeters(START, end)));
    };

    const r = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: CLICK,
      profile: "driving",
      targetDistanceMeters: D,
      bearingDeg: 90,
      fetchDirections,
    });
    assert.equal(r.status, "found");
    if (r.status !== "found") return;
    assert.ok(
      r.diagnostics.providerCallCount <= DETOUR_CALL_BUDGET + 1,
      `예산 초과: ${r.diagnostics.providerCallCount}회`,
    );
    assert.ok(calls <= DETOUR_CALL_BUDGET + 1);
  });
});

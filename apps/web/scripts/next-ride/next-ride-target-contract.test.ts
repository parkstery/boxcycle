// 다음 주행 후보 해석 계약(RIDE-CONTINUE-1 §7.1) — 「앱이 마지막 유효 Ride 에서
// 다음 행동을 제시한다」를 순수 함수로 고정한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveNextRideTarget,
  resolveRecentRideActions,
  resumeAnchorForRoute,
} from "../../src/lib/nextRideTarget.ts";
import type { SavedRoute } from "../../src/lib/firestoreSavedRoutes.ts";
import type { StoredRideSession } from "../../src/lib/rideSessionsStorage.ts";
import {
  distanceOnRouteByProjectedPoint,
  lineStringLengthMeters,
  type LineStringGeometry,
} from "../../src/lib/geo.ts";

function makeGeometry(points = 11): LineStringGeometry {
  const coords: [number, number][] = [];
  for (let i = 0; i < points; i += 1) coords.push([127.0 + i * 0.001, 37.5]);
  return { type: "LineString", coordinates: coords };
}

const GEOMETRY = makeGeometry();
const GEO_LEN = lineStringLengthMeters(GEOMETRY);

function makeRoute(over: Partial<SavedRoute> = {}): SavedRoute {
  return {
    id: "route-1",
    name: "한강 북단",
    profile: "cycling",
    startLngLat: GEOMETRY.coordinates[0],
    endLngLat: GEOMETRY.coordinates[GEOMETRY.coordinates.length - 1],
    waypoints: [],
    geometry: GEOMETRY,
    distanceMeters: GEO_LEN,
    durationSec: 600,
    createdAtIso: "2026-08-01T00:00:00.000Z",
    updatedAtIso: "2026-08-01T00:00:00.000Z",
    completed: 0,
    completedAtIso: null,
    expiresAtIso: null,
    lastRideId: null,
    lastProgressRatio: 0.31,
    ...over,
  };
}

function makeRide(over: Partial<StoredRideSession> = {}): StoredRideSession {
  return {
    id: "ride-1",
    endedAt: "2026-08-29T10:00:00.000Z",
    elapsedSec: 600,
    distanceMeters: 5200,
    avgSpeedKmh: 31,
    caloriesEstimate: 156,
    routeDistanceMeters: GEO_LEN,
    routeDurationSec: 600,
    userRouteId: "route-1",
    routeName: "한강 북단",
    completionRatio: 0.31,
    sessionEndLngLat: [127.005, 37.5],
    ...over,
  };
}

describe("M0 · 시험 fixture 자가 검산", () => {
  it("경로 전장이 유의미하다", () => {
    assert.ok(GEO_LEN > 500, `전장이 너무 짧다: ${GEO_LEN}`);
  });
});

describe("resolveNextRideTarget", () => {
  it("최근 Ride 가 없으면 후보 없음", () => {
    assert.equal(resolveNextRideTarget({ rides: [], savedRoutes: [makeRoute()] }), null);
  });

  it("본인 미완주 SavedRoute 와 연결되면 resume_route", () => {
    const t = resolveNextRideTarget({ rides: [makeRide()], savedRoutes: [makeRoute()] });
    assert.equal(t?.kind, "resume_route");
    assert.equal(t?.kind === "resume_route" ? t.routeId : null, "route-1");
    assert.ok(t?.kind === "resume_route" && Math.abs(t.progressRatio - 0.31) < 1e-9);
  });

  it("완주된 SavedRoute 면 extend_from_ride", () => {
    const t = resolveNextRideTarget({
      rides: [makeRide()],
      savedRoutes: [makeRoute({ completed: 1, lastProgressRatio: 1 })],
    });
    assert.equal(t?.kind, "extend_from_ride");
  });

  it("최대 진행률 43% Route 를 처음부터 타고 20% 에서 끝내도 재개점은 43%", () => {
    // 재개 위치의 진실은 SavedRoute 의 lastProgressRatio 이지 Ride 종료 좌표가 아니다.
    const route = makeRoute({ lastProgressRatio: 0.43 });
    const ride = makeRide({ completionRatio: 0.2, sessionEndLngLat: [127.002, 37.5] });
    const t = resolveNextRideTarget({ rides: [ride], savedRoutes: [route] });
    assert.equal(t?.kind, "resume_route");
    const measured = distanceOnRouteByProjectedPoint(
      GEOMETRY,
      (t as { anchorLngLat: [number, number] }).anchorLngLat,
    );
    assert.ok(
      measured != null && Math.abs(measured - GEO_LEN * 0.43) < 1,
      `재개점이 43% 가 아니다: ${measured}`,
    );
  });

  it("Route 가 삭제됐어도 실제 종료 좌표가 있으면 extend_from_ride", () => {
    const t = resolveNextRideTarget({ rides: [makeRide()], savedRoutes: [] });
    assert.equal(t?.kind, "extend_from_ride");
    assert.deepEqual(t?.kind === "extend_from_ride" ? t.anchorLngLat : null, [127.005, 37.5]);
  });

  it("좌표도 Route 도 없으면 후보 없음(legacy Ride)", () => {
    const legacy = makeRide({ userRouteId: null, sessionEndLngLat: undefined });
    assert.equal(resolveNextRideTarget({ rides: [legacy], savedRoutes: [] }), null);
  });

  it("폐기 대상 Ride(100m·5초 이하)는 건너뛴다", () => {
    const discard = makeRide({ id: "ride-discard", distanceMeters: 50, elapsedSec: 3 });
    assert.equal(resolveNextRideTarget({ rides: [discard], savedRoutes: [] }), null);
  });

  it("95~97% 는 98% 정책상 미완주 — resume_route 로 남는다", () => {
    const t = resolveNextRideTarget({
      rides: [makeRide({ completionRatio: 0.96 })],
      savedRoutes: [makeRoute({ lastProgressRatio: 0.96 })],
    });
    assert.equal(t?.kind, "resume_route");
  });

  it("98% 이상 진행률은 재개 후보가 아니다", () => {
    const t = resolveNextRideTarget({
      rides: [makeRide()],
      savedRoutes: [makeRoute({ lastProgressRatio: 0.99 })],
    });
    assert.equal(t?.kind, "extend_from_ride");
  });

  it("입력이 정렬되지 않아도 endedAt 최신 Ride 를 고른다", () => {
    const older = makeRide({
      id: "ride-old",
      endedAt: "2026-08-20T10:00:00.000Z",
      sessionEndLngLat: [127.001, 37.5],
      userRouteId: null,
    });
    const newer = makeRide({
      id: "ride-new",
      endedAt: "2026-08-29T10:00:00.000Z",
      sessionEndLngLat: [127.008, 37.5],
      userRouteId: null,
    });
    const t = resolveNextRideTarget({ rides: [older, newer], savedRoutes: [] });
    assert.equal(t?.rideId, "ride-new");
  });
});

describe("resumeAnchorForRoute", () => {
  it("진행률 0 이면 경로 시작점", () => {
    const anchor = resumeAnchorForRoute(makeRoute({ lastProgressRatio: 0 }));
    assert.ok(anchor);
    const measured = distanceOnRouteByProjectedPoint(GEOMETRY, anchor!);
    assert.ok(measured != null && measured < 1);
  });
});

describe("resolveRecentRideActions", () => {
  it("legacy Ride 는 어떤 CTA 도 만들지 않는다", () => {
    const actions = resolveRecentRideActions(
      makeRide({ userRouteId: null, sessionEndLngLat: undefined }),
      [],
    );
    assert.equal(actions.canShowOnMap, false);
    assert.equal(actions.resumeRouteId, null);
    assert.equal(actions.extendAnchor, null);
  });

  it("[0,0] 같은 잘못된 좌표는 통과시키되 범위 밖 좌표는 거른다", () => {
    const bad = resolveRecentRideActions(
      makeRide({ sessionEndLngLat: [999, 999] as [number, number] }),
      [],
    );
    assert.equal(bad.extendAnchor, null);
  });

  it("미완주 소유 Route 면 이어 달리기와 새 경로가 모두 가능하다", () => {
    const actions = resolveRecentRideActions(makeRide(), [makeRoute()]);
    assert.equal(actions.resumeRouteId, "route-1");
    assert.ok(actions.extendAnchor);
    assert.equal(actions.canShowOnMap, true);
  });
});

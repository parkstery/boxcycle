import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  AUTO_ROUTE_ALGORITHM_VERSION,
  CLICK_SNAP_FAIL_M,
  DIRECT_ROAD_EXCESS_TOLERANCE_M,
  END_MISS_DEMOTE_TO_OFFERED_M,
  computeAutoRouteClickDiagnostics,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  parseDirectionsSnapMetadata,
  searchDistanceAutoRoute,
  type FetchDirectionsFn,
} from "../../../../functions/src/distanceAutoRouteCore.ts";
import {
  formatDistanceAutoRouteClickDebugCoords,
} from "../../src/lib/distanceAutoRouteClickDebugMarker.ts";
const HOOK_SOURCE = readFileSync(
  new URL("../../src/hooks/useDistanceAutoRoute.ts", import.meta.url),
  "utf8",
);
const API_SOURCE = readFileSync(
  new URL("../../src/services/distanceAutoRouteApi.ts", import.meta.url),
  "utf8",
);
const HTTP_SOURCE = readFileSync(
  new URL("../../../../functions/src/distanceAutoRouteHttp.ts", import.meta.url),
  "utf8",
);
const CORE_SOURCE = readFileSync(
  new URL("../../../../functions/src/distanceAutoRouteCore.ts", import.meta.url),
  "utf8",
);
const TOKEN_CONTRACT_SOURCE = readFileSync(
  new URL("../route-token/distance-auto-route-token-contract.mjs", import.meta.url),
  "utf8",
);

describe("distanceAutoRoute click intent 3F-C-R1", () => {
  it("API·hook이 targetRoadPoint를 전달", () => {
    assert.match(API_SOURCE, /targetRoadPoint: LngLat/);
    assert.match(HOOK_SOURCE, /targetRoadPoint: lngLat/);
  });

  it("서버 parse·cache·응답에 targetRoadPoint·algorithmVersion·endMissMeters", () => {
    assert.match(HTTP_SOURCE, /targetRoadPoint: LngLat/);
    assert.match(HTTP_SOURCE, /targetRoadPoint 는 \[lng,lat\]/);
    assert.match(HTTP_SOURCE, /bearingFromOriginToPoint\(start, targetRoadPoint\)/);
    assert.match(HTTP_SOURCE, /algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION/);
    assert.match(HTTP_SOURCE, /endMissMeters: diagnostics\.rawClickMissMeters/);
    assert.match(HTTP_SOURCE, /targetRoadPoint,/);
    assert.match(TOKEN_CONTRACT_SOURCE, /targetRoadPoint: \[127\.07668, 37\.5\]/);
  });

  it("서버 응답에 outcome·directRoadMeters·detourCalls 포함", () => {
    assert.match(HTTP_SOURCE, /outcome/);
    assert.match(HTTP_SOURCE, /directRoadMeters/);
    assert.match(HTTP_SOURCE, /detourCalls/);
    // `distanceAdjustRetry` 는 5A-R2 §3 으로 제거됐다 — 재탐색 기능 자체가 없어졌다.
    assert.doesNotMatch(HTTP_SOURCE, /distanceAdjustRetry/);
  });

  it("알고리즘 버전이 3I-shortfall", () => {
    assert.equal(AUTO_ROUTE_ALGORITHM_VERSION, "3I-shortfall");
  });

  it("3F-C-R1 핵심 상수 값 확인", () => {
    assert.equal(CLICK_SNAP_FAIL_M, 250);
    assert.equal(DIRECT_ROAD_EXCESS_TOLERANCE_M, 150);
    assert.equal(END_MISS_DEMOTE_TO_OFFERED_M, 200);
  });

  it("snapped click 지표는 provider snap 없으면 null", () => {
    const diagnostics = computeAutoRouteClickDiagnostics({
      start: [127.02, 37.5],
      targetRoadPoint: [127.07, 37.5],
      clippedEnd: [127.065, 37.5],
      targetDistanceMeters: 5000,
      clippedDistanceMeters: 5000,
      providerCallCount: 12,
      searchElapsedMs: 340,
    });
    assert.equal(diagnostics.snappedClickMissMeters, null);
    assert.equal(diagnostics.clickSnapMeters, null);
    assert.ok(diagnostics.rawClickMissMeters >= 0);
    assert.equal(diagnostics.providerCallCount, 12);
  });

  it("DirectionsRouteLike가 snappedEnd·endSnapDistanceMeters를 파싱", () => {
    const meta = parseDirectionsSnapMetadata({
      geometry: { type: "LineString", coordinates: [[127, 37], [127.01, 37]] },
      distance: 1000,
      duration: 200,
      snappedEnd: [127.01, 37.0001],
      endSnapDistanceMeters: 12.5,
    });
    assert.ok(meta);
    assert.equal(meta?.endSnapDistanceMeters, 12.5);
    assert.equal(parseDirectionsSnapMetadata({
      geometry: { type: "LineString", coordinates: [[127, 37], [127.01, 37]] },
      distance: 1000,
      duration: 200,
    }), null);
  });

  it("첫 provider endpoint는 targetRoadPoint(direct Stage 0)", async () => {
    const start: [number, number] = [127.02, 37.5];
    const targetDistanceMeters = 5000;
    // D+50m = 5050m ∈ [D, D+150] → exact
    const exactEnd = offsetLngLatByBearingMeters(start, 90, 5050);
    const targetRoadPoint: [number, number] = [exactEnd[0], exactEnd[1]];
    let firstWaypoints: [number, number][] | null = null;
    const fetchDirections: FetchDirectionsFn = async (_profile, waypoints) => {
      if (firstWaypoints == null) firstWaypoints = waypoints as [number, number][];
      const end = waypoints[waypoints.length - 1]!;
      // Build geometry of exactly 5050m so clip at 5000m succeeds
      const farEnd = offsetLngLatByBearingMeters(waypoints[0]!, 90, 5050);
      const geometry = {
        type: "LineString" as const,
        coordinates: [waypoints[0]!, farEnd] as [number, number][],
      };
      return {
        geometry,
        distance: lineStringLengthMeters(geometry),
        duration: 1200,
        snappedEnd: end,
        endSnapDistanceMeters: 0,
      };
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "cycling",
      targetDistanceMeters,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.ok(firstWaypoints);
    assert.deepEqual(firstWaypoints![0], start);
    assert.deepEqual(firstWaypoints![firstWaypoints!.length - 1], targetRoadPoint);
    assert.equal(searched.status, "found");
    if (searched.status === "found") {
      assert.equal(searched.diagnostics.providerCallCount, 1);
      assert.equal(searched.outcome, "exact");
    }
  });

  it("clickSnapM > 250m → 유일한 실패, provider 1회", async () => {
    const start: [number, number] = [127.02, 37.5];
    const targetRoadPoint: [number, number] = [127.07668, 37.5];
    const targetDistanceMeters = 1000;
    let calls = 0;
    const fetchDirections: FetchDirectionsFn = async (_profile, waypoints) => {
      calls += 1;
      const end = waypoints[waypoints.length - 1]!;
      const geometry = {
        type: "LineString" as const,
        coordinates: [waypoints[0]!, end] as [number, number][],
      };
      return {
        geometry,
        distance: targetDistanceMeters * 1.05,
        duration: 1200,
        snappedEnd: end,
        endSnapDistanceMeters: 300, // > CLICK_SNAP_FAIL_M=250
      };
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "cycling",
      targetDistanceMeters,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "failed");
    assert.equal(calls, 1);
    if (searched.status === "failed") {
      assert.equal(searched.providerCallCount, 1);
    }
  });

  it("road > D+150 → offered, provider 정확히 1회, 우회 없음", async () => {
    const start: [number, number] = [127.02, 37.5];
    const targetRoadPoint: [number, number] = [127.03, 37.5];
    const targetDistanceMeters = 1000;
    let calls = 0;
    const fetchDirections: FetchDirectionsFn = async (_profile, waypoints) => {
      calls += 1;
      const end = waypoints[waypoints.length - 1]!;
      // Build 1300m geometry (consistent distance)
      const farEnd = offsetLngLatByBearingMeters(waypoints[0]!, 90, 1300);
      const geometry = {
        type: "LineString" as const,
        coordinates: [waypoints[0]!, farEnd] as [number, number][],
      };
      const dist = lineStringLengthMeters(geometry);
      return { geometry, distance: dist, duration: 1200, snappedEnd: end, endSnapDistanceMeters: 0 };
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "driving",
      targetDistanceMeters,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(calls, 1);
    assert.equal(searched.status, "found");
    if (searched.status === "found") {
      assert.equal(searched.outcome, "offered");
      assert.ok(searched.directRoadMeters > 1000 + 150);
      assert.equal(searched.detourCalls, 0);
    }
  });

  // 5A-R2 §1 로 계약이 바뀌었다 — `road < D − 5m` 는 **우회로 채우지 않고 안내·실패**시킨다.
  // 우회가 같은 도로를 되밟아 정복을 잃었기 때문이다(5A-1 실측: 최대 17.1 % 중복).
  it("road < D → 안내·실패. 우회(3-waypoint)를 호출하지 않는다", async () => {
    const start: [number, number] = [127.02, 37.5];
    const targetRoadPoint = offsetLngLatByBearingMeters(start, 90, 850) as [number, number];
    const targetDistanceMeters = 1000;
    let twoWaypointCalls = 0;
    let threeWaypointCalls = 0;
    const fetchDirections: FetchDirectionsFn = async (_profile, waypoints) => {
      const end = waypoints[waypoints.length - 1]!;
      if (waypoints.length === 2) twoWaypointCalls += 1;
      else threeWaypointCalls += 1;
      const farEnd = offsetLngLatByBearingMeters(waypoints[0]!, 90, 800);
      const geometry = { type: "LineString" as const, coordinates: [waypoints[0]!, farEnd] as [number, number][] };
      return { geometry, distance: lineStringLengthMeters(geometry), duration: 900, snappedEnd: end, endSnapDistanceMeters: 0 };
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "driving",
      targetDistanceMeters,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "failed");
    if (searched.status !== "failed") return;
    assert.equal(twoWaypointCalls, 1, "Stage 0 한 번이면 충분하다");
    assert.equal(threeWaypointCalls, 0, "우회를 호출했다 — 중복이 다시 생긴다");
    assert.equal(searched.providerCallCount, 1);
    // 문구에 실측값이 들어간다(막연한 「더 멀리」 금지)
    assert.match(searched.message, /0\.8 km/, `문구에 실측 도로거리가 없다: ${searched.message}`);
    assert.match(searched.message, /1\.0 km/, `문구에 목표가 없다: ${searched.message}`);
    assert.match(searched.message, /원 바깥/, "어디를 클릭할지 안내가 없다");
  });

  // 5A-R2 §1: Stage 1 우회는 `road < D` 경로에서 호출되지 않으므로 「Stage 1 throw」가 없다.
  it("provider 호출 수는 Stage 0 throw 를 집계한다", async () => {
    const start: [number, number] = [127.02, 37.5];
    const targetRoadPoint = offsetLngLatByBearingMeters(start, 90, 850) as [number, number];
    const fetchDirections: FetchDirectionsFn = async () => {
      throw new Error("stage0 throw");
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "cycling",
      targetDistanceMeters: 1000,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "failed");
    if (searched.status !== "failed") return;
    assert.equal(searched.providerCallCount, 1, "throw 한 호출이 집계되지 않았다");
  });

  it("hard gate: exact endMiss > 200m → offered 강등", async () => {
    // 우회 없이도 성립한다 — geometry 가 클릭 지점을 크게 지나쳐 끝나면 강등된다.
    const start: [number, number] = [127.02, 37.5];
    const targetRoadPoint = offsetLngLatByBearingMeters(start, 90, 700) as [number, number];
    const targetDistanceMeters = 1000;
    const fetchDirections: FetchDirectionsFn = async (_profile, waypoints) => {
      // 도로거리는 D 이상(=exact 진입)이지만 geometry 는 2km 까지 뻗어 끝점이 멀다
      const farEnd = offsetLngLatByBearingMeters(waypoints[0]!, 90, 2000);
      const geometry = { type: "LineString" as const, coordinates: [waypoints[0]!, farEnd] as [number, number][] };
      return {
        geometry,
        distance: 1100,
        duration: 1200,
        snappedEnd: targetRoadPoint,
        endSnapDistanceMeters: 0,
      };
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "cycling",
      targetDistanceMeters,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "found");
    if (searched.status !== "found") return;
    assert.equal(searched.outcome, "offered", "endMiss 강등 게이트가 죽었다");
    assert.ok(searched.endMissMeters > END_MISS_DEMOTE_TO_OFFERED_M);
  });

  it("3F-C-R1 core source 계약 — 새 함수명 포함", () => {
    assert.match(CORE_SOURCE, /CLICK_SNAP_FAIL_M/);
    assert.match(CORE_SOURCE, /DIRECT_ROAD_EXCESS_TOLERANCE_M/);
    assert.match(CORE_SOURCE, /END_MISS_DEMOTE_TO_OFFERED_M/);
    assert.match(CORE_SOURCE, /DETOUR_CALL_BUDGET/);
    assert.match(CORE_SOURCE, /AutoRouteOutcome/);
    assert.match(CORE_SOURCE, /searchDistanceAutoRoute/);
    assert.match(CORE_SOURCE, /clickRoadPoint/);
    assert.doesNotMatch(CORE_SOURCE, /buildClickAxisEndpoints/);
    assert.doesNotMatch(CORE_SOURCE, /buildClickBearingReachEndpoints/);
    assert.doesNotMatch(CORE_SOURCE, /classifyClickIntentFailureMessage/);
    assert.doesNotMatch(CORE_SOURCE, /pickBestClickIntentRoute/);
    assert.doesNotMatch(CORE_SOURCE, /AUTO_ROUTE_CLICK_ZONE_INNER_RATIO/);
  });

  it("MAX_AUTO_ROUTE_PROVIDER_CALLS=13, DETOUR_CALL_BUDGET=12", () => {
    assert.match(CORE_SOURCE, /MAX_AUTO_ROUTE_PROVIDER_CALLS = 13/);
    assert.match(CORE_SOURCE, /DETOUR_CALL_BUDGET = 12/);
    assert.match(CORE_SOURCE, /shortfall/);
  });

  // 5A-R2 §1: 「우회 예산 소진 → shortfall」 경로는 사라졌다. `road < D` 는 즉시 안내·실패다.
  it("direct < D → 우회 없이 즉시 안내·실패(예산을 쓰지 않는다)", async () => {
    const start: [number, number] = [127.02, 37.5];
    const targetRoadPoint = offsetLngLatByBearingMeters(start, 90, 500) as [number, number];
    let calls = 0;
    const fetchDirections: FetchDirectionsFn = async (_profile, waypoints) => {
      calls += 1;
      const farEnd = offsetLngLatByBearingMeters(waypoints[0]!, 90, 500);
      const geometry = { type: "LineString" as const, coordinates: [waypoints[0]!, farEnd] as [number, number][] };
      return { geometry, distance: lineStringLengthMeters(geometry), duration: 600, snappedEnd: targetRoadPoint, endSnapDistanceMeters: 0 };
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "cycling",
      targetDistanceMeters: 2000,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "failed");
    if (searched.status !== "failed") return;
    assert.equal(calls, 1, `우회 예산을 썼다: ${calls}회`);
    assert.match(searched.message, /0\.5 km/);
    assert.match(searched.message, /2\.0 km/);
  });

});

describe("distanceAutoRoute click debug marker 3F-A-R1 §2.5", () => {
  const MAP_VIEW_SOURCE = readFileSync(
    new URL("../../src/components/map/MapView.tsx", import.meta.url),
    "utf8",
  );
  const MAP_VIEW_CSS = readFileSync(
    new URL("../../src/components/map/MapView.css", import.meta.url),
    "utf8",
  );
  const DEBUG_MARKER_SOURCE = readFileSync(
    new URL("../../src/lib/distanceAutoRouteClickDebugMarker.ts", import.meta.url),
    "utf8",
  );
  const BRIDGE_SOURCE = readFileSync(
    new URL("../../src/lib/distanceAutoRouteMapBridge.ts", import.meta.url),
    "utf8",
  );

  it("원본 클릭 좌표를 소수점 6자리 label·dataset으로 표시", () => {
    const lngLat: [number, number] = [127.020123456, 37.500456789];
    assert.equal(formatDistanceAutoRouteClickDebugCoords(lngLat), "127.020123, 37.500457");
    assert.match(DEBUG_MARKER_SOURCE, /toFixed\(6\)/);
    assert.match(DEBUG_MARKER_SOURCE, /dataset\.clickLng/);
    assert.match(DEBUG_MARKER_SOURCE, /dataset\.clickLat/);
    assert.match(DEBUG_MARKER_SOURCE, /map-view__auto-route-click-debug-label/);
    assert.match(DEBUG_MARKER_SOURCE, /map-view__auto-route-click-debug-marker/);
  });

  it("production gate — DEV에서만 marker 생성", () => {
    assert.match(DEBUG_MARKER_SOURCE, /import\.meta\.env\.DEV/);
    assert.match(MAP_VIEW_SOURCE, /isDistanceAutoRouteClickDebugEnabled/);
    assert.match(MAP_VIEW_SOURCE, /placeAutoRouteClickDebugMarkerRef\.current\(picked\)/);
    const markerCallIndex = MAP_VIEW_SOURCE.indexOf("placeAutoRouteClickDebugMarkerRef.current(picked)");
    const fetchCallIndex = MAP_VIEW_SOURCE.indexOf("onAutoRouteMapPickRef.current(picked)", markerCallIndex);
    assert.ok(markerCallIndex >= 0 && fetchCallIndex > markerCallIndex);
  });

  it("marker·label은 pointer-events none, provider 호출 없음", () => {
    assert.doesNotMatch(DEBUG_MARKER_SOURCE, /fetch\(/);
    assert.match(MAP_VIEW_CSS, /map-view__auto-route-click-debug-marker-host[\s\S]*pointer-events: none/);
    assert.match(MAP_VIEW_CSS, /map-view__auto-route-click-debug-host[\s\S]*pointer-events: none/);
    assert.match(MAP_VIEW_CSS, /map-view__auto-route-click-debug-label[\s\S]*pointer-events: none/);
  });

  it("방향 클릭만 marker 생성·교체, 수동 End·세션 종료 시 제거", () => {
    assert.match(MAP_VIEW_SOURCE, /autoRouteMapPickRef\.current === "direction"/);
    assert.match(MAP_VIEW_SOURCE, /onClearAutoRouteClickDebugMarker/);
    assert.match(MAP_VIEW_SOURCE, /applyDistanceDirectionMode[\s\S]*onClearAutoRouteClickDebugMarker/);
    assert.match(MAP_VIEW_SOURCE, /startBtn\.onclick[\s\S]*onClearAutoRouteClickDebugMarker/);
    assert.match(MAP_VIEW_SOURCE, /clearAutoRouteClickDebugMarkerOnMap\(autoRouteClickDebugMarkerRef\)/);
    assert.match(MAP_VIEW_SOURCE, /registerDistanceAutoRouteClickDebugMarkerClear/);
    assert.match(MAP_VIEW_SOURCE, /clearAutoRouteClickDebugMarkerOnMap\(autoRouteClickDebugMarkerRef\)/);
    assert.match(BRIDGE_SOURCE, /clearDistanceAutoRouteClickDebugMarker/);
    assert.doesNotMatch(
      MAP_VIEW_SOURCE.slice(MAP_VIEW_SOURCE.indexOf("endBtn.onclick"), MAP_VIEW_SOURCE.indexOf("endBtn.onclick") + 400),
      /placeAutoRouteClickDebugMarker/,
    );
  });

  it("기존 marker 위치 교체(update)로 단일 marker 유지", () => {
    assert.match(MAP_VIEW_SOURCE, /if \(markerRef\.current\)/);
    assert.match(MAP_VIEW_SOURCE, /updateDistanceAutoRouteClickDebugMarkerElement/);
  });
});

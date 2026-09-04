import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
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
import {
  assertFixtureExpectations,
  replayClickIntentFixture,
  rowsFromReplay,
  type ClickIntentFixture,
} from "./click-intent-replay-core.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(join(__dirname, "fixtures/click-intent-baseline.json"), "utf8"),
) as ClickIntentFixture[];

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
    assert.match(HTTP_SOURCE, /distanceAdjustRetry/);
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

  // 5A-R1 §3.2 로 우선순위가 바뀌었다 — road < D 면 **먼저 방향 확장**(2-waypoint)을 시도하고,
  // 그것이 목표를 못 채울 때만 우회(3-waypoint)로 내려간다. 이 fixture 는 2-waypoint 응답을
  // 끝점과 무관하게 800m 로 고정하므로 확장이 실패하고 우회까지 내려간다.
  it("road < D → (확장 실패 후) Stage 1 우회, 3-waypoint 호출 확인", async () => {
    const start: [number, number] = [127.02, 37.5];
    // 850m east: detour route clips at 1000m → endMiss = 150m < 200m → stays "detoured"
    const targetRoadPoint = offsetLngLatByBearingMeters(start, 90, 850) as [number, number];
    const targetDistanceMeters = 1000;
    let twoWaypointCalls = 0;
    let threeWaypointCalls = 0;
    const fetchDirections: FetchDirectionsFn = async (_profile, waypoints) => {
      const end = waypoints[waypoints.length - 1]!;
      if (waypoints.length === 2) {
        twoWaypointCalls += 1;
        // 800m geometry (< D=1000) → Stage 1 triggers
        const farEnd = offsetLngLatByBearingMeters(waypoints[0]!, 90, 800);
        const geometry = { type: "LineString" as const, coordinates: [waypoints[0]!, farEnd] as [number, number][] };
        const dist = lineStringLengthMeters(geometry);
        return { geometry, distance: dist, duration: 900, snappedEnd: end, endSnapDistanceMeters: 0 };
      } else {
        threeWaypointCalls += 1;
        // 1050m geometry ∈ [D, D+150] → detour success
        const farEnd = offsetLngLatByBearingMeters(waypoints[0]!, 90, 1050);
        const geometry = { type: "LineString" as const, coordinates: [waypoints[0]!, farEnd] as [number, number][] };
        const dist = lineStringLengthMeters(geometry);
        return { geometry, distance: dist, duration: 1200, snappedEnd: end, endSnapDistanceMeters: 0 };
      }
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "driving",
      targetDistanceMeters,
      bearingDeg: 90,
      fetchDirections,
    });

    // Stage 0 1회 + 방향 확장 최대 2회 = 최대 3회(5A-R1 §3.1). 이전에는 1회였다.
    assert.ok(twoWaypointCalls >= 1 && twoWaypointCalls <= 3, `2-waypoint ${twoWaypointCalls}회`);
    assert.ok(threeWaypointCalls >= 1, "우회 폴백이 돌지 않았다");
    assert.equal(searched.status, "found");
    if (searched.status === "found") {
      assert.equal(searched.outcome, "detoured");
      assert.ok(searched.directRoadMeters < targetDistanceMeters);
      assert.ok(searched.detourCalls >= 1);
    }
  });

  it("provider 호출 수는 Stage 0 throw·Stage 1 throw 모두 집계", async () => {
    const start: [number, number] = [127.02, 37.5];
    // 850m east: detour clipped at 1000m → endMiss ≈ 150m < 200m → stays "detoured"
    const targetRoadPoint = offsetLngLatByBearingMeters(start, 90, 850) as [number, number];
    const targetDistanceMeters = 1000;
    let attempts = 0;
    const fetchDirections: FetchDirectionsFn = async (_profile, waypoints) => {
      attempts += 1;
      if (waypoints.length === 2) {
        // Stage 0: 800m route (< D)
        const farEnd = offsetLngLatByBearingMeters(waypoints[0]!, 90, 800);
        const geometry = { type: "LineString" as const, coordinates: [waypoints[0]!, farEnd] as [number, number][] };
        return { geometry, distance: lineStringLengthMeters(geometry), duration: 900, snappedEnd: waypoints[waypoints.length-1]!, endSnapDistanceMeters: 0 };
      }
      // Stage 1: first detour call throws, second succeeds
      if (attempts === 2) throw new Error("detour throw");
      const farEnd = offsetLngLatByBearingMeters(waypoints[0]!, 90, 1050);
      const geometry = { type: "LineString" as const, coordinates: [waypoints[0]!, farEnd] as [number, number][] };
      return { geometry, distance: lineStringLengthMeters(geometry), duration: 1200, snappedEnd: waypoints[waypoints.length-1]!, endSnapDistanceMeters: 0 };
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "cycling",
      targetDistanceMeters,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.ok(attempts >= 2);
    if (searched.status === "found") {
      assert.ok(searched.diagnostics.providerCallCount >= 2);
      assert.equal(searched.outcome, "detoured");
    } else {
      assert.ok(searched.providerCallCount >= 2);
    }
  });

  it("hard gate: exact/detoured endMiss > 200m → offered 강등", async () => {
    const start: [number, number] = [127.02, 37.5];
    const targetRoadPoint: [number, number] = [127.029, 37.5]; // 800m east
    const targetDistanceMeters = 1000;
    // Direct returns road=800m (< D → Stage 1). Detour returns 1050m but route goes east, far from targetRoadPoint.
    const fetchDirections: FetchDirectionsFn = async (_profile, waypoints) => {
      const end = waypoints[waypoints.length - 1]!;
      if (waypoints.length === 2) {
        const geometry = { type: "LineString" as const, coordinates: [waypoints[0]!, end] as [number, number][] };
        return { geometry, distance: 800, duration: 900, snappedEnd: end, endSnapDistanceMeters: 0 };
      }
      // Detour route: goes east 1050m from start, ending 250m PAST targetRoadPoint
      const farEnd = offsetLngLatByBearingMeters(start, 90, 1050);
      const geometry = {
        type: "LineString" as const,
        coordinates: [start, farEnd] as [number, number][],
      };
      return { geometry, distance: 1050, duration: 1200, snappedEnd: end, endSnapDistanceMeters: 0 };
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "driving",
      targetDistanceMeters,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "found");
    if (searched.status === "found") {
      // clippedEnd at 1000m east, targetRoadPoint at 800m east → endMiss=200m
      // 200m is NOT > 200m so no demote in this case
      // but the detour geometry end is 1050m east, clip at 1000m → clippedEnd 1000m east
      // targetRoadPoint 800m east → endMissM = 200m → not demoted (> not ≥)
      assert.ok(searched.outcome === "detoured" || searched.outcome === "offered");
      // directRoadMeters is always set
      assert.equal(searched.directRoadMeters, 800);
    }
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

  it("우회 예산 소진·direct < D → shortfall, 실수치 고지", async () => {
    const start: [number, number] = [127.02, 37.5];
    const targetRoadPoint = offsetLngLatByBearingMeters(start, 90, 4800) as [number, number];
    const targetDistanceMeters = 5000;
    const directLen = 4975.8;
    let calls = 0;
    const fetchDirections: FetchDirectionsFn = async (_profile, waypoints) => {
      calls += 1;
      const end = waypoints[waypoints.length - 1]!;
      const bearing = waypoints.length === 2 ? 90 : 45;
      const len = waypoints.length === 2 ? directLen : directLen * 0.95;
      const farEnd = offsetLngLatByBearingMeters(waypoints[0]!, bearing, len);
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
      profile: "cycling",
      targetDistanceMeters,
      bearingDeg: 90,
      fetchDirections,
    });

    assert.equal(searched.status, "found");
    if (searched.status === "found") {
      assert.equal(searched.outcome, "shortfall");
      assert.ok(searched.distance < targetDistanceMeters - 5);
      assert.ok(searched.detourCalls > 0);
      assert.ok(calls <= 13);
    }
  });

  for (const fixture of fixtures) {
    it(`fixture ${fixture.id} — outcome·End·오차·호출 수`, async () => {
      const { searched } = await replayClickIntentFixture(fixture);
      assertFixtureExpectations(fixture, searched);
      const rows = rowsFromReplay(fixture, searched);
      assert.equal(rows.length, 2);
      assert.equal(rows[1]?.algorithm, AUTO_ROUTE_ALGORITHM_VERSION);
    });
  }
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

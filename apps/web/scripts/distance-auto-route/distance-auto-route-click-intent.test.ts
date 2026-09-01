import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  AUTO_ROUTE_ALGORITHM_VERSION,
  buildAutoRouteCandidates,
  computeAutoRouteClickDiagnostics,
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

describe("distanceAutoRoute click intent 3F-A", () => {
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
    assert.match(TOKEN_CONTRACT_SOURCE, /targetRoadPoint: \[127\.07, 37\.5\]/);
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
    assert.equal(AUTO_ROUTE_ALGORITHM_VERSION, "3F-A-observe");
  });

  it("fetchDirections 호출 수는 성공·throw·짧은 geometry를 모두 집계", async () => {
    const start: [number, number] = [127.02, 37.5];
    const targetRoadPoint: [number, number] = [127.07, 37.5];
    const targetDistanceMeters = 5000;
    const bearingDeg = 90;
    const candidates = buildAutoRouteCandidates(start, bearingDeg, targetDistanceMeters);
    let attempts = 0;
    const fetchDirections: FetchDirectionsFn = async (_profile, _start, end) => {
      attempts += 1;
      const idx = candidates.findIndex((item) => Math.abs(item.end[0] - end[0]) < 1e-4);
      if (idx < 0) throw new Error("unknown end");
      if (idx % 3 === 0) throw new Error("fixture throw");
      if (idx % 3 === 1) {
        return {
          geometry: { type: "LineString", coordinates: [start, end] },
          distance: targetDistanceMeters * 0.5,
          duration: 600,
        };
      }
      return {
        geometry: {
          type: "LineString",
          coordinates: [start, [end[0], end[1]]],
        },
        distance: targetDistanceMeters * 1.05,
        duration: 1200,
      };
    };

    const searched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint,
      profile: "cycling",
      targetDistanceMeters,
      bearingDeg,
      fetchDirections,
    });

    assert.equal(attempts, candidates.length);
    if (searched.status === "found") {
      assert.equal(searched.diagnostics.providerCallCount, candidates.length);
    } else {
      assert.equal(searched.providerCallCount, candidates.length);
    }
  });

  it("searchDistanceAutoRoute가 core에 attempt counter를 둔다", () => {
    assert.match(CORE_SOURCE, /attemptCounter\.count \+= 1/);
    assert.match(CORE_SOURCE, /await fetchDirections/);
  });

  for (const fixture of fixtures) {
    it(`fixture ${fixture.id} — End·오차·호출 수`, async () => {
      const { searched } = await replayClickIntentFixture(fixture);
      assertFixtureExpectations(fixture, searched);
      const rows = rowsFromReplay(fixture, searched);
      assert.equal(rows.length, 2);
      assert.equal(rows[0]?.sameResult, true);
      assert.equal(rows[1]?.sameResult, true);
      assert.match(rows[0]?.sameResultReason ?? "", /3F-A adds diagnostics only/);
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  AUTO_ROUTE_BEARING_OFFSETS_DEG,
  AUTO_ROUTE_DISTANCE_FACTORS,
  DIRECTION_TOLERANCE_DEG,
  MAX_DISTANCE_ERROR_RATIO,
  angularBearingDiffDeg,
  bearingFromOriginToPoint,
  buildAutoRouteCandidates,
  circleLineString,
  isDistanceErrorWithinMax,
  isValidAutoRouteEnd,
  pickBestAutoRoute,
  scoreRouteDistanceError,
  snappedEndFromRoute,
} from "../../src/lib/distanceAutoRoute.ts";
import {
  formatDistanceAutoRouteClientError,
  DISTANCE_AUTO_ROUTE_DIRECTION_HINT,
  DISTANCE_AUTO_ROUTE_SERVER_UNAVAILABLE,
} from "../../src/lib/distanceAutoRouteErrors.ts";
import { getDistanceMeters } from "../../src/lib/geo.ts";

const ORIGIN: [number, number] = [127.02, 37.5];
const APP_SOURCE = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const MAP_VIEW_SOURCE = readFileSync(
  new URL("../../src/components/map/MapView.tsx", import.meta.url),
  "utf8",
);
const HOOK_SOURCE = readFileSync(
  new URL("../../src/hooks/useDistanceAutoRoute.ts", import.meta.url),
  "utf8",
);
const API_SOURCE = readFileSync(
  new URL("../../src/services/distanceAutoRouteApi.ts", import.meta.url),
  "utf8",
);
const RIDE_ROUTE_PANEL_SOURCE = readFileSync(
  new URL("../../src/components/ride/RideRoutePanel.tsx", import.meta.url),
  "utf8",
);

const BUILD_PICK_POPUP_SOURCE = MAP_VIEW_SOURCE.slice(
  MAP_VIEW_SOURCE.indexOf("function buildPickPopup"),
  MAP_VIEW_SOURCE.indexOf("function buildAutoRouteStatusPopup"),
);

describe("distanceAutoRoute", () => {
  it("bearingFromOriginToPoint — 동쪽 클릭은 약 90°", () => {
    const east: [number, number] = [127.03, 37.5];
    const b = bearingFromOriginToPoint(ORIGIN, east);
    assert.ok(b > 85 && b < 95, `expected ~90 got ${b}`);
  });

  it("circleLineString — 둘레 점이 반경에 근사", () => {
    const circle = circleLineString(ORIGIN, 1000, 36);
    const sample = circle.coordinates[9]!;
    const d = getDistanceMeters(ORIGIN, sample);
    assert.ok(Math.abs(d - 1000) < 50, `radius error ${d}`);
  });

  it("buildAutoRouteCandidates — 계획서 거리·방향 계수로 35개 이하", () => {
    const cands = buildAutoRouteCandidates(ORIGIN, 90, 5000);
    const max = AUTO_ROUTE_DISTANCE_FACTORS.length * AUTO_ROUTE_BEARING_OFFSETS_DEG.length;
    assert.ok(cands.length > 0 && cands.length <= max);
    const ends = new Set(cands.map((c) => `${c.end[0]},${c.end[1]}`));
    assert.equal(ends.size, cands.length);
    assert.equal(DIRECTION_TOLERANCE_DEG, 30);
  });

  it("pickBestAutoRoute — 오차 최소 선택", () => {
    const target = 5000;
    const scored = [
      {
        candidate: { end: ORIGIN, bearingDeg: 0, straightLineMeters: 5000 },
        route: { geometry: { type: "LineString", coordinates: [ORIGIN, ORIGIN] }, distance: 5200, duration: 600 },
        errorMeters: scoreRouteDistanceError(5200, target),
      },
      {
        candidate: { end: ORIGIN, bearingDeg: 0, straightLineMeters: 5000 },
        route: { geometry: { type: "LineString", coordinates: [ORIGIN, ORIGIN] }, distance: 5050, duration: 580 },
        errorMeters: scoreRouteDistanceError(5050, target),
      },
    ];
    const best = pickBestAutoRoute(scored, 180);
    assert.equal(best?.route.distance, 5050);
  });

  it("pickBestAutoRoute — 오차 동률이면 클릭 방향에 가까운 후보", () => {
    const target = 5000;
    const err = scoreRouteDistanceError(5100, target);
    const scored = [
      {
        candidate: { end: ORIGIN, bearingDeg: 200, straightLineMeters: 5000 },
        route: { geometry: { type: "LineString", coordinates: [ORIGIN, ORIGIN] }, distance: 5100, duration: 600 },
        errorMeters: err,
      },
      {
        candidate: { end: ORIGIN, bearingDeg: 182, straightLineMeters: 5000 },
        route: { geometry: { type: "LineString", coordinates: [ORIGIN, ORIGIN] }, distance: 5100, duration: 580 },
        errorMeters: err,
      },
    ];
    const best = pickBestAutoRoute(scored, 180);
    assert.equal(best?.candidate.bearingDeg, 182);
    assert.equal(angularBearingDiffDeg(182, 180), 2);
  });

  it("isDistanceErrorWithinMax — 20% 이내만 허용", () => {
    assert.equal(isDistanceErrorWithinMax(1500, 10000), true);
    assert.equal(isDistanceErrorWithinMax(2500, 10000), false);
    assert.equal(MAX_DISTANCE_ERROR_RATIO, 0.2);
  });

  it("snappedEndFromRoute — geometry 마지막 점", () => {
    const end: [number, number] = [127.05, 37.52];
    const route = {
      geometry: { type: "LineString" as const, coordinates: [ORIGIN, [127.03, 37.51], end] },
      distance: 5000,
      duration: 600,
    };
    assert.deepEqual(snappedEndFromRoute(route), end);
  });

  it("isValidAutoRouteEnd — 200m 미만은 거부", () => {
    const near: [number, number] = [127.02001, 37.5];
    assert.equal(isValidAutoRouteEnd(ORIGIN, near), false);
    const far = buildAutoRouteCandidates(ORIGIN, 90, 3000)[0]!.end;
    assert.equal(isValidAutoRouteEnd(ORIGIN, far), true);
  });

  it("자동 경로 진입 — MENU가 아니라 기본 지도 지점 선택 팝업에 통합", () => {
    assert.match(MAP_VIEW_SOURCE, /목표 거리로 End 자동 찾기/);
    assert.match(MAP_VIEW_SOURCE, /onStartDistanceAutoRoute/);
    assert.doesNotMatch(APP_SOURCE, /DistanceAutoRouteSheet/);
    assert.doesNotMatch(RIDE_ROUTE_PANEL_SOURCE, /onOpenDistanceAutoRoute/);
  });

  it("Start 선택 — 기존 startLngLat 경로를 사용해 지도 마커와 동기화", () => {
    assert.match(MAP_VIEW_SOURCE, /onSelectPoint\("start", lngLat\)/);
    assert.match(APP_SOURCE, /if \(type === "start"\) setStartLngLat\(lngLat\)/);
    assert.match(MAP_VIEW_SOURCE, /new mapboxgl\.Marker\([\s\S]*?setLngLat\(startLngLat\)/);
  });

  it("popup 이동수단 — 자동차·자전거·도보 각 1세트(중복 autoProfile 없음)", () => {
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /autoProfileSpecs/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /autoProfileButtons/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /onSetRouteProfileOnly/);
    const profileBtnCreates = BUILD_PICK_POPUP_SOURCE.match(/map-view__pick-btn--profile/g);
    assert.equal(profileBtnCreates?.length, 1);
  });

  it("거리 원 preview — 펼침·preset 클릭 시 hook·fitBounds 연결", () => {
    assert.match(HOOK_SOURCE, /previewCircleAt/);
    assert.match(HOOK_SOURCE, /clearCirclePreview/);
    assert.match(HOOK_SOURCE, /circleFitToken/);
    assert.match(HOOK_SOURCE, /circlePreview/);
    assert.match(MAP_VIEW_SOURCE, /onPreviewDistanceAutoRouteCircle/);
    assert.match(MAP_VIEW_SOURCE, /distanceTargetCircleFitToken/);
    assert.match(MAP_VIEW_SOURCE, /previewCircleForTargetKm/);
    assert.match(MAP_VIEW_SOURCE, /fitBounds/);
  });

  it("원 중심 — Start 좌표로 previewCircleAt 전달", () => {
    assert.match(BUILD_PICK_POPUP_SOURCE, /onPreviewDistanceAutoRouteCircle\(\{ start, targetKm/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /getRouteStart\(\)/);
  });

  it("End 없을 때 profile 변경 — onSetRouteProfileOnly 분기(경로 생성 없음)", () => {
    assert.match(BUILD_PICK_POPUP_SOURCE, /onSetRouteProfileOnly\?\.\(profile\)/);
    assert.match(APP_SOURCE, /handleSetRouteProfileOnly/);
    assert.doesNotMatch(APP_SOURCE, /handleSetRouteProfileOnly[\s\S]{0,120}generateRoute/);
  });

  it("원 제거 — popup 종료·경로 삭제·자동 찾기 숨김 시 clear", () => {
    assert.match(MAP_VIEW_SOURCE, /onClearDistanceAutoRouteCircle/);
    assert.match(APP_SOURCE, /clearCirclePreview\(\)/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /onClearDistanceAutoRouteCircle\?\.\(\)/);
  });

  it("목표 거리 원 — Route 선과 동일한 빨강·점선·가시성", () => {
    assert.match(MAP_VIEW_SOURCE, /"line-color": ROUTE_LINE_COLOR/);
    assert.match(MAP_VIEW_SOURCE, /"line-width": 3/);
    assert.match(MAP_VIEW_SOURCE, /"line-opacity": 0\.95/);
    assert.match(MAP_VIEW_SOURCE, /"line-dasharray": \[2, 2\]/);
    assert.match(MAP_VIEW_SOURCE, /distance-target-circle-casing/);
    assert.doesNotMatch(MAP_VIEW_SOURCE, /#E8A33D/);
  });

  it("방향 선택 안내 — 클릭 거리가 아닌 방향만 사용", () => {
    assert.match(HOOK_SOURCE, /DISTANCE_AUTO_ROUTE_DIRECTION_HINT/);
    assert.match(MAP_VIEW_SOURCE, /DISTANCE_AUTO_ROUTE_DIRECTION_HINT/);
    assert.equal(
      DISTANCE_AUTO_ROUTE_DIRECTION_HINT,
      "지도에서 원하는 주행 방향을 선택하세요. 클릭한 지점까지의 거리가 아니라 방향만 사용합니다.",
    );
  });

  it("fetch 연결 실패 — Failed to fetch 노출 금지", () => {
    assert.match(API_SOURCE, /formatDistanceAutoRouteClientError/);
    assert.match(HOOK_SOURCE, /formatDistanceAutoRouteClientError/);
    assert.equal(
      formatDistanceAutoRouteClientError(new TypeError("Failed to fetch")),
      DISTANCE_AUTO_ROUTE_SERVER_UNAVAILABLE,
    );
    assert.equal(
      formatDistanceAutoRouteClientError(new Error("Failed to fetch")),
      DISTANCE_AUTO_ROUTE_SERVER_UNAVAILABLE,
    );
    assert.equal(
      formatDistanceAutoRouteClientError(new Error("목표거리와 적합한 경로를 찾지 못했습니다.")),
      "목표거리와 적합한 경로를 찾지 못했습니다.",
    );
  });
});

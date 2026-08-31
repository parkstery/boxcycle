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
  DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT,
  DISTANCE_AUTO_ROUTE_REROUTE_HINT,
  DISTANCE_AUTO_ROUTE_SERVER_UNAVAILABLE,
  validateDistanceAutoRouteTargetKm,
} from "../../src/lib/distanceAutoRouteErrors.ts";
import { getDistanceMeters } from "../../src/lib/geo.ts";

const ORIGIN: [number, number] = [127.02, 37.5];
const APP_SOURCE = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const BRIDGE_SOURCE = readFileSync(
  new URL("../../src/lib/distanceAutoRouteMapBridge.ts", import.meta.url),
  "utf8",
);
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

  it("자동 경로 진입 — 단일 설정 popup에 거리 컨트롤 통합", () => {
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /목표 거리로 End 자동 찾기/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /지도에서 방향 선택/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /map-view__pick-distance-row/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /onArmDirectionPick/);
    assert.doesNotMatch(APP_SOURCE, /DistanceAutoRouteSheet/);
    assert.doesNotMatch(RIDE_ROUTE_PANEL_SOURCE, /onOpenDistanceAutoRoute/);
  });

  it("Start 선택 — 기존 startLngLat 경로를 사용해 지도 마커와 동기화", () => {
    assert.match(MAP_VIEW_SOURCE, /onSelectPoint\("start", lngLat\)/);
    assert.match(APP_SOURCE, /type === "start"[\s\S]{0,80}setStartLngLat\(lngLat\)/);
    assert.match(MAP_VIEW_SOURCE, /getDistanceAutoRouteMapBridge\(\)\?\.disarm/);
    assert.match(MAP_VIEW_SOURCE, /new mapboxgl\.Marker\([\s\S]*?setLngLat\(startLngLat\)/);
  });

  it("popup 이동수단 — 자동차·자전거·도보 각 1세트(중복 autoProfile 없음)", () => {
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /autoProfileSpecs/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /autoProfileButtons/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /onSetRouteProfileOnly/);
    const profileBtnCreates = BUILD_PICK_POPUP_SOURCE.match(/map-view__pick-btn--profile/g);
    assert.equal(profileBtnCreates?.length, 1);
  });

  it("거리 컨트rol — slider·숫자 입력과 pick_direction 진입", () => {
    assert.match(BUILD_PICK_POPUP_SOURCE, /map-view__pick-distance-slider/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /map-view__pick-distance-number/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /tryArmDirectionPick/);
    assert.match(HOOK_SOURCE, /armDirectionPick/);
    assert.match(HOOK_SOURCE, /pick_direction/);
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

  it("방향 선택 안내 — popup 한 줄 클릭 힌트", () => {
    assert.match(HOOK_SOURCE, /DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT/);
    assert.match(MAP_VIEW_SOURCE, /DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT/);
    assert.equal(
      DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT,
      "지도에서 원하는 방향을 클릭하세요",
    );
  });

  it("지도 클릭 — 방향 모드에서 동일 popup inline 갱신", () => {
    assert.match(MAP_VIEW_SOURCE, /pickPopupAutoRouteUiRef/);
    assert.match(MAP_VIEW_SOURCE, /setInlinePhase/);
    assert.doesNotMatch(MAP_VIEW_SOURCE, /buildAutoRouteStatusPopup/);
  });

  it("수동 End — 거리 미사용 시 onSelectPoint end 유지", () => {
    assert.match(APP_SOURCE, /else if \(type === "end"\)/);
    assert.match(APP_SOURCE, /disarm\(\)/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /onSelectPoint\("end", lngLat\)/);
  });

  it("목표 거리 검증 — 0.4·120.5·빈 값 차단", () => {
    assert.equal(validateDistanceAutoRouteTargetKm(0.4).ok, false);
    assert.equal(validateDistanceAutoRouteTargetKm(120.5).ok, false);
    assert.equal(validateDistanceAutoRouteTargetKm(Number.NaN).ok, false);
    assert.equal(validateDistanceAutoRouteTargetKm(55).ok, true);
  });

  it("custom 55km — targetDistanceMeters 55000", () => {
    assert.match(HOOK_SOURCE, /targetKm \* 1000/);
    assert.equal(55 * 1000, 55000);
  });

  it("탐색 중 — handleMapPick 중복 클릭 무시", () => {
    assert.match(HOOK_SOURCE, /step === "searching"/);
    assert.match(MAP_VIEW_SOURCE, /autoRouteSearchBusyRef/);
  });

  it("Token 문구 — 잔여 한 줄", () => {
    assert.match(
      readFileSync(new URL("../../src/lib/routeTokenUiCopy.ts", import.meta.url), "utf8"),
      /경로 생성 잔여 토큰/,
    );
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /경로 생성 시 1개 사용/);
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

  it("Route A 성공 후 — popup 열림 동안 방향 지도 클릭 유지", () => {
    assert.equal(
      DISTANCE_AUTO_ROUTE_REROUTE_HINT,
      "경로 생성 완료 · 다른 방향을 클릭하면 다시 탐색합니다",
    );
    assert.match(HOOK_SOURCE, /popupPickBound/);
    assert.match(HOOK_SOURCE, /step === "pick_direction"/);
    assert.match(HOOK_SOURCE, /DISTANCE_AUTO_ROUTE_REROUTE_HINT/);
    assert.doesNotMatch(
      HOOK_SOURCE,
      /step === "route_found"[\s\S]{0,80}mapPickMode[\s\S]{0,40}null/,
    );
  });

  it("Route B — requestId 매 요청 신규 생성·성공 후 폐기", () => {
    assert.match(HOOK_SOURCE, /createRequestId\(\)/);
    assert.match(HOOK_SOURCE, /activeRequestIdRef\.current = null/);
    assert.doesNotMatch(
      HOOK_SOURCE.slice(HOOK_SOURCE.indexOf("const requestId ="), HOOK_SOURCE.indexOf("activeRequestIdRef.current = requestId") + 40),
      /activeRequestIdRef\.current \?\?/,
    );
  });

  it("Route B 성공 — onApplyRoute로 geometry·End 교체", () => {
    assert.match(HOOK_SOURCE, /onApplyRoute\(/);
    assert.match(APP_SOURCE, /setEndLngLat\(result\.end\)/);
    assert.match(APP_SOURCE, /setRouteGeometry\(result\.geometry\)/);
  });

  it("Route B 탐색 중 — onApplyRoute 호출 전까지 Route A 유지", () => {
    const searchBlock = HOOK_SOURCE.slice(
      HOOK_SOURCE.indexOf('setStep("searching")'),
      HOOK_SOURCE.indexOf("onClearRouteArtifacts"),
    );
    assert.doesNotMatch(searchBlock, /onApplyRoute/);
    assert.doesNotMatch(searchBlock, /onClearRouteArtifacts/);
  });

  it("Route B 실패 — pick_direction 복귀·Route A 유지", () => {
    assert.match(HOOK_SOURCE, /response\.status === "failed"/);
    assert.match(HOOK_SOURCE, /setStep\("pick_direction"\)/);
    assert.doesNotMatch(
      HOOK_SOURCE.slice(HOOK_SOURCE.indexOf('response.status === "failed"'), HOOK_SOURCE.indexOf('setStep("pick_direction")', HOOK_SOURCE.indexOf('response.status === "failed"')) + 30),
      /onApplyRoute/,
    );
  });

  it("End 존재 시 — 거리 slider·숫자 입력 표시", () => {
    const syncAutoRouteBlock = BUILD_PICK_POPUP_SOURCE.slice(
      BUILD_PICK_POPUP_SOURCE.indexOf("function syncAutoRouteUi"),
      BUILD_PICK_POPUP_SOURCE.indexOf("syncAutoRouteUi();", BUILD_PICK_POPUP_SOURCE.indexOf("function syncAutoRouteUi")) + 20,
    );
    assert.doesNotMatch(syncAutoRouteBlock, /pins\.start && !pins\.end/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /pins\.start && typeof onArmDirectionPick/);
  });

  it("popup 재개방 — 목표 거리·profile 복원", () => {
    assert.match(MAP_VIEW_SOURCE, /autoRouteTargetKm/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /autoRouteTargetKm/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /syncDistanceInputs\(targetKm\)/);
    assert.match(BRIDGE_SOURCE, /targetKm/);
    assert.match(HOOK_SOURCE, /registerDistanceAutoRouteMapBridge/);
  });

  it("자동 세션 profile 변경 — 수동 onRouteProfile 호출 금지", () => {
    assert.match(BUILD_PICK_POPUP_SOURCE, /manualRouteReady/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /!autoSessionActive/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /onSetRouteProfileOnly\?\.\(profile\)/);
  });

  it("popup close — suspendPopupPick으로 지도 클릭 가로채기 해제", () => {
    assert.match(MAP_VIEW_SOURCE, /getDistanceAutoRouteMapBridge/);
    assert.match(MAP_VIEW_SOURCE, /suspendPopupPick/);
    assert.match(HOOK_SOURCE, /suspendPopupPick/);
    assert.match(HOOK_SOURCE, /setPopupPickBound\(false\)/);
  });

  it("Token 0 — provider 호출 전 handleMapPick 차단", () => {
    assert.match(HOOK_SOURCE, /routeTokenInsufficient/);
    assert.match(
      HOOK_SOURCE.slice(HOOK_SOURCE.indexOf("step === \"pick_direction\"")),
      /if \(routeTokenInsufficient\)/,
    );
  });

  it("구형 popup — 자동 세션에서 경로 탐색 유형 선택 미노출", () => {
    assert.match(BUILD_PICK_POPUP_SOURCE, /manualRouteReady/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /map-view__pick-sr-only/);
    assert.doesNotMatch(
      BUILD_PICK_POPUP_SOURCE.slice(BUILD_PICK_POPUP_SOURCE.indexOf("function syncProfileUi")),
      /const ready = pins\.start && pins\.end/,
    );
  });
});

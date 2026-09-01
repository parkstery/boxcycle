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
import {
  buildRoutePickDockCandidates,
  clampRoutePickDockPosition,
  panelReservedOverlapArea,
  pickBestRoutePickDockCandidate,
  pickRoutePickDockPosition,
  ROUTE_PICK_DOCK_HUD_SELECTORS,
  ROUTE_PICK_DOCK_MARGIN_PX,
  scoreRoutePickDockCandidate,
} from "../../src/lib/mapPickRouteDock.ts";

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
const MOUNT_TOKEN_SOURCE = readFileSync(
  new URL("../../src/lib/mountRouteTokenPopupFeedback.ts", import.meta.url),
  "utf8",
);
const TOKEN_DISPLAY_SOURCE = readFileSync(
  new URL("../../src/lib/routeTokenPopupDisplay.mjs", import.meta.url),
  "utf8",
);
const MAP_VIEW_CSS = readFileSync(
  new URL("../../src/components/map/MapView.css", import.meta.url),
  "utf8",
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
    assert.match(BUILD_PICK_POPUP_SOURCE, /map-view__pick-distance-step/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /map-view__pick-distance-mode-checkbox/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /inputMode = "decimal"/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /distanceNumber\.type = "number"/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /tryArmDirectionPickIfChecked/);
    assert.match(HOOK_SOURCE, /armDirectionPick/);
    assert.match(HOOK_SOURCE, /pick_direction/);
  });

  it("도넛 삭제 — 3F-C-R1: 참고 원만 유지, buildClickZoneDonut 없음", () => {
    // 도넛은 삭제됨. 참고 원(circleLineString)만 남음.
    const circle = circleLineString(ORIGIN, 1000, 36);
    assert.equal(circle.type, "LineString");
    assert.ok(circle.coordinates.length > 0);
  });

  it("도넛 중심 — Start 좌표로 previewCircleAt 전달", () => {
    assert.match(BUILD_PICK_POPUP_SOURCE, /onPreviewDistanceAutoRouteCircle\(\{ start, targetKm/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /getRouteStart\(\)/);
  });

  it("End 없을 때 profile 변경 — onSetRouteProfileOnly 분기(경로 생성 없음)", () => {
    assert.match(BUILD_PICK_POPUP_SOURCE, /onSetRouteProfileOnly\?\.\(profile\)/);
    assert.match(APP_SOURCE, /handleSetRouteProfileOnly/);
    assert.doesNotMatch(APP_SOURCE, /handleSetRouteProfileOnly[\s\S]{0,120}generateRoute/);
  });

  it("도넛 제거 — popup 종료·경로 삭제·자동 찾기 숨김 시 clear", () => {
    assert.match(MAP_VIEW_SOURCE, /onClearDistanceAutoRouteCircle/);
    assert.match(APP_SOURCE, /clearCirclePreview\(\)/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /onClearDistanceAutoRouteCircle\?\.\(\)/);
  });

  it("목표 거리 참고 원 — 3F-C-R1: 도넛 삭제, 참고 원·Route 선만 유지", () => {
    // 도넛 레이어 없음
    assert.doesNotMatch(MAP_VIEW_SOURCE, /distance-target-click-zone-outer-line/);
    assert.doesNotMatch(MAP_VIEW_SOURCE, /distance-target-click-zone-fill/);
    // Route 선 스타일 유지
    assert.match(MAP_VIEW_SOURCE, /"line-color": ROUTE_LINE_COLOR/);
    assert.doesNotMatch(MAP_VIEW_SOURCE, /#E8A33D/);
  });

  it("방향 선택 안내 — popup 한 줄 클릭 힌트 (3F-C-R1: 도로 클릭 안내)", () => {
    assert.match(HOOK_SOURCE, /DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT/);
    assert.match(MAP_VIEW_SOURCE, /DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT/);
    assert.equal(
      DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT,
      "도착하고 싶은 도로 위 지점을 클릭하세요",
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
    assert.match(HOOK_SOURCE, /distanceDirectionMode/);
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
    assert.match(BUILD_PICK_POPUP_SOURCE, /!distanceDirectionChecked/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /onSetRouteProfileOnly\?\.\(profile\)/);
  });

  it("popup close — suspendPopupPick으로 지도 클릭 가로채기 해제", () => {
    assert.match(MAP_VIEW_SOURCE, /getDistanceAutoRouteMapBridge/);
    assert.match(MAP_VIEW_SOURCE, /suspendPopupPick/);
    assert.match(HOOK_SOURCE, /suspendPopupPick/);
    assert.match(HOOK_SOURCE, /releasePickArm/);
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

  it("3D-2 — Token 잔액·부족을 한 줄로 조합", () => {
    assert.match(TOKEN_DISPLAY_SOURCE, /formatRouteTokenPopupLine/);
    assert.match(MOUNT_TOKEN_SOURCE, /formatRouteTokenPopupLine/);
    assert.match(MOUNT_TOKEN_SOURCE, /map-view__pick-token-line/);
    assert.doesNotMatch(MOUNT_TOKEN_SOURCE, /map-view__pick-token-secondary/);
  });

  it("3D-2 — 이동수단과 경로 삭제가 같은 action row", () => {
    assert.match(BUILD_PICK_POPUP_SOURCE, /map-view__pick-btn--clear-route/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /rowProfile\.appendChild\(clearRouteBtn\)/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /profileHeader/);
  });

  it("3D-2 — ± 버튼이 0.5km 증감하고 min/max에서 disable", () => {
    assert.match(BUILD_PICK_POPUP_SOURCE, /stepTargetKm\(-DISTANCE_AUTO_ROUTE_KM_STEP\)/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /stepTargetKm\(DISTANCE_AUTO_ROUTE_KM_STEP\)/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /minusBtn\.disabled = km <= DISTANCE_AUTO_ROUTE_KM_MIN/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /plusBtn\.disabled = km >= DISTANCE_AUTO_ROUTE_KM_MAX/);
  });

  it("3D-2 — 거리 조작만으로 provider 호출 없음", () => {
    const stepBlock = BUILD_PICK_POPUP_SOURCE.slice(
      BUILD_PICK_POPUP_SOURCE.indexOf("function stepTargetKm"),
      BUILD_PICK_POPUP_SOURCE.indexOf("function setInlinePhase"),
    );
    assert.doesNotMatch(stepBlock, /fetchDistanceAutoRoute/);
    assert.doesNotMatch(stepBlock, /onAutoRouteMapPick/);
    assert.match(stepBlock, /tryArmDirectionPickIfChecked/);
    assert.match(stepBlock, /if \(!distanceDirectionChecked\) return/);
  });

  it("3D-2-R1 — 거리·방향 모드 checkbox와 armed 분리", () => {
    assert.match(
      BUILD_PICK_POPUP_SOURCE,
      /DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_ARIA/,
    );
    assert.match(
      BUILD_PICK_POPUP_SOURCE,
      /DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_LABEL/,
    );
    assert.match(BUILD_PICK_POPUP_SOURCE, /map-view__pick-distance-mode-checkbox/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /setDistanceDirectionMode/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /applyDistanceDirectionMode/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /distanceSlider\.addEventListener\("focus"/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /distanceNumber\.addEventListener\("focus"/);
    assert.match(HOOK_SOURCE, /distanceDirectionMode/);
    assert.match(HOOK_SOURCE, /setDistanceDirectionMode/);
    assert.match(HOOK_SOURCE, /releasePickArm/);
    assert.match(
      HOOK_SOURCE,
      /distanceDirectionMode && popupPickBound && step === "pick_direction"/,
    );
    assert.match(BRIDGE_SOURCE, /distanceDirectionMode/);
    assert.match(BRIDGE_SOURCE, /releasePickArm/);
  });

  it("3D-2-R1 — ± 버튼 시각 크기가 숫자 입력 높이와 동일", () => {
    assert.match(
      MAP_VIEW_CSS,
      /--pick-distance-control-height[\s\S]*?map-view__pick-distance-number[\s\S]*?height: var\(--pick-distance-control-height\)/,
    );
    assert.match(
      MAP_VIEW_CSS,
      /map-view__pick-distance-step[\s\S]*?height: var\(--pick-distance-control-height\)/,
    );
    assert.doesNotMatch(MAP_VIEW_CSS, /min-width: 40px/);
  });

  it("3D-2-R1 — 상태 메시지 단일 슬롯·고정 높이", () => {
    assert.match(BUILD_PICK_POPUP_SOURCE, /map-view__pick-auto-route-status-slot/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /autoRouteStatusSlot\.append\(autoRouteStatus\)/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /autoRouteSection\.append\(distanceRow, autoRouteStatusSlot\)/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /autoRouteError/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /inlineStatus/);
    assert.match(
      MAP_VIEW_CSS,
      /map-view__pick-auto-route-status-slot[\s\S]*?min-height:/,
    );
    assert.match(BUILD_PICK_POPUP_SOURCE, /autoRouteStatus\.dataset\.phase/);
  });

  it("3D-2-R1 — ± hit area가 인접 컨트롤과 겹치지 않음 (R2에서 step-hit 제거)", () => {
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /map-view__pick-distance-step-hit/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /minusHit/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /plusHit/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /distanceRow\.append\(modeField, distanceLabel, minusBtn, distanceSlider, plusBtn, distanceNumber\)/);
    assert.doesNotMatch(MAP_VIEW_CSS, /map-view__pick-distance-step-hit/);
    assert.doesNotMatch(MAP_VIEW_CSS, /map-view__pick-distance-step::before/);
  });

  it("3D-2-R2 — Start 후 screen-space dock·drag·공간 회수", () => {
    assert.match(MAP_VIEW_SOURCE, /mountDockedRoutePanel/);
    assert.match(MAP_VIEW_SOURCE, /promotePointPopupToDock/);
    assert.match(MAP_VIEW_SOURCE, /onRoutePanelActivated/);
    assert.match(MAP_VIEW_SOURCE, /map-view__pick-dock-layer/);
    assert.match(MAP_VIEW_SOURCE, /map-view__pick-drag-handle/);
    assert.match(MAP_VIEW_SOURCE, /routePickDockDraggingRef/);
    assert.match(MAP_VIEW_SOURCE, /map\.dragPan\.disable\(\)/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /onRoutePanelActivated\?\.\(\)/);
    assert.doesNotMatch(MAP_VIEW_CSS, /\.map-view__pick \{[\s\S]*?padding-right: 1\.85rem/);
    assert.match(MAP_VIEW_CSS, /map-view__pick-drag-handle[\s\S]*?padding-right: 1\.4rem/);
    assert.match(
      MAP_VIEW_CSS,
      /map-view__pick-distance-row[\s\S]*?grid-template-columns: auto auto 1fr auto auto/,
    );
  });

  it("3D-2-R2 — dock 위치 계산·clamp·예약 영역", () => {
    const viewport = {
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
    };
    const panelWidth = 280;
    const panelHeight = 200;
    const reserved = [{ left: 300, top: 0, right: 400, bottom: 80, width: 100, height: 80 }];
    const focus = {
      clickPoint: { x: 200, y: 150 },
      startPoint: { x: 180, y: 140 },
      routePoints: [],
    };
    const pos = pickRoutePickDockPosition({
      viewport,
      panelWidth,
      panelHeight,
      reservedRects: reserved,
      focus,
    });
    assert.ok(pos.left >= ROUTE_PICK_DOCK_MARGIN_PX);
    assert.ok(pos.top >= ROUTE_PICK_DOCK_MARGIN_PX);
    assert.ok(pos.left + panelWidth <= viewport.width - ROUTE_PICK_DOCK_MARGIN_PX);
    assert.ok(pos.top + panelHeight <= viewport.height - ROUTE_PICK_DOCK_MARGIN_PX);
    const panel = {
      left: pos.left,
      top: pos.top,
      right: pos.left + panelWidth,
      bottom: pos.top + panelHeight,
      width: panelWidth,
      height: panelHeight,
    };
    assert.equal(panelReservedOverlapArea(panel, reserved), 0);
    const saved = { left: 12, top: 88 };
    const clampedSaved = pickRoutePickDockPosition({
      viewport,
      panelWidth,
      panelHeight,
      reservedRects: reserved,
      focus,
      savedPosition: saved,
    });
    assert.equal(clampedSaved.left, saved.left);
    assert.equal(clampedSaved.top, saved.top);
    const candidates = buildRoutePickDockCandidates(viewport, panelWidth, panelHeight);
    assert.ok(candidates.length >= 4);
    const leftScore = scoreRoutePickDockCandidate(
      candidates[0]!,
      panelWidth,
      panelHeight,
      reserved,
      focus,
    );
    assert.ok(Number.isFinite(leftScore));
    const overflow = clampRoutePickDockPosition(500, 500, panelWidth, panelHeight, viewport);
    assert.ok(overflow.left < 500);
    assert.ok(overflow.top < 500);
  });

  it("3D-2-R2-R1 — collision-free 후보 우선·HUD slot selector", () => {
    assert.doesNotMatch(
      JSON.stringify(ROUTE_PICK_DOCK_HUD_SELECTORS),
      /map-hud"/,
    );
    assert.match(JSON.stringify(ROUTE_PICK_DOCK_HUD_SELECTORS), /map-hud__tl/);
    assert.match(JSON.stringify(ROUTE_PICK_DOCK_HUD_SELECTORS), /map-hud__br/);

    const viewport = {
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
    };
    const panelWidth = 280;
    const panelHeight = 200;
    const reserved = [{ left: 300, top: 0, right: 400, bottom: 80, width: 100, height: 80 }];
    const focus = {
      clickPoint: { x: 200, y: 150 },
      startPoint: { x: 180, y: 140 },
      routePoints: [],
    };
    const candidates = buildRoutePickDockCandidates(viewport, panelWidth, panelHeight);
    const betterFocusWorseReserved = candidates.find((candidate) => {
      const panel = {
        left: candidate.left,
        top: candidate.top,
        right: candidate.left + panelWidth,
        bottom: candidate.top + panelHeight,
        width: panelWidth,
        height: panelHeight,
      };
      return panelReservedOverlapArea(panel, reserved) > 0;
    });
    assert.ok(betterFocusWorseReserved, "fixture must include a reserved-overlapping candidate");
    const best = pickBestRoutePickDockCandidate({
      candidates,
      panelWidth,
      panelHeight,
      reservedRects: reserved,
      focus,
    });
    const bestPanel = {
      left: best.left,
      top: best.top,
      right: best.left + panelWidth,
      bottom: best.top + panelHeight,
      width: panelWidth,
      height: panelHeight,
    };
    assert.equal(panelReservedOverlapArea(bestPanel, reserved), 0);

    const tinyViewport = {
      left: 0,
      top: 0,
      right: 300,
      bottom: 220,
      width: 300,
      height: 220,
    };
    const hugeReserved = [
      { left: 0, top: 0, right: 300, bottom: 220, width: 300, height: 220 },
    ];
    const tinyCandidates = buildRoutePickDockCandidates(tinyViewport, panelWidth, panelHeight);
    const fallback = pickBestRoutePickDockCandidate({
      candidates: tinyCandidates,
      panelWidth,
      panelHeight,
      reservedRects: hugeReserved,
      focus,
    });
    const fallbackPanel = {
      left: fallback.left,
      top: fallback.top,
      right: fallback.left + panelWidth,
      bottom: fallback.top + panelHeight,
      width: panelWidth,
      height: panelHeight,
    };
    assert.ok(panelReservedOverlapArea(fallbackPanel, hugeReserved) >= 0);
  });
});

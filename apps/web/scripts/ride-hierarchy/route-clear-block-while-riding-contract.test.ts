import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isRouteClearBlockedByRide } from "../../src/lib/route/routeClearGuard.ts";

/**
 * 지시93 — 주행 중 경로 삭제 금지 + 경로가 없으면 음악 정지.
 * 소스 문자열을 앵커로 쓰는 정적 계약 — 가드가 사라지거나 순서가 뒤집히면 실패한다.
 */
const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const APP = read("src/App.tsx");

/** `start` 로 시작해 첫 `}, [` 까지(= useCallback 본문) */
function callbackBody(src: string, start: string): string {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `앵커 없음: ${start}`);
  const j = src.indexOf("}, [", i);
  const k = src.indexOf("],\n  );", i);
  const end = [j, k].filter((n) => n > i).sort((a, b) => a - b)[0];
  assert.ok(end, `끝 앵커 없음: ${start}`);
  return src.slice(i, end);
}

describe("isRouteClearBlockedByRide", () => {
  it("idle 만 지울 수 있고 running·paused 는 막는다", () => {
    assert.equal(isRouteClearBlockedByRide("idle"), false);
    assert.equal(isRouteClearBlockedByRide("running"), true);
    assert.equal(isRouteClearBlockedByRide("paused"), true);
  });
});

describe("음악: 경로가 없으면 sessionActive=false", () => {
  it("useRideBgm 의 sessionActive 가 세션 상태와 routeGeometry 를 함께 본다", () => {
    const src = read("src/features/ride-feedback/useRideCoachingMedia.ts");
    const m = /useRideBgm\(\{[\s\S]*?\}\);/.exec(src);
    assert.ok(m, "useRideBgm 호출 없음");
    assert.match(m[0], /sessionActive:\s*opts\.sessionStatus !== "idle" && opts\.routeGeometry != null/);
  });
});

describe("App 가드: 세 진입점 앞에 같은 판정", () => {
  it("handleClearPins — 가드가 clearRoutePins 보다 앞", () => {
    const body = callbackBody(APP, "const handleClearPins = useCallback(");
    const g = body.indexOf("routeClearBlockedByRide");
    assert.ok(g >= 0, "가드 없음");
    assert.ok(body.indexOf("setRouteClearBlockedOpen(true)") > g);
    assert.ok(g < body.indexOf("clearRoutePins("), "가드가 clearRoutePins 뒤에 있음");
    assert.ok(g < body.indexOf("anchorFixedStartRef.current = null"), "가드가 상태 초기화 뒤에 있음");
    assert.ok(g < body.indexOf("dismissResult()"));
    // 기존 rideLocked 인자는 그대로
    assert.match(body, /clearRoutePins\(routeMenuLockedForProd\)/);
  });

  it("handleRemoveRouteDockStop — 가드가 첫 줄(routeMenuLockedForProd·상태 변경보다 앞)", () => {
    const body = callbackBody(APP, "const handleRemoveRouteDockStop = useCallback(");
    const g = body.indexOf("routeClearBlockedByRide");
    assert.ok(g >= 0, "가드 없음");
    assert.ok(body.indexOf("setRouteClearBlockedOpen(true)") > g);
    assert.ok(g < body.indexOf("routeMenuLockedForProd"));
    assert.ok(g < body.indexOf("setStartLngLat(null)"));
    assert.ok(g < body.indexOf("setEndLngLat(null)"));
    assert.ok(g < body.indexOf("setRouteWaypoints("));
  });

  it("MapHud·지도 경로 창은 모두 handleClearPins 로 들어온다", () => {
    const hud = APP.match(/onClearPins:\s*(\w+)/g) ?? [];
    assert.ok(hud.length >= 2, "MapHud onClearPins 배선 2곳 미만");
    for (const h of hud) assert.match(h, /onClearPins:\s*handleClearPins/);
    assert.match(APP, /onClearRoute:\s*handleClearPins/);
    assert.match(APP, /canClearRouteNow:\s*\(\)\s*=>\s*!routeClearBlockedByRide/);
  });

  it("확인 창: 「주행 종료」=기존 종료 흐름, 「계속 주행」=창만 닫기", () => {
    const i = APP.indexOf("<RouteClearBlockedDialog");
    assert.ok(i >= 0);
    const jsx = APP.slice(i, APP.indexOf("/>", i));
    assert.match(jsx, /handleEndRideWithTrailCleanup\(\)/);
    assert.match(jsx, /onContinue=\{\(\) => setRouteClearBlockedOpen\(false\)\}/);
    assert.doesNotMatch(jsx, /clearRoutePins|handleClearPins/, "종료가 경로를 자동으로 지우면 안 됨");
  });

  it("다른 잠금은 그대로: PROD 조건 유지", () => {
    assert.match(read("src/lib/route/routeWorkspaceLock.ts"), /import\.meta\.env\.PROD && sessionNotIdle/);
    assert.match(APP, /lockRouteWorkspaceDuringRide\(rideStatus !== "idle"\)/);
  });
});

describe("지도 경로 창: 주행 중엔 팝업 상태를 지우지 않는다", () => {
  it("mapPopupElements — canClearRouteNow 확인이 핀·거리 선택 초기화보다 앞", () => {
    const src = read("src/components/map/mapPopupElements.ts");
    const i = src.indexOf("clearRouteBtn.onclick = () => {");
    assert.ok(i >= 0);
    const body = src.slice(i, src.indexOf("clearRouteBtn.addEventListener", i));
    const g = body.indexOf("canClearRouteNow");
    assert.ok(g >= 0, "canClearRouteNow 확인 없음");
    assert.ok(g < body.indexOf("pins.start = false"));
    assert.ok(g < body.indexOf("pins.end = false"));
    assert.ok(g < body.indexOf("onClearDistanceAutoRouteCircle"));
    assert.ok(g < body.indexOf("selectedStart = null"));
    assert.ok(g < body.indexOf("closePopup()"));
    assert.match(body, /canClearRouteNow && !canClearRouteNow\(\)\) \{\s*onClearRoute\(\);\s*return;/);
  });

  it("MapView — 막힌 때는 검색 순서·디버그 마커를 건드리기 전에 App 안내로 return", () => {
    const src = read("src/components/map/MapView.tsx");
    const i = src.indexOf("canClearRouteNowRef.current?.() === false");
    assert.ok(i >= 0, "MapView 가드 없음");
    assert.ok(i < src.indexOf("directionSearchSequence += 1", i - 200));
    assert.match(src, /canClearRouteNow:\s*\(\)\s*=>\s*canClearRouteNowRef\.current\?\.\(\) !== false/);
  });
});

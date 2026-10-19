import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { getDistanceMeters } from "../../src/lib/geo/geo.ts";
import { createEntryLocationSession } from "../../src/lib/geo/entryLocation.ts";
import { resolveEntryLocationFlightMs } from "../../src/lib/map/mapBootCenter.ts";

const ts = createRequire(import.meta.url)("typescript");
const source = ts.createSourceFile("MapView.tsx", readFileSync(new URL("../../src/components/map/MapView.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// 실제 MapView의 두 effect를 실행한다. 지도 네트워크·WebGL 없이 카메라 API 인자를 관찰한다.
function effectFor(dependencies, context) {
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect") {
      const deps = node.arguments[1];
      if (deps && ts.isArrayLiteralExpression(deps) && deps.elements.map((item) => item.getText(source)).join(",") === dependencies) callback = node.arguments[0];
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback, `MapView effect: ${dependencies}`);
  const { outputText } = ts.transpileModule(`(() => { const effect = ${callback.getText(source)}; return effect; })();`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
  return runInNewContext(outputText, context);
}

for (const reduced of [false, true]) {
  test(`초기 지역 유지 후 거리 비례 비행 (reduced=${reduced})`, async () => {
    let now = 0;
    let id = 0;
    const timers = new Map();
    const schedule = (fn, ms) => { timers.set(++id, { at: now + ms, fn }); return id; };
    function advance(ms) {
      now += ms;
      for (const [key, timer] of timers) if (timer.at <= now) { timers.delete(key); timer.fn(); }
    }
    let success;
    const session = createEntryLocationSession({
      hasGeolocation: () => true,
      queryPermission: () => Promise.resolve("prompt"),
      readPosition: (_options, handlers) => { success = handlers.onSuccess; },
      setTimeout: schedule,
      clearTimeout: (key) => timers.delete(key),
    }, { center: [12.4905, 41.8902], zoom: 15 });
    const camera = [];
    const context = {
      bootFlyMovedRef: { current: false },
      bootFlyTargetRef: { current: { center: [12.4905, 41.8902], zoom: 15 } },
      bootFlyBypassZoomGuardRef: { current: false },
      bootFlyTarget: null,
      bootFlyHold: true,
      mapLoaded: true,
      mapRef: { current: {
        isMoving: () => false,
        getZoom: () => 15,
        getCenter: () => ({ lng: 12.4905, lat: 41.8902 }),
        flyTo: (options) => camera.push({ method: "flyTo", ...options }),
        jumpTo: (options) => camera.push({ method: "jumpTo", ...options }),
      } },
      getReducedMotionSnapshot: () => reduced,
      performance: { now: () => now },
      suppressCameraFollowUntilRef: { current: 0 },
      getDistanceMeters,
      resolveEntryLocationFlightMs,
      BOOT_GLOBE_ZOOM: 0.6,
      BOOT_GLOBE_PAUSE_MS: 600,
      BOOT_GLOBE_FLY_MS: 3500,
      window: { setTimeout: schedule, clearTimeout: (key) => timers.delete(key) },
    };
    const updateTarget = effectFor("bootFlyTarget", context);
    const move = effectFor("mapLoaded,bootFlyHold,bootFlyTarget", context);
    session.setEnabled(true);
    await Promise.resolve();
    session.chooseCurrent();
    move();
    advance(24000);
    assert.equal(camera.length, 0, "권한 대기 중에는 확대하지 않음");
    success(126.978, 37.5665);
    const snapshot = session.getSnapshot();
    assert.equal(snapshot.phase, "ready");
    assert.equal(snapshot.notice, null);
    context.bootFlyTarget = snapshot.target;
    context.bootFlyHold = false;
    updateTarget();
    const cleanup = move();
    advance(600);
    assert.equal(camera.length, 1);
    assert.equal(camera[0].method, reduced ? "jumpTo" : "flyTo");
    const seoulFlightMs = resolveEntryLocationFlightMs(
      getDistanceMeters([12.4905, 41.8902], [126.978, 37.5665]),
    );
    if (!reduced) {
      assert.equal(camera[0].duration, seoulFlightMs);
      assert.ok(camera[0].duration <= 5000);
      assert.equal(camera[0].curve, 1.42);
      assert.equal(camera[0].essential, false);
    }
    assert.deepEqual(Array.from(camera[0].center), [126.978, 37.5665]);
    assert.equal(camera[0].zoom, 15);
    assert.equal(context.bootFlyMovedRef.current, true);
    updateTarget();
    move();
    advance(4000);
    assert.equal(camera.length, 1, "이동을 반복하지 않음");
    cleanup?.();
  });
}


test("비행 시간은 가까우면 짧고 지구 반대편도 5초를 넘지 않는다", () => {
  const rome = [12.4905, 41.8902];
  const nearMs = resolveEntryLocationFlightMs(getDistanceMeters(rome, [12.7, 41.95]));
  const seoulMs = resolveEntryLocationFlightMs(getDistanceMeters(rome, [126.978, 37.5665]));
  const antipodeMs = resolveEntryLocationFlightMs(
    getDistanceMeters(rome, [((rome[0] + 180 + 540) % 360) - 180, -rome[1]]),
  );
  assert.ok(nearMs < 800, `near ${nearMs}`);
  assert.ok(nearMs < seoulMs && seoulMs < antipodeMs);
  assert.ok(seoulMs <= 5000 && antipodeMs <= 5000);
  assert.ok(antipodeMs >= 4900, `antipode ${antipodeMs}`);
});

test("지도 생성자는 지구본 축소 없이 시작 지역과 줌을 사용한다", () => {
  let options;
  function visit(node) {
    if (ts.isNewExpression(node) && node.expression.getText(source) === "mapboxgl.Map") options = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(options);
  const props = Object.fromEntries(options.properties.filter(ts.isPropertyAssignment).map((p) => [p.name.getText(source), p.initializer.getText(source)]));
  assert.equal(props.center, "bootCenter");
  assert.equal(props.zoom, "bootZoom");
});


test("기본 위치를 고르면 같은 화면에서 불필요하게 비행하지 않는다", () => {
  let moved = 0;
  const context = {
    bootFlyMovedRef: { current: false },
    bootFlyTargetRef: { current: {center:[12.4905,41.8902],zoom:15} },
    mapRef: {current:{
      getCenter:()=>({lng:12.4905,lat:41.8902}),getZoom:()=>15,
      jumpTo:()=>{moved++;},flyTo:()=>{moved++;},
    }},
    mapLoaded:true,bootFlyHold:false,
  };
  effectFor("mapLoaded,bootFlyHold,bootFlyTarget",context)();
  assert.equal(moved,0);
  assert.equal(context.bootFlyMovedRef.current,true);
});

for (const queued of ["style.load", "rAF"]) {
  test(`비행 시작 전에 예약된 ${queued} 줌 반영은 비행을 끊지 않는다`, () => {
    let apply;
    let zooms = 0;
    const context = {
      bootFlyTargetRef: { current: null },
      mapLoaded: true, mapZoom: 14,
      holdCameraAfterRideEndRef: { current: false },
      suppressCameraFollowUntilRef: { current: 0 },
      cameraSmoothRef: { current: { zoom: 15 } },
      mapZoomApplyRafRef: { current: null },
      performance: { now: () => 0 },
      requestAnimationFrame: (fn) => { apply = fn; return 1; },
      cancelAnimationFrame: () => {},
      mapRef: { current: {
        getZoom: () => 15,
        isStyleLoaded: () => queued === "rAF",
        once: (_event, fn) => { apply = fn; },
        off: () => {},
        zoomTo: () => { zooms++; },
      } },
    };
    const cleanup = effectFor("mapZoom,mapLoaded", context)();
    assert.equal(typeof apply, "function");
    context.suppressCameraFollowUntilRef.current = 2100;
    apply();
    assert.equal(zooms, 0);
    cleanup();
  });
}

function readApply3DState() {
  const file = ts.createSourceFile("rideCameraFollow.ts", readFileSync(new URL("../../src/components/map/rideCameraFollow.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fn = file.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "apply3DState");
  assert.ok(fn);
  const compiled = ts.transpileModule(`(${fn.getText(file).replace(/^export /, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return runInNewContext(compiled);
}

test("첫 지도 load에서 2D 초기화가 현재 위치 비행을 취소하지 않는다", () => {
  let destination = null;
  const map = {
    getCenter: () => ({lng:12.4905,lat:41.8902}), getZoom: () => 15, getPitch: () => 0,
    setTerrain: () => {}, getLayer: () => null,
    flyTo: (target) => { destination = target.center; },
    easeTo: () => { destination = null; },
  };
  const context = {
    bootFlyMovedRef:{current:false},bootFlyTargetRef:{current:{center:[126.978,37.5665],zoom:15}},
    mapRef:{current:map},mapLoaded:true,bootFlyHold:false,getReducedMotionSnapshot:()=>false,
    suppressCameraFollowUntilRef:{current:0},performance:{now:()=>0},getDistanceMeters,resolveEntryLocationFlightMs,
    enable3D:false,apply3DState:readApply3DState(),BUILDING_LAYER_ID:"buildings",TERRAIN_SOURCE_ID:"terrain",applyMapCutToMap:()=>{},
  };
  effectFor("mapLoaded,bootFlyHold,bootFlyTarget",context)();
  effectFor("enable3D,mapLoaded",context)();
  assert.deepEqual(Array.from(destination ?? []), [126.978,37.5665]);
});

test("3D에서 2D로 실제 전환할 때는 pitch를 0으로 되돌린다", () => {
  let target;
  readApply3DState()({setTerrain:()=>{},getLayer:()=>null,getPitch:()=>60,easeTo:(next)=>{target=next;}},false,"buildings","terrain");
  assert.equal(target.pitch,0);assert.equal(target.duration,400);
});

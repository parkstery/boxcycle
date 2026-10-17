import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createEntryLocationSession } from "../../src/lib/geo/entryLocation.ts";

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
  test(`지연 승인 한국 목적지를 MapView ${reduced ? "jumpTo" : "flyTo"}로 전달`, async () => {
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
        getZoom: () => 0.6,
        flyTo: (options) => camera.push({ method: "flyTo", ...options }),
        jumpTo: (options) => camera.push({ method: "jumpTo", ...options }),
      } },
      getReducedMotionSnapshot: () => reduced,
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
    assert.deepEqual(Array.from(camera[0].center), [126.978, 37.5665]);
    assert.equal(camera[0].zoom, 15);
    assert.equal(context.bootFlyMovedRef.current, true);
    updateTarget();
    move();
    advance(4000);
    assert.equal(camera.length, 1, "이동을 반복하지 않음");
    cleanup();
  });
}

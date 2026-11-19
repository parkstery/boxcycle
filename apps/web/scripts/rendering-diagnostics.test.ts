import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resetPerfLabForTests } from "../src/lib/debug/perfLab.ts";
import { attachRenderingDiagnostics, noteRenderingDiagnostic, readRenderingDiagnostics, RENDERING_EVENT_LIMIT } from "../src/lib/debug/renderingDiagnostics.ts";

const originalWindow = globalThis.window;
afterEach(() => {
  if (originalWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else globalThis.window = originalWindow;
  resetPerfLabForTests();
});
function setup(enabled: boolean) {
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: { location: { search: enabled ? "?perflab=1" : "" } } });
  resetPerfLabForTests();
  const canvas = new EventTarget();
  let lost = false;
  const gl = { drawingBufferWidth: 1200, drawingBufferHeight: 540, isContextLost: () => lost };
  Object.assign(canvas, { width: 1200, height: 540, getBoundingClientRect: () => ({ width: 800, height: 360 }), getContext: () => gl });
  const map = { getCanvas: () => canvas, getContainer: () => ({ dataset: { terrainView: "auto-2d" } }), getTerrain: () => ({ exaggeration: 0 }),
    getStyle: () => ({ layers: [{ id: "boxcycle-3d-buildings", type: "fill-extrusion" }] }),
    getLayer: (id: string) => id === "boxcycle-rider-preserved-layer" ? { id, type: "custom" } : undefined,
    getLayoutProperty: () => "none" };
  return { canvas, map, setLost: (value: boolean) => { lost = value; } };
}
test("disabled diagnostics never touch the map", () => {
  setup(false);
  attachRenderingDiagnostics({ getCanvas: () => { throw Error("must not touch"); } })();
});
test("records loss and restoration without intercepting recovery, retains prior loss after recovery, detaches", () => {
  const { map, canvas, setLost } = setup(true);
  const detach = attachRenderingDiagnostics(map);
  setLost(true);
  const event = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  setLost(false); canvas.dispatchEvent(new Event("webglcontextrestored"));
  const report = readRenderingDiagnostics();
  assert.equal(report.state?.drawingBufferWidth, 1200);
  assert.equal(report.state?.contextLost, false);
  assert.equal(report.events.find(e => e.kind === "context-lost")?.state?.contextLost, true);
  assert.equal(report.state?.buildings[0]?.visibility, "none");
  assert.equal(report.state?.riderLayerPresent, true, "custom rider exists even when omitted from serialized getStyle");
  detach(); canvas.dispatchEvent(new Event("webglcontextlost"));
  assert.equal(readRenderingDiagnostics().totalEvents, report.totalEvents);
  assert.equal(readRenderingDiagnostics().attached, false);
});
test("deduplicates health observations, bounds history, isolates copied reports and starts a fresh map history", () => {
  const { map } = setup(true);
  const detach = attachRenderingDiagnostics(map);
  noteRenderingDiagnostic("terrain-health", "missing");
  noteRenderingDiagnostic("terrain-health", "missing");
  assert.equal(readRenderingDiagnostics().totalEvents, 2);
  for (let i = 0; i < 200; i++) noteRenderingDiagnostic("terrain-health", String(i));
  const report = readRenderingDiagnostics();
  assert.equal(report.events.length, RENDERING_EVENT_LIMIT);
  assert.equal(report.droppedEvents, 82);
  report.events[0]!.state!.buildings[0]!.visibility = "changed";
  assert.equal(readRenderingDiagnostics().events[0]!.state!.buildings[0]!.visibility, "none");
  detach(); const detachAgain = attachRenderingDiagnostics(map);
  assert.equal(readRenderingDiagnostics().totalEvents, 1);
  detachAgain();
});

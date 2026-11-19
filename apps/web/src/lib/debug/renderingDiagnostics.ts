/** Opt-in local diagnostics. No polling, server writes, or context recovery changes. */
import type { Map as MapboxMap } from "mapbox-gl";
import { isPerfLabEnabled } from "./perfLab";
import { getRiderMapMaxPixelRatio } from "../map/rtwMapConfig";

export const RENDERING_EVENT_LIMIT = 120;
type DiagnosticMap = Pick<MapboxMap, "getCanvas" | "getContainer" | "getTerrain" | "getStyle" | "getLayoutProperty" | "getLayer">;
type RenderingEvent = { at: string; elapsedMs: number; kind: string; detail: string; state: ReturnType<typeof readScene> };
let activeMap: DiagnosticMap | null = null;
let events: RenderingEvent[] = [];
let latest: Record<string, string> = {};
let totalEvents = 0;

function readScene() {
  try {
    if (!activeMap) return null;
    const canvas = activeMap.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const layers = activeMap.getStyle()?.layers ?? [];
    return {
      requestedDprCap: getRiderMapMaxPixelRatio(),
      cssWidth: rect.width, cssHeight: rect.height,
      canvasWidth: canvas.width, canvasHeight: canvas.height,
      drawingBufferWidth: gl?.drawingBufferWidth ?? null,
      drawingBufferHeight: gl?.drawingBufferHeight ?? null,
      contextLost: gl?.isContextLost() ?? null,
      terrain: activeMap.getTerrain() ?? null,
      terrainView: activeMap.getContainer().dataset.terrainView ?? null,
      buildings: layers.filter(layer => layer.type === "fill-extrusion" && layer.id.includes("building"))
        .map(layer => ({ id: layer.id, visibility: activeMap!.getLayoutProperty(layer.id, "visibility") ?? "visible" })),
      // getStyle() serialization omits custom layers; query the live layer registry.
      riderLayerPresent: Boolean(activeMap.getLayer("boxcycle-rider-preserved-layer")),
    };
  } catch {
    // A style/context may be unavailable during precisely the event being recorded.
    return null;
  }
}

export function noteRenderingDiagnostic(kind: string, detail: string): void {
  if (!isPerfLabEnabled() || !activeMap) return;
  if (latest[kind] === detail && kind !== "context-lost" && kind !== "context-restored") return;
  latest[kind] = detail;
  totalEvents += 1;
  events.push({ at: new Date().toISOString(), elapsedMs: performance.now(), kind, detail, state: readScene() });
  if (events.length > RENDERING_EVENT_LIMIT) events.shift();
}

export function readRenderingDiagnostics() {
  return {
    attached: activeMap !== null,
    state: readScene(), latest: { ...latest },
    totalEvents, droppedEvents: totalEvents - events.length,
    events: events.map(event => structuredClone(event)),
  };
}

export function attachRenderingDiagnostics(map: object): () => void {
  if (!isPerfLabEnabled()) return () => {};
  const target = map as DiagnosticMap;
  const canvas = target.getCanvas();
  activeMap = target;
  events = []; latest = {}; totalEvents = 0;
  // Do not preventDefault: Mapbox owns context restoration.
  const lost = () => noteRenderingDiagnostic("context-lost", "webglcontextlost");
  const restored = () => noteRenderingDiagnostic("context-restored", "webglcontextrestored");
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  noteRenderingDiagnostic("attached", "history-starts-here");
  return () => {
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
    if (activeMap === target) activeMap = null;
  };
}

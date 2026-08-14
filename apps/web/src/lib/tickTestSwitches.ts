/**
 * U-7 DEV — 주행 중 톡 소거용 스위치. 프로덕션 경로는 전부 early-return.
 * true = 기능 켜짐(d4c8fbf 와 동일). false = 해당 요소만 끔.
 */

import { RIDER_GLB_MODEL_LAYER_ID } from "./riderPrototype/config";

export const TICK_TEST_KEYS = ["follow", "labels", "rider", "mapstop"] as const;
export type TickTestKey = (typeof TICK_TEST_KEYS)[number];

export type TickTestState = Record<TickTestKey, boolean>;

const DEFAULT_STATE: TickTestState = {
  follow: true,
  labels: true,
  rider: true,
  mapstop: true,
};

let state: TickTestState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();
let offCacheKey = "";
let offCache: TickTestKey[] = [];

const symbolVisByMap = new WeakMap<mapboxgl.Map, Map<string, string>>();
const riderVisByMap = new WeakMap<mapboxgl.Map, string>();
const hooked = new WeakSet<mapboxgl.Map>();

function notify(): void {
  offCacheKey = "";
  for (const fn of listeners) fn();
}

function parseQueryOff(): TickTestKey[] {
  if (typeof window === "undefined") return [];
  const raw = new URLSearchParams(window.location.search).get("tickTest") ?? "";
  const off: TickTestKey[] = [];
  for (const part of raw.split(/[,+|]/)) {
    const k = part.trim().toLowerCase();
    if ((TICK_TEST_KEYS as readonly string[]).includes(k)) off.push(k as TickTestKey);
  }
  return off;
}

function initFromQuery(): void {
  if (!import.meta.env.DEV) return;
  const off = parseQueryOff();
  state = { ...DEFAULT_STATE };
  for (const k of off) state[k] = false;
}

export function subscribeTickTest(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getTickTestState(): TickTestState {
  return state;
}

export function getTickTestOffList(): TickTestKey[] {
  const key = TICK_TEST_KEYS.map((k) => (state[k] ? "1" : "0")).join("");
  if (key === offCacheKey) return offCache;
  offCacheKey = key;
  offCache = TICK_TEST_KEYS.filter((k) => !state[k]);
  return offCache;
}

export function isTickTestFollowOn(): boolean {
  if (!import.meta.env.DEV) return true;
  return state.follow;
}

export function isTickTestMapStopOn(): boolean {
  if (!import.meta.env.DEV) return true;
  return state.mapstop;
}

export function setTickTestKey(key: TickTestKey, on: boolean): TickTestState {
  if (!import.meta.env.DEV) return state;
  if (state[key] === on) return state;
  state = { ...state, [key]: on };
  notify();
  return state;
}

export function resetTickTest(): TickTestState {
  if (!import.meta.env.DEV) return state;
  state = { ...DEFAULT_STATE };
  notify();
  return state;
}

function readLayerVisibility(map: mapboxgl.Map, layerId: string): string {
  try {
    const raw = map.getLayoutProperty(layerId, "visibility");
    return typeof raw === "string" && raw.length > 0 ? raw : "visible";
  } catch {
    return "visible";
  }
}

function hideSymbols(map: mapboxgl.Map): void {
  const layers = map.getStyle()?.layers ?? [];
  let saved = symbolVisByMap.get(map);
  if (!saved) {
    saved = new Map();
    symbolVisByMap.set(map, saved);
  }
  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    if (!saved.has(layer.id)) {
      saved.set(layer.id, readLayerVisibility(map, layer.id));
    }
    try {
      map.setLayoutProperty(layer.id, "visibility", "none");
    } catch {
      /* style switching */
    }
  }
}

function restoreSymbols(map: mapboxgl.Map): void {
  const saved = symbolVisByMap.get(map);
  if (!saved) return;
  for (const [id, vis] of saved) {
    if (!map.getLayer(id)) continue;
    try {
      map.setLayoutProperty(id, "visibility", vis);
    } catch {
      /* style switching */
    }
  }
  symbolVisByMap.delete(map);
}

function applyRiderLayer(map: mapboxgl.Map): void {
  if (!map.getLayer(RIDER_GLB_MODEL_LAYER_ID)) return;
  if (state.rider && !riderVisByMap.has(map)) return;
  try {
    if (!state.rider) {
      if (!riderVisByMap.has(map)) {
        riderVisByMap.set(map, readLayerVisibility(map, RIDER_GLB_MODEL_LAYER_ID));
      }
      map.setLayoutProperty(RIDER_GLB_MODEL_LAYER_ID, "visibility", "none");
      return;
    }
    const prev = riderVisByMap.get(map);
    if (prev != null) {
      map.setLayoutProperty(RIDER_GLB_MODEL_LAYER_ID, "visibility", prev);
      riderVisByMap.delete(map);
    }
  } catch {
    /* style switching */
  }
}

export function applyTickTestToMap(map: mapboxgl.Map): void {
  if (!import.meta.env.DEV) return;
  if (!map.getStyle()?.layers?.length) return;
  if (state.labels) restoreSymbols(map);
  else hideSymbols(map);
  applyRiderLayer(map);
}

export function installTickTestMapHooks(map: mapboxgl.Map): void {
  if (!import.meta.env.DEV || hooked.has(map)) return;
  hooked.add(map);
  map.on("style.load", () => {
    symbolVisByMap.delete(map);
    riderVisByMap.delete(map);
    applyTickTestToMap(map);
  });
  map.on("styledata", () => {
    if (!state.labels) hideSymbols(map);
    if (!state.rider) applyRiderLayer(map);
  });
}

function publishApi(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const api = {
    follow: (on: boolean) => setTickTestKey("follow", on),
    labels: (on: boolean) => setTickTestKey("labels", on),
    rider: (on: boolean) => setTickTestKey("rider", on),
    mapstop: (on: boolean) => setTickTestKey("mapstop", on),
    reset: () => resetTickTest(),
    off: () => getTickTestOffList(),
    state: () => ({ ...state }),
  };
  (window as Window & { __rtwTick?: typeof api }).__rtwTick = api;
}

if (import.meta.env.DEV) {
  initFromQuery();
  publishApi();
}

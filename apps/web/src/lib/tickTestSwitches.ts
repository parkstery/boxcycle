/**
 * U-7 DEV — 주행 중 톡 소거용 스위치. 프로덕션 경로는 전부 early-return.
 * true = 기능 켜짐(d4c8fbf 와 동일). false = 해당 요소만 끔.
 *
 * getStyle() 는 스타일 미완성 시 throw 한다. isStyleLoaded() 는 위성+3D 에서
 * 영구 false 일 수 있어 유일한 게이트로 쓰지 않는다. 시트 미준비면 넘기고
 * style.load / styledata / idle 에서 다시 시도한다.
 */

import { RIDER_GLB_MODEL_LAYER_ID } from "./riderPrototype/config";

export const TICK_TEST_KEYS = ["follow", "labels", "rider", "mapstop", "poslag"] as const;
export type TickTestKey = (typeof TICK_TEST_KEYS)[number];

export type TickTestState = Record<TickTestKey, boolean>;

const DEFAULT_STATE: TickTestState = {
  follow: true,
  labels: true,
  rider: true,
  mapstop: true,
  poslag: true,
};

let state: TickTestState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();
let offCacheKey = "";
let offCache: TickTestKey[] = [];

const symbolVisByMap = new WeakMap<mapboxgl.Map, Map<string, "visible" | "none">>();
const riderVisByMap = new WeakMap<mapboxgl.Map, "visible" | "none">;
const hooked = new WeakSet<mapboxgl.Map>();

type MapWithStyleObj = mapboxgl.Map & { style?: unknown };

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

/** true = 카메라 중심이 τ=0.1s 로 라이더를 지연 추종(현행). false = 위치 lerp 계수 1. */
export function isTickTestPosLagOn(): boolean {
  if (!import.meta.env.DEV) return true;
  return state.poslag;
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

function warnTickTest(scope: string, err: unknown): void {
  console.warn(`[tickTest] ${scope} failed`, err);
}

/** getStyle() 호출 전 — Style 객체 부착만 본다. isStyleLoaded() 와 무관. */
function styleObjectPresent(map: mapboxgl.Map): boolean {
  return Boolean((map as MapWithStyleObj).style);
}

function tryGetStyleLayers(map: mapboxgl.Map): { id: string; type?: string }[] | null {
  if (!styleObjectPresent(map)) return null;
  try {
    return map.getStyle()?.layers ?? null;
  } catch {
    return null;
  }
}

function readLayerVisibility(map: mapboxgl.Map, layerId: string): "visible" | "none" {
  try {
    const raw = map.getLayoutProperty(layerId, "visibility");
    return raw === "none" ? "none" : "visible";
  } catch (err) {
    warnTickTest("readLayerVisibility", err);
    return "visible";
  }
}

function hideSymbols(map: mapboxgl.Map): void {
  try {
    const layers = tryGetStyleLayers(map);
    if (!layers?.length) return;
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
      } catch (err) {
        warnTickTest(`hideSymbols ${layer.id}`, err);
      }
    }
  } catch (err) {
    warnTickTest("hideSymbols", err);
  }
}

function restoreSymbols(map: mapboxgl.Map): void {
  const saved = symbolVisByMap.get(map);
  if (!saved) return;
  try {
    if (!tryGetStyleLayers(map)) return;
    for (const [id, vis] of saved) {
      try {
        if (!map.getLayer(id)) continue;
        map.setLayoutProperty(id, "visibility", vis);
      } catch (err) {
        warnTickTest(`restoreSymbols ${id}`, err);
      }
    }
    symbolVisByMap.delete(map);
  } catch (err) {
    warnTickTest("restoreSymbols", err);
  }
}

function applyRiderLayer(map: mapboxgl.Map): void {
  try {
    if (!tryGetStyleLayers(map)) return;
    if (!map.getLayer(RIDER_GLB_MODEL_LAYER_ID)) return;
    if (state.rider && !riderVisByMap.has(map)) return;
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
  } catch (err) {
    warnTickTest("applyRiderLayer", err);
  }
}

export function applyTickTestToMap(map: mapboxgl.Map): void {
  if (!import.meta.env.DEV) return;
  try {
    const layers = tryGetStyleLayers(map);
    if (!layers?.length) return;
    if (state.labels) restoreSymbols(map);
    else hideSymbols(map);
    applyRiderLayer(map);
  } catch (err) {
    warnTickTest("applyTickTestToMap", err);
  }
}

export function installTickTestMapHooks(map: mapboxgl.Map): void {
  if (!import.meta.env.DEV || hooked.has(map)) return;
  hooked.add(map);
  const retry = () => {
    applyTickTestToMap(map);
  };
  map.on("style.load", () => {
    symbolVisByMap.delete(map);
    riderVisByMap.delete(map);
    retry();
  });
  map.on("styledata", retry);
  map.on("idle", retry);
}

function publishApi(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const api = {
    follow: (on: boolean) => setTickTestKey("follow", on),
    labels: (on: boolean) => setTickTestKey("labels", on),
    rider: (on: boolean) => setTickTestKey("rider", on),
    mapstop: (on: boolean) => setTickTestKey("mapstop", on),
    poslag: (on: boolean) => setTickTestKey("poslag", on),
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

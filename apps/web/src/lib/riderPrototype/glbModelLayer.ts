import type { Map as MapboxMap, Source } from "mapbox-gl";
import {
  RIDER_GLB_MODEL_LAYER_ID,
  RIDER_GLB_MODEL_SOURCE_ID,
  bearingToModelYawDeg,
  riderPrototypeGlbUrl,
} from "./config";
import type { RiderGlbModelSpec } from "./iso2dMarker";

type ModelSource = Source & {
  setModels: (models: Record<string, unknown>) => void;
};

let layerReady = false;

export function ensureRiderGlbLayer(map: MapboxMap): boolean {
  if (!map.style) return false;
  try {
    if (!map.getSource(RIDER_GLB_MODEL_SOURCE_ID)) {
      map.addSource(RIDER_GLB_MODEL_SOURCE_ID, {
        type: "model",
        models: {},
      });
    }
    if (!map.getLayer(RIDER_GLB_MODEL_LAYER_ID)) {
      map.addLayer({
        id: RIDER_GLB_MODEL_LAYER_ID,
        type: "model",
        source: RIDER_GLB_MODEL_SOURCE_ID,
      } as Parameters<MapboxMap["addLayer"]>[0]);
    }
    layerReady = true;
    return true;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[riderPrototype] GLB layer init failed", e);
    }
    layerReady = false;
    return false;
  }
}

export function syncRiderGlbModels(map: MapboxMap, specs: readonly RiderGlbModelSpec[]): void {
  if (!ensureRiderGlbLayer(map)) return;
  const src = map.getSource(RIDER_GLB_MODEL_SOURCE_ID) as ModelSource | undefined;
  if (!src?.setModels) return;

  const glbUrl = riderPrototypeGlbUrl();
  const models: Record<string, unknown> = {};
  for (const s of specs) {
    const [lng, lat] = s.lngLat;
    models[s.id] = {
      uri: glbUrl,
      position: [lng, lat],
      orientation: [0, 0, bearingToModelYawDeg(s.bearingDeg)],
    };
  }
  try {
    src.setModels(models);
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[riderPrototype] setModels failed", e);
  }
}

export function clearRiderGlbModels(map: MapboxMap | null): void {
  if (!map || !layerReady) return;
  const src = map.getSource(RIDER_GLB_MODEL_SOURCE_ID) as ModelSource | undefined;
  try {
    src?.setModels?.({});
  } catch {
    /* noop */
  }
}

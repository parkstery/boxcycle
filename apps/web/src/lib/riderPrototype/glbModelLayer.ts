import type { Map as MapboxMap, Source } from "mapbox-gl";
import {
  RIDER_GLB_CRANK_STATE_KEY,
  RIDER_GLB_LEG_L_SHIN_STATE_KEY,
  RIDER_GLB_LEG_L_STATE_KEY,
  RIDER_GLB_LEG_R_SHIN_STATE_KEY,
  RIDER_GLB_LEG_R_STATE_KEY,
  RIDER_GLB_MODEL_LAYER_ID,
  RIDER_GLB_MODEL_SOURCE_ID,
  RIDER_GLB_NODE_OVERRIDE_NAMES,
  bearingToModelYawDeg,
  riderPrototypeGlbUrl,
} from "./config";
import type { RiderGlbModelSpec } from "./iso2dMarker";
import type { RiderGlbPedalPose } from "../riderGlbPedalPose";

type ModelSource = Source & {
  setModels: (models: Record<string, unknown>) => void;
};

let layerReady = false;

const RIDER_GLB_LAYER_PAINT = {
  "model-rotation": [
    "match",
    ["get", "part"],
    "crank",
    ["feature-state", RIDER_GLB_CRANK_STATE_KEY],
    "leg_l",
    ["feature-state", RIDER_GLB_LEG_L_STATE_KEY],
    "leg_l_shin",
    ["feature-state", RIDER_GLB_LEG_L_SHIN_STATE_KEY],
    "leg_r",
    ["feature-state", RIDER_GLB_LEG_R_STATE_KEY],
    "leg_r_shin",
    ["feature-state", RIDER_GLB_LEG_R_SHIN_STATE_KEY],
    [0, 0, 0],
  ],
} as Record<string, unknown>;

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
        paint: RIDER_GLB_LAYER_PAINT,
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

export function syncRiderGlbPedalFeatureState(
  map: MapboxMap,
  modelId: string,
  pose: RiderGlbPedalPose,
): void {
  try {
    map.setFeatureState(
      { source: RIDER_GLB_MODEL_SOURCE_ID, sourceLayer: "", id: modelId },
      {
        [RIDER_GLB_CRANK_STATE_KEY]: [0, 0, pose.crankRotationDeg],
        [RIDER_GLB_LEG_L_STATE_KEY]: pose.legLRotationDeg,
        [RIDER_GLB_LEG_L_SHIN_STATE_KEY]: pose.legLShinRotationDeg,
        [RIDER_GLB_LEG_R_STATE_KEY]: pose.legRRotationDeg,
        [RIDER_GLB_LEG_R_SHIN_STATE_KEY]: pose.legRShinRotationDeg,
      },
    );
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[riderPrototype] setFeatureState pedal pose failed", e);
    }
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
      nodeOverrideNames: [...RIDER_GLB_NODE_OVERRIDE_NAMES],
    };
  }
  try {
    src.setModels(models);
    for (const s of specs) {
      if (s.pedalPose) syncRiderGlbPedalFeatureState(map, s.id, s.pedalPose);
    }
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

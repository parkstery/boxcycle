import type { Map as MapboxMap, Source } from "mapbox-gl";
import {
  RIDER_GLB_ARM_L_FORE_STATE_KEY,
  RIDER_GLB_ARM_L_STATE_KEY,
  RIDER_GLB_ARM_R_FORE_STATE_KEY,
  RIDER_GLB_PEDAL_L_STATE_KEY,
  RIDER_GLB_PEDAL_R_STATE_KEY,
  RIDER_GLB_ARM_R_STATE_KEY,
  RIDER_GLB_CRANK_STATE_KEY,
  RIDER_GLB_LEG_L_SHIN_STATE_KEY,
  RIDER_GLB_LEG_L_STATE_KEY,
  RIDER_GLB_LEG_R_SHIN_STATE_KEY,
  RIDER_GLB_LEG_R_STATE_KEY,
  RIDER_GLB_MODEL_LAYER_ID,
  RIDER_GLB_MODEL_SOURCE_ID,
  RIDER_GLB_NODE_OVERRIDE_NAMES,
  RIDER_GLB_TORSO_STATE_KEY,
  bearingToModelYawDeg,
  riderPrototypeGlbUrl,
} from "./config";
import type { RiderGlbModelSpec } from "./iso2dMarker";
import type { RiderGlbPedalPose } from "../riderGlbPedalPose";

type ModelSource = Source & {
  setModels: (models: Record<string, unknown>) => void;
};

const RIDER_GLB_LAYER_PAINT = {
  "model-elevation-reference": "ground",
  /**
   * 스케일 보정 — rider-lowpoly.glb 실측 AABB 전고 1.263m(자전거 길이 1.60m)로
   * 라이딩 자세 실제치(~1.45m)보다 저스케일. 1.15배로 보정(전고 ≈1.45m, 길이 ≈1.84m).
   * 모델 교체 시 재실측 후 조정할 것.
   */
  "model-scale": [1.15, 1.15, 1.15],
  "model-rotation": [
    "match",
    ["get", "part"],
    "crank",
    ["feature-state", RIDER_GLB_CRANK_STATE_KEY],
    "torso",
    ["feature-state", RIDER_GLB_TORSO_STATE_KEY],
    "leg_l",
    ["feature-state", RIDER_GLB_LEG_L_STATE_KEY],
    "leg_l_shin",
    ["feature-state", RIDER_GLB_LEG_L_SHIN_STATE_KEY],
    "leg_r",
    ["feature-state", RIDER_GLB_LEG_R_STATE_KEY],
    "leg_r_shin",
    ["feature-state", RIDER_GLB_LEG_R_SHIN_STATE_KEY],
    "arm_l",
    ["feature-state", RIDER_GLB_ARM_L_STATE_KEY],
    "arm_l_fore",
    ["feature-state", RIDER_GLB_ARM_L_FORE_STATE_KEY],
    "arm_r",
    ["feature-state", RIDER_GLB_ARM_R_STATE_KEY],
    "arm_r_fore",
    ["feature-state", RIDER_GLB_ARM_R_FORE_STATE_KEY],
    "pedal_l",
    ["feature-state", RIDER_GLB_PEDAL_L_STATE_KEY],
    "pedal_r",
    ["feature-state", RIDER_GLB_PEDAL_R_STATE_KEY],
    [0, 0, 0],
  ],
} as Record<string, unknown>;

export function ensureRiderGlbLayer(map: MapboxMap): boolean {
  // 스타일시트 파싱 전엔 addSource/addLayer가 "Style is not done loading"으로 throw —
  // 조용히 false 반환(호출부가 주기 재시도). isStyleLoaded()는 라이브 소스 타일 갱신 중
  // false라 게이트로 부적합(applyRtwLayerStyle과 동일 기준: getStyle().layers 존재만 확인).
  if (!map.getStyle()?.layers?.length) return false;
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
    return true;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[riderPrototype] GLB layer init failed", e);
    }
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
        [RIDER_GLB_TORSO_STATE_KEY]: pose.torsoRotationDeg,
        [RIDER_GLB_LEG_L_STATE_KEY]: pose.legLRotationDeg,
        [RIDER_GLB_LEG_L_SHIN_STATE_KEY]: pose.legLShinRotationDeg,
        [RIDER_GLB_LEG_R_STATE_KEY]: pose.legRRotationDeg,
        [RIDER_GLB_LEG_R_SHIN_STATE_KEY]: pose.legRShinRotationDeg,
        [RIDER_GLB_ARM_L_STATE_KEY]: pose.armLRotationDeg,
        [RIDER_GLB_ARM_L_FORE_STATE_KEY]: pose.armLForeRotationDeg,
        [RIDER_GLB_ARM_R_STATE_KEY]: pose.armRRotationDeg,
        [RIDER_GLB_ARM_R_FORE_STATE_KEY]: pose.armRForeRotationDeg,
        [RIDER_GLB_PEDAL_L_STATE_KEY]: pose.pedalLRotationDeg,
        [RIDER_GLB_PEDAL_R_STATE_KEY]: pose.pedalRRotationDeg,
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
      // index 0 = 코너링 린(진행축 롤) — yaw(z) 선적용 후 x 롤이 모델 전진축 기준이 되는 규약
      orientation: [s.leanDeg ?? 0, 0, bearingToModelYawDeg(s.bearingDeg)],
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
  if (!map) return;
  const src = map.getSource(RIDER_GLB_MODEL_SOURCE_ID) as ModelSource | undefined;
  try {
    src?.setModels?.({});
  } catch {
    /* noop */
  }
}

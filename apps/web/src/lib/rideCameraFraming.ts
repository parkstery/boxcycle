import type { Map as MapboxMap } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import type { LngLat } from "./geo";
import { offsetLngLatByBearingMeters } from "./geo";
import { HEAD_C, PELVIS_ROOT, SHOULDER_HALF_Z } from "./riderPrototype/riderRig";
import { RIDER_GLB_MODEL_SCALE } from "./riderPrototype/config";

/**
 * 경로 프레이밍과 동일한 HUD 안전 영역 (MapView fitBounds padding).
 * 주행 추적 zoom·판정도 이 값을 쓴다.
 */
export const RIDE_HUD_SAFE_PADDING = {
  top: 52,
  bottom: 120,
  left: 44,
  right: 44,
} as const;

/**
 * 생성기 SoT = `riderRig.geometry.mjs` ← `geometry.json` 파생.
 * 전고 = 머리 중심 world y (`HEAD_C[1]`). 헬멧 반구·여유는 비율만 곱한다.
 */
export const RIDER_HEAD_C_Y_M = HEAD_C[1];
export const RIDER_PELVIS_Y_M = PELVIS_ROOT[1];

/** 화면에 그려지는 전고(m) = rig 머리 y × GLB model-scale */
export const RIDER_DISPLAY_HEIGHT_M = RIDER_HEAD_C_Y_M * RIDER_GLB_MODEL_SCALE;

/** look-at 높이(m) = 골반 world y × 동일 scale */
export const RIDER_LOOK_AT_HEIGHT_M = RIDER_PELVIS_Y_M * RIDER_GLB_MODEL_SCALE;

/** 전고 대비 세로 여유 — 새 인체 상수가 아니라 HEAD_C 의 비율 */
const RIDER_HEIGHT_SPAN_MARGIN = 1.12;

export type RideFollowFraming = {
  center: LngLat;
  zoom: number;
};

export function viewportPxFromMap(map: MapboxMap): { width: number; height: number } {
  const el = map.getContainer();
  return {
    width: Math.max(1, el.clientWidth || 1),
    height: Math.max(1, el.clientHeight || 1),
  };
}

export function rideSafeViewportPx(viewportWidthPx: number, viewportHeightPx: number): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(1, viewportWidthPx - RIDE_HUD_SAFE_PADDING.left - RIDE_HUD_SAFE_PADDING.right),
    height: Math.max(1, viewportHeightPx - RIDE_HUD_SAFE_PADDING.top - RIDE_HUD_SAFE_PADDING.bottom),
  };
}

/**
 * 스냅(MapView)과 틱(rideCameraFollow)이 함께 부르는 유일한 주행 구도 계산.
 * pitch 는 호출부가 넘긴 값을 유지한다(여기서 눕히지 않음).
 */
export function computeRideFollowFraming(input: {
  riderLngLat: LngLat;
  offsetBearing: number | null;
  distanceM: number;
  pitchDeg: number;
  viewportWidthPx: number;
  viewportHeightPx: number;
  fallbackZoom: number;
}): RideFollowFraming {
  const { riderLngLat, offsetBearing, distanceM, pitchDeg, fallbackZoom } = input;
  if (!(distanceM > 0) || offsetBearing == null) {
    return { center: riderLngLat, zoom: fallbackZoom };
  }

  const depressionRad = ((90 - pitchDeg) * Math.PI) / 180;
  const tanDep = Math.tan(Math.max(0.017, depressionRad));
  const lookAtAlongViewM = RIDER_LOOK_AT_HEIGHT_M / tanDep;
  const viewBearing = ((offsetBearing + 180) % 360 + 360) % 360;
  const center = offsetLngLatByBearingMeters(riderLngLat, viewBearing, lookAtAlongViewM);

  const safe = rideSafeViewportPx(input.viewportWidthPx, input.viewportHeightPx);
  const heightSpanM = RIDER_DISPLAY_HEIGHT_M * RIDER_HEIGHT_SPAN_MARGIN;
  const spanM = Math.max(heightSpanM, distanceM);
  const latRad = (riderLngLat[1] * Math.PI) / 180;
  const targetMetersPerPixel = spanM / safe.height;
  const mppAtZ0 = 156543.03392 * Math.cos(latRad);
  let zoom = Math.log2(mppAtZ0 / Math.max(1e-9, targetMetersPerPixel));
  zoom -= (pitchDeg / 90) * 0.6;
  return { center, zoom };
}

type MapWithTransform = MapboxMap & {
  transform?: {
    locationPoint3D?: (loc: { lng: number; lat: number; altitude?: number }) => { x: number; y: number };
    worldSize?: number;
    pixelMatrix?: ArrayLike<number>;
  };
};

/** 지면 + 고도(m)를 화면 픽셀로. GLB elevation-reference=ground 와 같은 세계 높이. */
export function projectLngLatAltitude(
  map: MapboxMap,
  lngLat: LngLat,
  altitudeM: number,
): { x: number; y: number } {
  const ground = map.project({ lng: lngLat[0], lat: lngLat[1] });
  if (!Number.isFinite(ground.x) || !Number.isFinite(ground.y)) return { x: 0, y: 0 };
  if (!(altitudeM > 0)) return { x: ground.x, y: ground.y };

  const cam = map.getFreeCameraOptions()?.position;
  const foot = mapboxgl.MercatorCoordinate.fromLngLat({ lng: lngLat[0], lat: lngLat[1] }, 0);
  let distM = 0;
  if (cam && typeof foot.meterInMercatorCoordinateUnits === "function") {
    const mPer = foot.meterInMercatorCoordinateUnits();
    if (mPer > 0) {
      const dx = (cam.x - foot.x) / mPer;
      const dy = (cam.y - foot.y) / mPer;
      const dz = ((cam.z ?? 0) - (foot.z ?? 0)) / mPer;
      distM = Math.hypot(dx, dy, dz);
    }
  }
  const vp = viewportPxFromMap(map);
  const t = (map as MapWithTransform).transform;
  const fovDeg = typeof (t as { fov?: number } | undefined)?.fov === "number" ? (t as { fov: number }).fov : 36.87;
  const pitchRad = (map.getPitch() * Math.PI) / 180;
  if (distM > 0.05) {
    const f = vp.height / 2 / Math.tan((fovDeg * Math.PI) / 360);
    const dyPx = (altitudeM * Math.sin(pitchRad) * f) / distM;
    const y = ground.y - dyPx;
    if (Number.isFinite(y)) return { x: ground.x, y };
  }
  const latRad = (lngLat[1] * Math.PI) / 180;
  const mpp = (156543.03392 * Math.cos(latRad)) / Math.pow(2, map.getZoom());
  return { x: ground.x, y: ground.y - (altitudeM * Math.sin(pitchRad)) / Math.max(1e-9, mpp) };
}

export type RiderScreenDiag = {
  headTopPx: number;
  wheelBottomPx: number;
  leftPx: number;
  rightPx: number;
  viewportW: number;
  viewportH: number;
  inSafeArea: boolean;
};

export function measureRiderScreenDiag(
  map: MapboxMap,
  riderLngLat: LngLat,
  riderHeadingDeg: number,
): RiderScreenDiag {
  const { width: viewportW, height: viewportH } = viewportPxFromMap(map);
  const wheel = projectLngLatAltitude(map, riderLngLat, 0);
  const head = projectLngLatAltitude(map, riderLngLat, RIDER_DISPLAY_HEIGHT_M);
  const halfW = SHOULDER_HALF_Z * RIDER_GLB_MODEL_SCALE;
  const leftLl = offsetLngLatByBearingMeters(riderLngLat, riderHeadingDeg - 90, halfW);
  const rightLl = offsetLngLatByBearingMeters(riderLngLat, riderHeadingDeg + 90, halfW);
  const left = projectLngLatAltitude(map, leftLl, RIDER_LOOK_AT_HEIGHT_M);
  const right = projectLngLatAltitude(map, rightLl, RIDER_LOOK_AT_HEIGHT_M);
  const headTopPx = Math.min(head.y, wheel.y);
  const wheelBottomPx = Math.max(head.y, wheel.y);
  const leftPx = Math.min(left.x, right.x, wheel.x, head.x);
  const rightPx = Math.max(left.x, right.x, wheel.x, head.x);
  const pad = RIDE_HUD_SAFE_PADDING;
  const inSafeArea =
    headTopPx >= pad.top &&
    wheelBottomPx <= viewportH - pad.bottom &&
    leftPx >= pad.left &&
    rightPx <= viewportW - pad.right;
  return { headTopPx, wheelBottomPx, leftPx, rightPx, viewportW, viewportH, inSafeArea };
}

export function publishRiderScreenDiag(diag: RiderScreenDiag | null): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  (window as Window & { __RTW_RIDER_SCREEN_DIAG__?: RiderScreenDiag | null }).__RTW_RIDER_SCREEN_DIAG__ =
    diag;
}

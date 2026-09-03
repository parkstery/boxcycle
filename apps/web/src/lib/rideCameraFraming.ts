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

/**
 * look-at 오프셋 상한 = 화면에 담는 세로 범위(`spanM`)에 대한 비율.
 *
 * `RIDER_LOOK_AT_HEIGHT_M` 은 `RIDER_GLB_MODEL_SCALE` 에 선형 비례하는데 `spanM` 과 달리
 * 보호가 없어, 배율이 커지면 카메라가 겨누는 지점이 라이더에서 달아난다. 20배·pitch 80° 에서
 * 오프셋이 5.51m → 110.16m 로 벌어져 라이더가 화면 밖으로 나갔다(G-3 실측).
 *
 * 0.65 는 실측으로 정했다([G-4 REPORT](../../../../document/ops/giant-relay/REPORT-G4.md) §1).
 * - 상한 0.80 — `inSafeArea` 를 만족하는 오프셋/`spanM` 최대값. `spanM` 10·20·40 m 에서
 *   모두 0.800 으로 같아 비율로 쓸 수 있음을 확인했다(스케일 불변).
 * - 하한 0.551 — factor 1 이 거리 10·20·40 m 에서 실제로 쓰는 오프셋 5.51 m 를 그대로
 *   통과시키는 데 필요한 값(5.51/10). 이보다 작으면 현재 제품의 카메라가 바뀐다.
 * 두 경계 사이의 중앙값이다.
 */
export const RIDE_LOOKAT_SPAN_RATIO = 0.65;

/**
 * 화면에 담는 세로 범위(m). 라이더 전고와 카메라 거리 중 큰 쪽.
 * `displayHeightM` 은 시험이 배율을 바꿔 넣기 위한 주입점 — 앱은 기본값을 쓴다.
 */
export function rideSpanM(distanceM: number, displayHeightM: number = RIDER_DISPLAY_HEIGHT_M): number {
  return Math.max(displayHeightM * RIDER_HEIGHT_SPAN_MARGIN, distanceM);
}

/**
 * 카메라가 겨누는 지점을 라이더에서 얼마나 앞으로 미는가(m).
 * 골반을 화면 중앙에 두려는 값이지만 `spanM` 비율로 상한을 둔다 — 상한이 없으면 배율에
 * 선형 비례해 라이더가 프레임 밖으로 나간다.
 */
export function rideLookAtAlongM(
  pitchDeg: number,
  spanM: number,
  lookAtHeightM: number = RIDER_LOOK_AT_HEIGHT_M,
): number {
  const depressionRad = ((90 - pitchDeg) * Math.PI) / 180;
  const tanDep = Math.tan(Math.max(0.017, depressionRad));
  return Math.min(lookAtHeightM / tanDep, spanM * RIDE_LOOKAT_SPAN_RATIO);
}

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

  // spanM 을 먼저 정한다 — look-at 오프셋이 같은 규칙 아래 묶이려면 상한의 기준이 있어야 한다.
  const spanM = rideSpanM(distanceM);
  const lookAtAlongViewM = rideLookAtAlongM(pitchDeg, spanM);
  const viewBearing = ((offsetBearing + 180) % 360 + 360) % 360;
  const center = offsetLngLatByBearingMeters(riderLngLat, viewBearing, lookAtAlongViewM);

  const safe = rideSafeViewportPx(input.viewportWidthPx, input.viewportHeightPx);
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

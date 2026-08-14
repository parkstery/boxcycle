import type { LngLat, LineStringGeometry } from "../../lib/geo";
import {
  getDistanceMeters,
  headingOnRouteAtPoint,
  type LineStringGeometry as RouteLineStringGeometry,
} from "../../lib/geo";
import type { FollowMode } from "../ride/RideRoutePanel";
import { RIDE_CAMERA_PITCH_CLOSE } from "../../lib/mapGlobeView";
import { computeRideFollowFraming, viewportPxFromMap } from "../../lib/rideCameraFraming";
import {
  beginFollowCameraJump,
  endFollowCameraJump,
  noteFollowJumpTo,
  noteHeadingFromMove,
} from "../../lib/mapTickProbe";
import { noteFollowJumpToValues } from "../../lib/cameraFollowTrace";
import { noteCameraWrite } from "../../lib/cameraRenderPhase";
import { isTickTestFollowOn, isTickTestMapStopOn } from "../../lib/tickTestSwitches";
import { type LiveRiderMotion } from "./mapViewTypes";

const CAMERA_POSITION_TAU_SEC = 0.1;
const CAMERA_BEARING_TAU_PRIMARY_SEC = 0.2;
const CAMERA_BEARING_TAU_SECONDARY_SEC = 0.45;
const CAMERA_BEARING_MAX_DPS_PRIMARY = 280;
const CAMERA_BEARING_MAX_DPS_SECONDARY = 170;
const CAMERA_MAX_DT_MS = 50;
export const CAMERA_BEARING_WINDOW_METERS = 60;
export const CAMERA_BEARING_WINDOW_SAMPLES = 60;

/**
 * 팔로우 모드별 카메라 목표값 — 라이더 밀착(레이싱 게임) 프리셋.
 * bearing: 카메라가 바라보는 방향. offsetBearing: 카메라를 라이더로부터 미는 방향
 * (= bearing 의 반대쪽 — 라이더가 화면에 잡히도록). distanceM: 라이더~카메라 거리(m).
 * pitch 는 enable3D 에 재종속 — 3D(terrain) 에선 밀착 고정값(72/78), 2D(탑다운 평면)에선
 * RIDE_CAMERA_PITCH_FLAT(30, 약간 기울인 추적뷰) 로 완전히 다르게 준다. 2D 에서 72~78° 를 강제하면
 * terrain 없이 지도만 눕게 되어 거리감이 깨진다(회귀 원인) — enable3D=false 일 때 절대 밀착 pitch 쓰지 말 것.
 * north 는 거리 개념이 없어 distanceM=0(라이더 중앙, 기존 pitch 유지, enable3D 무관). free 는 호출부에서 early return.
 */
export function getCameraForFollowMode(input: {
  mode: FollowMode;
  baseHeading: number;
  currentPitch: number;
  distanceM: number;
}): { bearing: number; offsetBearing: number | null; pitch: number; distanceM: number } {
  // 밀착 4방향은 3D(terrain) 유무와 무관하게 준수평 추적 — GoPro/레이싱 뷰.
  // 2D 에선 terrain 이 없어 지도가 눕지만, 이는 라이더 밀착 체험을 위해 의도된 것.
  // maxPitch(85) 아래로 안정적인 RIDE_CAMERA_PITCH_CLOSE(80) 사용.
  const pitchRear = RIDE_CAMERA_PITCH_CLOSE;
  const pitchFront = RIDE_CAMERA_PITCH_CLOSE;
  const pitchSide = RIDE_CAMERA_PITCH_CLOSE;

  if (input.mode === "north") {
    return { bearing: 0, offsetBearing: null, pitch: input.currentPitch, distanceM: 0 };
  }
  if (input.mode === "rear30") {
    const bearing = normalizeCompass(input.baseHeading);
    return { bearing, offsetBearing: normalizeCompass(bearing + 180), pitch: pitchRear, distanceM: input.distanceM };
  }
  if (input.mode === "front30") {
    const bearing = normalizeCompass(input.baseHeading + 180);
    return { bearing, offsetBearing: normalizeCompass(bearing + 180), pitch: pitchFront, distanceM: input.distanceM };
  }
  if (input.mode === "rightFlat") {
    const bearing = normalizeCompass(input.baseHeading + 270);
    return { bearing, offsetBearing: normalizeCompass(bearing + 180), pitch: pitchSide, distanceM: input.distanceM };
  }
  if (input.mode === "leftFlat") {
    const bearing = normalizeCompass(input.baseHeading + 90);
    return { bearing, offsetBearing: normalizeCompass(bearing + 180), pitch: pitchSide, distanceM: input.distanceM };
  }
  return { bearing: normalizeCompass(input.baseHeading), offsetBearing: null, pitch: input.currentPitch, distanceM: 0 };
}

function normalizeCompass(deg: number) {
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

export { offsetLngLatByBearingMeters } from "../../lib/geo";

export function getAverageHeadingAheadFromPoint(
  geometry: RouteLineStringGeometry | null,
  point: LngLat,
  windowMeters: number,
  samples: number,
): number | null {
  if (!geometry || geometry.coordinates.length < 2) return null;
  const currentDistance = getDistanceOnRouteByProjectedPoint(geometry.coordinates, point);
  if (currentDistance == null) return headingOnRouteAtPoint(geometry, point);
  if (windowMeters <= 0 || samples <= 0) {
    return getHeadingByRouteDistance(geometry.coordinates, currentDistance);
  }

  let sumX = 0;
  let sumY = 0;
  for (let i = 1; i <= samples; i += 1) {
    const ahead = getHeadingByRouteDistance(
      geometry.coordinates,
      currentDistance + (windowMeters * i) / samples,
    );
    if (ahead == null) continue;
    const rad = (ahead * Math.PI) / 180;
    sumX += Math.cos(rad);
    sumY += Math.sin(rad);
  }
  if (sumX === 0 && sumY === 0) return null;
  let deg = (Math.atan2(sumY, sumX) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function getHeadingByRouteDistance(coords: LngLat[], routeDistanceMeters: number): number | null {
  if (coords.length < 2) return null;
  let idx = 0;
  let remain = Math.max(0, routeDistanceMeters);
  while (idx < coords.length - 1) {
    const seg = getDistanceMeters(coords[idx], coords[idx + 1]);
    if (seg <= 0) {
      idx += 1;
      continue;
    }
    if (remain <= seg) return getBearing(coords[idx], coords[idx + 1]);
    remain -= seg;
    idx += 1;
  }
  return getBearing(coords[coords.length - 2], coords[coords.length - 1]);
}

function getDistanceOnRouteByProjectedPoint(coords: LngLat[], point: LngLat): number | null {
  if (coords.length < 2) return null;
  let cumulative = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestRouteDistance = 0;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = getDistanceMeters(a, b);
    if (segLen <= 0) continue;

    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = point[0] - a[0];
    const apy = point[1] - a[1];
    const denom = abx * abx + aby * aby;
    const rawT = denom > 0 ? (apx * abx + apy * aby) / denom : 0;
    const t = Math.max(0, Math.min(1, rawT));
    const projected: LngLat = [a[0] + abx * t, a[1] + aby * t];
    const d = getDistanceMeters(projected, point);
    if (d < bestDistance) {
      bestDistance = d;
      bestRouteDistance = cumulative + segLen * t;
    }
    cumulative += segLen;
  }
  return bestRouteDistance;
}

export function resetCameraSmoothing(
  state: {
    center: LngLat | null;
    bearingPrimary: number | null;
    bearing: number | null;
    pitch: number | null;
    zoom: number | null;
    lastTs: number | null;
  },
  map: mapboxgl.Map,
) {
  const c = map.getCenter();
  state.center = [c.lng, c.lat];
  state.bearing = map.getBearing();
  state.bearingPrimary = map.getBearing();
  state.pitch = map.getPitch();
  state.zoom = map.getZoom();
  state.lastTs = null;
}

/** 팔로우 모드 카메라 — rAF 매 프레임 (React liveLngLat 200ms throttle 우회) */
export function shouldSyncMapZoomToApp(
  session: LiveRiderMotion["sessionStatus"] | undefined,
  followMode: FollowMode,
): boolean {
  return !((session === "running" || session === "paused") && followMode !== "free");
}

export function tickRideCameraFollow(
  map: mapboxgl.Map,
  targetLngLat: LngLat,
  opts: {
    followMode: FollowMode;
    mapZoom: number;
    /** 주행 카메라 라이더~카메라 거리(m) — 개발용 거리 슬라이더, 최적값 확정 후 제거 예정 */
    rideCameraDistanceM: number;
    sessionStatus?: LiveRiderMotion["sessionStatus"];
    routeGeometry: LineStringGeometry | null;
    prevLiveRef: { current: LngLat | null };
    smooth: {
      center: LngLat | null;
      bearingPrimary: number | null;
      bearing: number | null;
      pitch: number | null;
      zoom: number | null;
      lastTs: number | null;
    };
    suppressUntilMs: number;
    nowMs: number;
  },
): void {
  if (opts.nowMs < opts.suppressUntilMs) return;

  if (opts.followMode === "free" || !isTickTestFollowOn()) {
    opts.prevLiveRef.current = targetLngLat;
    return;
  }

  const prev = opts.prevLiveRef.current;
  const stepM = prev ? getDistanceMeters(prev, targetLngLat) : 0;
  const headingFromMove = prev && stepM >= 2 ? getBearing(prev, targetLngLat) : null;
  noteHeadingFromMove(stepM, headingFromMove != null);
  const headingFromRoute = getAverageHeadingAheadFromPoint(
    opts.routeGeometry,
    targetLngLat,
    CAMERA_BEARING_WINDOW_METERS,
    CAMERA_BEARING_WINDOW_SAMPLES,
  );
  const baseHeading = headingFromMove ?? headingFromRoute ?? map.getBearing();
  const nextCamera = getCameraForFollowMode({
    mode: opts.followMode,
    baseHeading,
    currentPitch: map.getPitch(),
    distanceM: opts.rideCameraDistanceM,
  });

  const vp = viewportPxFromMap(map);
  const framing = computeRideFollowFraming({
    riderLngLat: targetLngLat,
    offsetBearing: nextCamera.offsetBearing,
    distanceM: nextCamera.distanceM,
    pitchDeg: nextCamera.pitch,
    viewportWidthPx: vp.width,
    viewportHeightPx: vp.height,
    fallbackZoom: opts.mapZoom,
  });
  const cameraCenterTarget = framing.center;
  const followZoom = framing.zoom;

  opts.prevLiveRef.current = targetLngLat;
  const smooth = opts.smooth;
  if (
    !smooth.center ||
    smooth.bearing == null ||
    smooth.bearingPrimary == null ||
    smooth.pitch == null ||
    smooth.zoom == null
  ) {
    resetCameraSmoothing(smooth, map);
  }

  const dtMs = smooth.lastTs == null ? 0 : opts.nowMs - smooth.lastTs;
  smooth.lastTs = opts.nowMs;
  const dtSec = clamp(dtMs, 0, CAMERA_MAX_DT_MS) / 1000;
  const alphaPos = dampAlpha(dtSec, CAMERA_POSITION_TAU_SEC);
  const alphaBearingPrimary = dampAlpha(dtSec, CAMERA_BEARING_TAU_PRIMARY_SEC);
  const alphaBearingSecondary = dampAlpha(dtSec, CAMERA_BEARING_TAU_SECONDARY_SEC);
  const maxStepPrimary = CAMERA_BEARING_MAX_DPS_PRIMARY * dtSec;
  const maxStepSecondary = CAMERA_BEARING_MAX_DPS_SECONDARY * dtSec;

  const curCenter = smooth.center ?? cameraCenterTarget;
  const curPitch = smooth.pitch ?? map.getPitch();
  const curZoom = smooth.zoom ?? map.getZoom();
  const curBearingPrimary = smooth.bearingPrimary ?? map.getBearing();
  const curBearing = smooth.bearing ?? map.getBearing();

  const nextCenter: LngLat = [
    lerp(curCenter[0], cameraCenterTarget[0], alphaPos),
    lerp(curCenter[1], cameraCenterTarget[1], alphaPos),
  ];
  const nextPitch = lerp(curPitch, nextCamera.pitch, alphaPos);
  const nextZoom = lerp(curZoom, followZoom, alphaPos);
  const nextBearingPrimary = lerpAngle(
    curBearingPrimary,
    nextCamera.bearing,
    alphaBearingPrimary,
    maxStepPrimary,
  );
  const nextBearing = lerpAngle(
    curBearing,
    nextBearingPrimary,
    alphaBearingSecondary,
    maxStepSecondary,
  );

  smooth.center = nextCenter;
  smooth.pitch = nextPitch;
  smooth.zoom = nextZoom;
  smooth.bearingPrimary = nextBearingPrimary;
  smooth.bearing = nextBearing;

  applyFollowCameraJumpTo(map, {
    center: nextCenter,
    bearing: nextBearing,
    pitch: nextPitch,
    zoom: nextZoom,
    riderLngLat: targetLngLat,
    t: opts.nowMs,
    stopFirst: isTickTestMapStopOn(),
  });
}

export type FollowCameraJump = {
  center: LngLat;
  bearing: number;
  pitch: number;
  zoom: number;
  riderLngLat: LngLat;
  t: number;
  stopFirst?: boolean;
};

/** jumpTo 직전 계측 + 적용. */
export function applyFollowCameraJumpTo(map: mapboxgl.Map, jump: FollowCameraJump): void {
  noteFollowJumpToValues(jump);
  noteCameraWrite({
    t: jump.t,
    center: jump.center,
    zoom: jump.zoom,
    bearing: jump.bearing,
  });
  if (jump.stopFirst) map.stop();
  beginFollowCameraJump();
  noteFollowJumpTo();
  try {
    map.jumpTo({
      center: jump.center,
      bearing: jump.bearing,
      pitch: jump.pitch,
      zoom: jump.zoom,
    });
  } finally {
    endFollowCameraJump();
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function normalizeAngle(angle: number) {
  let n = angle % 360;
  if (n > 180) n -= 360;
  if (n < -180) n += 360;
  return n;
}

function shortestAngleDelta(from: number, to: number) {
  return normalizeAngle(to - from);
}

function lerpAngle(from: number, to: number, t: number, maxStep: number) {
  const delta = shortestAngleDelta(from, to);
  const stepped = clamp(delta * t, -maxStep, maxStep);
  return normalizeAngle(from + stepped);
}

function dampAlpha(dtSec: number, tauSec: number) {
  if (tauSec <= 0 || dtSec <= 0) return 0;
  return 1 - Math.exp(-dtSec / tauSec);
}

export function getBearing(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function apply3DState(
  map: mapboxgl.Map,
  enabled: boolean,
  buildingLayerId: string,
  terrainSourceId: string,
) {
  try {
  if (!enabled) {
    map.setTerrain(null);
    if (map.getLayer(buildingLayerId)) map.removeLayer(buildingLayerId);
    map.easeTo({ pitch: 0, duration: 400 });
    return;
  }

  if (!map.getSource(terrainSourceId)) {
    map.addSource(terrainSourceId, {
      type: "raster-dem",
      url: "mapbox://mapbox.terrain-rgb",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: terrainSourceId, exaggeration: 1.3 });
  if (!map.getLayer(buildingLayerId)) {
    let layers: { id: string; type?: string; layout?: { ["text-field"]?: unknown } }[];
    try {
      layers = map.getStyle()?.layers ?? [];
    } catch {
      return;
    }
    const symbolLayer = layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"]);
    map.addLayer(
      {
        id: buildingLayerId,
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#cbd5e1",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.65,
        },
      },
      symbolLayer?.id,
    );
  }
  if (map.getPitch() < 35) {
    map.easeTo({ pitch: 60, bearing: map.getBearing(), duration: 450 });
  }
  } catch (err) {
    console.warn("[map] apply3DState failed", err);
  }
}

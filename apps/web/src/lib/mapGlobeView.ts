import type { Map as MapboxMap } from "mapbox-gl";
import type { FollowMode } from "../components/ride/RideRoutePanel";
import { RIDER_GLB_MODEL_BASE_SCALE } from "./riderPrototype/config";
import { RIDER_DISPLAY_HEIGHT_M, RIDER_HEAD_C_Y_M, rideHeightSpanMargin } from "./rideCameraFraming";

/** `fitBounds` 로 지구 전체가 들어오도록 할 때의 줌 상한 */
export const MAP_GLOBE_FIT_MAX_ZOOM = 2.5;

/** 맵 최소 줌 — NavigationControl·지구 보기·맵 시트 슬라이더 */
export const MAP_GLOBE_MIN_ZOOM = 0;

/** 맵 시트 슬라이더 상한(Mapbox 기본 maxZoom 근처) */
export const MAP_ZOOM_SLIDER_MAX = 22;

/**
 * 앱 진입(첫 화면) 기본 줌 — 시·구·동 라벨이 읽히는 인식 스케일(지시01·지시06 A-2).
 * 종전 19 는 ~10m 골목이었다. 주행 카메라·Quick Camera·NextRide 앵커는 이 상수를 쓰지 않는다.
 */
export const DEFAULT_MAP_ZOOM = 13;

/** 앱 진입 시 기본 카메라 팔로우 — 좌측 */
export const DEFAULT_FOLLOW_MODE: FollowMode = "left";

/** 앱 진입 시 3D terrain·건물 */
export const DEFAULT_MAP_ENABLE_3D = false;

/** 밀착 추적 카메라 줌 — 캐릭터가 화면에 들어오도록 21.5 고정 (수동 선택 시) */
export const RIDE_FOLLOW_CAMERA_ZOOM = 21.5;

/** 주행 시작 시 자동 적용할 팔로우 모드 — 상공 수직(topDown) */
export const RIDE_FOLLOW_CAMERA_MODE: FollowMode = "topDown";

/** 주행 시작 시 자동 적용할 줌 — 탑다운에서 라이더와 주변 도로가 함께 보이는 값 */
export const RIDE_START_ZOOM = 17.5;

/**
 * 밀착 4방향(전/후/좌/우) 주행 카메라 pitch — 준수평 추적(GoPro/레이싱 뷰).
 * Chief 확정(2026-09-23): **80°**. 5m preset 을 열려고 67° 로 내렸으나 지평선이 사라져
 * 「재미없다」(Chief) — 그림이 숫자를 이겨 80° 로 되돌림.
 * 거리 하한은 pitch 80 에서 floor≈5.59m → 눈금 올림 **6.0m**(원안 「5m」는 조용히 바꾸지 않고
 * QC 2~5 가 `max(5, MIN)` 으로 6m 에 걸림을 드러냄).
 * `?ridePitch=<0..85>` 디버그 플래그는 유지(캡처·비교용, 모듈 로드 시 1회).
 */
export const RIDE_CAMERA_PITCH_CLOSE = 80;

/** Mapbox `maxPitch` 와 맞춤 — URL·제품 pitch 상한 */
export const RIDE_CAMERA_PITCH_MAX = 85;

/**
 * 캡처 비교용 pitch — **모듈 로드 시 1회**만 URL 을 읽는다.
 * rAF/`getCameraForFollowMode` 경로에서 `URLSearchParams` 를 만들지 말 것(지시04 §2).
 * `?ridePitch=75` 등은 페이지를 그 쿼리로 **재진입**할 때 적용된다.
 */
const CACHED_RIDE_CAMERA_PITCH_CLOSE: number = (() => {
  if (typeof window === "undefined") return RIDE_CAMERA_PITCH_CLOSE;
  try {
    const raw = new URLSearchParams(window.location.search).get("ridePitch");
    if (raw == null || raw === "") return RIDE_CAMERA_PITCH_CLOSE;
    const n = Number(raw);
    if (!Number.isFinite(n)) return RIDE_CAMERA_PITCH_CLOSE;
    return Math.max(0, Math.min(RIDE_CAMERA_PITCH_MAX, n));
  } catch {
    /* ignore */
  }
  return RIDE_CAMERA_PITCH_CLOSE;
})();

export function resolveRideCameraPitchClose(): number {
  return CACHED_RIDE_CAMERA_PITCH_CLOSE;
}

/** 기준 전고에서의 기본 거리(m) — 상한과 분리. 주행 첫 화면이 60m 로 튀지 않게 40 고정(지시03). */
const RIDE_CAMERA_DISTANCE_DEFAULT_AT_BASE_M = 40;

/**
 * 기준 전고(m) — 배율 계수를 뺀, factor 1 의 라이더 전고(1.5939 m).
 * 아래 카메라 거리들이 「전고의 배수」임을 드러내기 위한 분모다.
 */
const RIDER_BASE_DISPLAY_HEIGHT_M = RIDER_HEAD_C_Y_M * RIDER_GLB_MODEL_BASE_SCALE;

/** 기준 전고에서의 거리 상한(m). 배율이 커지면 전고 비율만큼 함께 늘어난다. */
const RIDE_CAMERA_DISTANCE_MAX_AT_BASE_M = 60;

/**
 * 주행 카메라 거리(m) — **라이더 전고에서 유도한다.**
 *
 * 카메라 범위를 고정해 두고 라이더를 거기 맞추는 것이 아니라, 라이더 크기가 카메라
 * 범위를 정한다. 그래서 라이더의 화면 점유 비율은 배율과 무관하게 일정하고, 지도·건물이
 * 상대적으로 작아진다 — 「내가 거인이다」의 직접적인 표현이다.
 *
 * 하한만은 비례가 아니다. 의미가 「이보다 가까우면 라이더가 화면에 들어가지 않는다」이므로
 * 프레이밍이 정한다 — `heightSpan` 이 `distanceM` 을 이기기 시작하는 지점이며, 그 아래는
 * 줌이 변하지 않는 죽은 구간이다.
 *
 * `defaultM` 은 상한과 달리 **40m 기준값을 스케일**한다 — 상한만 60 으로 연 뒤에도
 * 주행 첫 화면 기본 거리는 바꾸지 않기 위함(지시03).
 */
export function rideCameraDistanceRangeM(displayHeightM: number = RIDER_DISPLAY_HEIGHT_M): {
  minM: number;
  defaultM: number;
  maxM: number;
  stepM: number;
} {
  const scaleVsBase = displayHeightM / RIDER_BASE_DISPLAY_HEIGHT_M;
  // 부동소수 잡음이 slider 의 min/max/step 속성에 그대로 노출되므로 마이크로미터에서 끊는다
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  const maxM = round(RIDE_CAMERA_DISTANCE_MAX_AT_BASE_M * scaleVsBase);
  const defaultM = round(RIDE_CAMERA_DISTANCE_DEFAULT_AT_BASE_M * scaleVsBase);
  const stepM = round(0.5 * scaleVsBase);
  // 하한 = heightSpan 이 distanceM 을 이기기 시작하는 지점(그 아래는 줌이 변하지 않는다).
  // 눈금 위로 올림해 슬라이더 격자에 얹는다 — 올림이므로 라이더가 더 여유롭게 들어간다.
  const floorM = rideHeightSpanMargin(RIDE_CAMERA_PITCH_CLOSE) * displayHeightM;
  const minM = round(Math.ceil(floorM / stepM) * stepM);
  return { minM, defaultM, maxM, stepM };
}

const RIDE_CAMERA_DISTANCE_RANGE = rideCameraDistanceRangeM();
export const RIDE_CAMERA_DISTANCE_MIN_M = RIDE_CAMERA_DISTANCE_RANGE.minM;
export const RIDE_CAMERA_DISTANCE_DEFAULT_M = RIDE_CAMERA_DISTANCE_RANGE.defaultM;
export const RIDE_CAMERA_DISTANCE_MAX_M = RIDE_CAMERA_DISTANCE_RANGE.maxM;
export const RIDE_CAMERA_DISTANCE_STEP_M = RIDE_CAMERA_DISTANCE_RANGE.stepM;


/** 지구 전체가 한 화면에 보이도록 카메라를 맞춘다(극지 왜곡 완화용 위도 클램프). */
export function applyMapGlobeView(map: MapboxMap): void {
  map.stop();
  map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
  map.fitBounds(
    [
      [-180, -58],
      [180, 78],
    ],
    {
      padding: 48,
      duration: 700,
      maxZoom: MAP_GLOBE_FIT_MAX_ZOOM,
      essential: true,
    },
  );
}

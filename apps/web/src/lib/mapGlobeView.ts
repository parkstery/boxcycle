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

/** 앱 진입 시 기본 줌 */
export const DEFAULT_MAP_ZOOM = 19;

/** 앱 진입 시 기본 카메라 팔로우 — 좌측 */
export const DEFAULT_FOLLOW_MODE: FollowMode = "leftFlat";

/** 앱 진입 시 3D terrain·건물 */
export const DEFAULT_MAP_ENABLE_3D = false;

/** 후방(rear30) 추적 카메라 줌 — 캐릭터가 화면에 들어오도록 21.5 고정 (수동 선택 시) */
export const RIDE_FOLLOW_CAMERA_ZOOM = 21.5;

/** 주행 시작 시 자동 적용할 팔로우 모드 — 상공 수직(topDown) */
export const RIDE_FOLLOW_CAMERA_MODE: FollowMode = "topDown";

/** 주행 시작 시 자동 적용할 줌 — 탑다운에서 라이더와 주변 도로가 함께 보이는 값 */
export const RIDE_START_ZOOM = 17.5;

/**
 * 밀착 4방향(전/후/좌/우) 주행 카메라 pitch — 준수평 추적(GoPro/레이싱 뷰).
 * 3D(terrain) 유무와 무관하게 적용. maxPitch(85) 아래로 안정적인 80 사용 —
 * 라이더를 옆·뒤에서 수평으로 좇는 밀착감이 목적. 2D 에선 terrain 없이 지도가 눕지만 의도된 것.
 */
export const RIDE_CAMERA_PITCH_CLOSE = 80;

/**
 * 기준 전고(m) — 배율 계수를 뺀, factor 1 의 라이더 전고(1.5939 m).
 * 아래 카메라 거리들이 「전고의 배수」임을 드러내기 위한 분모다.
 */
const RIDER_BASE_DISPLAY_HEIGHT_M = RIDER_HEAD_C_Y_M * RIDER_GLB_MODEL_BASE_SCALE;

/** 기준 전고에서의 거리 상한(m) — 오늘의 제품 값. 배율이 커지면 전고 비율만큼 함께 늘어난다. */
const RIDE_CAMERA_DISTANCE_MAX_AT_BASE_M = 40;

/**
 * 주행 카메라 거리(m) — **라이더 전고에서 유도한다.**
 *
 * 카메라 범위를 고정해 두고 라이더를 거기 맞추는 것이 아니라, 라이더 크기가 카메라
 * 범위를 정한다. 그래서 라이더의 화면 점유 비율은 배율과 무관하게 일정하고, 지도·건물이
 * 상대적으로 작아진다 — 「내가 거인이다」의 직접적인 표현이다.
 * 세 값 모두 factor 1 에서 오늘의 동작을 재현한다(상한·기본 40 m).
 *
 * 하한만은 비례가 아니다. 의미가 「이보다 가까우면 라이더가 화면에 들어가지 않는다」이므로
 * 프레이밍이 정한다 — `heightSpan` 이 `distanceM` 을 이기기 시작하는 지점이며, 그 아래는
 * 줌이 변하지 않는 죽은 구간이다. factor 1 에서 1 m → 5.59 m 로 올라가는데, 잘려 나가는
 * 구간은 `main2` 에서 이미 라이더가 화면에 없던 자리다([G-5 REPORT](../../../../document/ops/giant-relay/REPORT-G5.md) §2).
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
  const stepM = round(0.5 * scaleVsBase);
  // 하한 = heightSpan 이 distanceM 을 이기기 시작하는 지점(그 아래는 줌이 변하지 않는다).
  // 눈금 위로 올림해 슬라이더 격자에 얹는다 — 올림이므로 라이더가 더 여유롭게 들어간다.
  const floorM = rideHeightSpanMargin(RIDE_CAMERA_PITCH_CLOSE) * displayHeightM;
  const minM = round(Math.ceil(floorM / stepM) * stepM);
  return { minM, defaultM: maxM, maxM, stepM };
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

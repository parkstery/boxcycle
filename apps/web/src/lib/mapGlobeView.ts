import type { Map as MapboxMap } from "mapbox-gl";
import type { FollowMode } from "../components/ride/RideRoutePanel";

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

/** 주행 시작 시 자동 적용할 팔로우 모드 — 좌측(leftFlat) */
export const RIDE_FOLLOW_CAMERA_MODE: FollowMode = "leftFlat";

/** 주행 시작 시 자동 적용할 줌 */
export const RIDE_START_ZOOM = 16;

/** 주행 카메라 프리셋 기본 거리(m) — 개발 중 거리 슬라이더로 조정, 확정 시 고정 */
export const RIDE_CAMERA_DISTANCE_DEFAULT_M = 4;
export const RIDE_CAMERA_DISTANCE_MIN_M = 1;
export const RIDE_CAMERA_DISTANCE_MAX_M = 40;

/**
 * 밀착 4방향(전/후/좌/우) 주행 카메라 pitch — 준수평 추적(GoPro/레이싱 뷰).
 * 3D(terrain) 유무와 무관하게 적용. maxPitch(85) 아래로 안정적인 80 사용 —
 * 라이더를 옆·뒤에서 수평으로 좇는 밀착감이 목적. 2D 에선 terrain 없이 지도가 눕지만 의도된 것.
 */
export const RIDE_CAMERA_PITCH_CLOSE = 80;

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

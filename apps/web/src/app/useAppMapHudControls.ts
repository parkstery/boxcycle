import type { useAppMapCameraState } from "./useAppMapCameraState";
import { MAP_GLOBE_MIN_ZOOM, MAP_ZOOM_SLIDER_MAX } from "../lib/map/mapGlobeView";
import { nextRideUserZoomInDistanceM, nextRideUserZoomOutDistanceM } from "../lib/camera/rideUserZoom";
import { DEFAULT_MAP_STYLE, mapStyleHudShortLabel, nextOutdoorsSatelliteMapStyle } from "../lib/map/rtwMapConfig";
import { isQuickCameraOutdoorsOnly } from "../lib/camera/quickCameraProductTune";

type Cam = Pick<
  ReturnType<typeof useAppMapCameraState>,
  | "mapStyle"
  | "setMapStyle"
  | "mapZoom"
  | "rideCameraDistanceM"
  | "followMode"
  | "activeQuickCamera"
  | "camera1UserToggledStyleRef"
  | "setMapZoomStepRequest"
  | "mapZoomStepSeqRef"
>;

export type MapHudControls = {
  styleLabel: string;
  styleAriaLabel: string;
  styleToggleDisabled?: boolean;
  onToggleStyle: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  zoomOutDisabled: boolean;
  zoomInDisabled: boolean;
};

/**
 * 지도 위 지도 스타일·＋·－ 버튼의 동작. 오른쪽 조작 레일과(낮은 폰에선) 주행 설정 창이 같은 것을 쓴다.
 * idle·거리 없는 카메라는 지도 줌 한 단계, 거리 지배 주행 카메라는 라이더~카메라 거리를 바꾼다.
 */
export function useAppMapHudControls(
  cam: Cam,
  rideStatus: string,
  onRideCameraDistance: (distanceM: number) => void,
): MapHudControls {
  const { mapStyle, setMapStyle, mapZoom, rideCameraDistanceM, followMode, activeQuickCamera } = cam;
  const outdoorsOnly = isQuickCameraOutdoorsOnly(activeQuickCamera);
  const rideActive = rideStatus === "running" || rideStatus === "paused";
  const mapZoomStep =
    !rideActive || followMode === "free" || followMode === "topDown" || followMode === "north" || followMode === "keep";
  const stepMapZoom = (delta: number) => {
    cam.mapZoomStepSeqRef.current += 1;
    cam.setMapZoomStepRequest({ requestId: cam.mapZoomStepSeqRef.current, delta });
  };
  return {
    styleLabel: mapStyleHudShortLabel(mapStyle),
    styleAriaLabel: outdoorsOnly
      ? "맵 스타일 야외, 카메라 2~6에서는 야외 고정"
      : `맵 스타일 ${mapStyleHudShortLabel(mapStyle)}, 클릭 시 ${mapStyleHudShortLabel(nextOutdoorsSatelliteMapStyle(mapStyle))}`,
    styleToggleDisabled: outdoorsOnly,
    onToggleStyle: () => {
      if (outdoorsOnly) {
        setMapStyle(DEFAULT_MAP_STYLE);
        return;
      }
      if (activeQuickCamera === 1) cam.camera1UserToggledStyleRef.current = true;
      setMapStyle(nextOutdoorsSatelliteMapStyle(mapStyle));
    },
    onZoomOut: () => {
      if (mapZoomStep) stepMapZoom(-1);
      else onRideCameraDistance(nextRideUserZoomOutDistanceM(rideCameraDistanceM));
    },
    onZoomIn: () => {
      if (mapZoomStep) stepMapZoom(1);
      else onRideCameraDistance(Math.max(1e-9, nextRideUserZoomInDistanceM(rideCameraDistanceM)));
    },
    // 거리 지배 주행 카메라에는 제품 임의 상한이 없다 — 실제 축소 한계는 Mapbox `minZoom`이 맡는다.
    zoomOutDisabled: mapZoomStep ? mapZoom <= MAP_GLOBE_MIN_ZOOM + 1e-6 : false,
    zoomInDisabled: mapZoomStep ? mapZoom >= MAP_ZOOM_SLIDER_MAX - 1e-6 : rideCameraDistanceM <= 1e-6,
  };
}

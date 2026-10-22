/* eslint-disable react-hooks/refs -- App.tsx 에서 옮긴 기존 패턴, eslint.config.js 의 App.tsx 예외와 같은 범위 */
import { useCallback, useRef, useState } from "react";
import type { MapViewportBounds } from "../lib/activity/activityWorldLod";
import type { Camera1Mode } from "../lib/camera/camera1Mode";
import type { LngLat } from "../lib/geo/geo";
import {
  DEFAULT_FOLLOW_MODE,
  DEFAULT_MAP_ENABLE_3D,
  DEFAULT_MAP_ZOOM,
  RIDE_CAMERA_DISTANCE_DEFAULT_M,
  type FollowMode,
} from "../lib/map/mapGlobeView";
import { MAP_FALLBACK_CENTER, MAP_FALLBACK_ZOOM } from "../lib/map/mapBootCenter";
import { MAP_STYLE_SATELLITE } from "../lib/map/rtwMapConfig";

/** 지도 스타일·줌·카메라 팔로우 상태 묶음 — 훅 순서는 App 원문 그대로 */
export function useAppMapCameraState() {
  /** 첫 지도는 저장 지역이 아니라 콜로세움. 실제 목적지는 위치 선택이 정한다. */
  const [mapStyle, setMapStyle] = useState(MAP_STYLE_SATELLITE);
  const [showRtwPoi, setShowRtwPoi] = useState(false);
  const [mapZoom, setMapZoom] = useState(MAP_FALLBACK_ZOOM);
  /** 주행 카메라 라이더~카메라 거리(m) — 개발용 거리 슬라이더, 최적값 확정 후 제거 예정 */
  const [rideCameraDistanceM, setRideCameraDistanceM] = useState(RIDE_CAMERA_DISTANCE_DEFAULT_M);
  const [rideFollowCameraNonce, setRideFollowCameraNonce] = useState(0);
  const [rideJoinBurstNonce, setRideJoinBurstNonce] = useState(0);
  const [mapViewportSpanKm, setMapViewportSpanKm] = useState<number | null>(null);
  /** 전역 livePresence publish — idle 시 지도 중심(주행 중에는 liveForMap 우선) */
  const [mapViewportCenterLngLat, setMapViewportCenterLngLat] = useState<LngLat>([
    MAP_FALLBACK_CENTER[0],
    MAP_FALLBACK_CENTER[1],
  ]);
  /** Activity World LOD — 제스처 중 실제 줌·span (HUD `mapZoom` 과 분리) */
  const [mapLodZoom, setMapLodZoom] = useState(DEFAULT_MAP_ZOOM);
  const [mapLodSpanKm, setMapLodSpanKm] = useState<number | null>(null);

  const onMapViewport = useCallback((viewport: MapViewportBounds, spanKm: number) => {
    setMapViewportSpanKm(spanKm);
    const centerLng = (viewport.west + viewport.east) / 2;
    const centerLat = (viewport.south + viewport.north) / 2;
    if (Number.isFinite(centerLng) && Number.isFinite(centerLat)) {
      setMapViewportCenterLngLat([centerLng, centerLat]);
    }
  }, []);
  const onMapLodViewport = useCallback((spanKm: number, zoom: number) => {
    setMapLodSpanKm(spanKm);
    setMapLodZoom(zoom);
  }, []);
  const [followMode, setFollowMode] = useState<FollowMode>(DEFAULT_FOLLOW_MODE);
  /** Quick Camera 1~6 — 주행 HUD. null = 미선택 */
  const [activeQuickCamera, setActiveQuickCamera] = useState<1 | 2 | 3 | 4 | 5 | 6 | null>(null);
  /** Quick Camera 1: routeFit → aerial500 → aerial20 → … (지시11) */
  const [camera1Mode, setCamera1Mode] = useState<Camera1Mode>("routeFit");
  /** 1번 진입 직전 맵 스타일 — 이탈 시 복원(사용자가 1번 안 토글하면 복원 안 함) */
  const camera1StyleBeforeEnterRef = useRef<string | null>(null);
  const camera1UserToggledStyleRef = useRef(false);
  /** Quick Camera 6: baseHeading 고정(북=0) */
  const [lockBaseHeading, setLockBaseHeading] = useState<number | null>(null);
  /** 지시06 B1 — preset 거리 vs 사용자 줌 역산 */
  const [rideCameraSpanFloorMode, setRideCameraSpanFloorMode] = useState<"preset" | "userZoom">(
    "preset",
  );
  /** HUD mapZoom 모드 ± — MapView 실측 zoom 기준 1회 스텝 */
  const [mapZoomStepRequest, setMapZoomStepRequest] = useState<{
    requestId: number;
    delta: number;
  } | null>(null);
  const mapZoomStepSeqRef = useRef(0);
  const [enable3D, setEnable3D] = useState(DEFAULT_MAP_ENABLE_3D);
  const followModeSnapshotRef = useRef(followMode);
  const mapZoomSnapshotRef = useRef(mapZoom);
  followModeSnapshotRef.current = followMode;
  mapZoomSnapshotRef.current = mapZoom;
  const rideCameraRestoreRef = useRef<{ follow: FollowMode; zoom: number } | null>(null);
  return {
    mapStyle,
    setMapStyle,
    showRtwPoi,
    setShowRtwPoi,
    mapZoom,
    setMapZoom,
    rideCameraDistanceM,
    setRideCameraDistanceM,
    rideFollowCameraNonce,
    setRideFollowCameraNonce,
    rideJoinBurstNonce,
    setRideJoinBurstNonce,
    mapViewportSpanKm,
    mapViewportCenterLngLat,
    mapLodZoom,
    mapLodSpanKm,
    onMapViewport,
    onMapLodViewport,
    followMode,
    setFollowMode,
    activeQuickCamera,
    setActiveQuickCamera,
    camera1Mode,
    setCamera1Mode,
    camera1StyleBeforeEnterRef,
    camera1UserToggledStyleRef,
    lockBaseHeading,
    setLockBaseHeading,
    rideCameraSpanFloorMode,
    setRideCameraSpanFloorMode,
    mapZoomStepRequest,
    setMapZoomStepRequest,
    mapZoomStepSeqRef,
    enable3D,
    setEnable3D,
    followModeSnapshotRef,
    mapZoomSnapshotRef,
    rideCameraRestoreRef,
  };
}

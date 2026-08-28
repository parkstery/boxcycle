import { useEffect } from "react";
import type { CoverageOverlayMode } from "../../lib/coverageOverlayMode";
import { COVERAGE_OVERLAY_OPTIONS } from "../../lib/coverageOverlayMode";
import {
  MAP_GLOBE_MIN_ZOOM,
  MAP_ZOOM_SLIDER_MAX,
  RIDE_CAMERA_DISTANCE_MIN_M,
  RIDE_CAMERA_DISTANCE_MAX_M,
} from "../../lib/mapGlobeView";
import type { FollowMode } from "../ride/RideRoutePanel";
import "./MapViewSheet.css";

type MapViewSheetProps = {
  open: boolean;
  onClose: () => void;
  mapStyle: string;
  mapStyleOptions: { value: string; label: string }[];
  onMapStyle: (v: string) => void;
  coverageOverlayMode: CoverageOverlayMode;
  /** 주행 중 Mapillary 거리뷰 창 — 기본 꺼짐, 필요할 때만 켠다 */
  rideStreetViewEnabled: boolean;
  onRideStreetViewEnabled: (enabled: boolean) => void;
  onCoverageOverlayMode: (m: CoverageOverlayMode) => void;
  mapillaryTokenConfigured: boolean;
  enable3D: boolean;
  onEnable3D: (v: boolean) => void;
  followMode: FollowMode;
  onFollowMode: (m: FollowMode) => void;
  mapZoom: number;
  onMapZoom: (n: number) => void;
  showRtwPoi: boolean;
  onShowRtwPoi: (v: boolean) => void;
  /** 주행 중이면 "줌" 그룹이 "거리" 슬라이더로 바뀐다(개발용, 최적값 확정 후 제거 예정) */
  rideActive: boolean;
  rideCameraDistanceM: number;
  onRideCameraDistanceM: (m: number) => void;
};

const FOLLOW_OPTIONS: { value: FollowMode; label: string }[] = [
  { value: "free", label: "free" },
  { value: "keep", label: "유지" },
  { value: "topDown", label: "상공" },
  { value: "north", label: "북향" },
  { value: "rear30", label: "후방" },
  { value: "front30", label: "전방" },
  { value: "leftFlat", label: "좌측" },
  { value: "rightFlat", label: "우측" },
];

const FOLLOW_TITLES: Record<FollowMode, string> = {
  free: "Free camera",
  keep: "Follow, keep bearing",
  topDown: "Top-down (overhead)",
  north: "North up",
  rear30: "Rear 30°",
  front30: "Front 30°",
  leftFlat: "Left side",
  rightFlat: "Right side",
};

/**
 * BC 슬롯에서 위로 슬라이드 인 하는 맵 뷰 컨트롤 시트.
 * 각 블록은 한 줄: 왼쪽 타이틀 · 오른쪽 컨트롤(줄바꿈 없이, 필요 시 가로 스크롤).
 */
export function MapViewSheet(props: MapViewSheetProps) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div className="map-view-sheet" role="dialog" aria-label="맵 뷰">
      <button
        type="button"
        className="map-view-sheet__scrim"
        aria-label="닫기"
        title="Close"
        onClick={props.onClose}
      />
      <div className="map-view-sheet__panel">
        <div className="map-view-sheet__handle" aria-hidden />
        {/* 우측 패널이 자기 트리거(맵 버튼)를 덮으므로 명시적 닫기가 필요하다 */}
        <div className="map-view-sheet__head">
          <span className="map-view-sheet__head-title">맵 뷰</span>
          <button
            type="button"
            className="map-view-sheet__close"
            aria-label="맵 뷰 닫기"
            title="Close"
            onClick={props.onClose}
          >
            닫기
          </button>
        </div>

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label-title">노선</span>
          <div className="map-view-sheet__row-body">
            <div className="map-view-sheet__chips map-view-sheet__chips--inline">
              {COVERAGE_OVERLAY_OPTIONS.map((opt) => {
                const needsMly = opt.value === "mapillary" || opt.value === "both";
                const disabled = needsMly && !props.mapillaryTokenConfigured;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={
                      disabled
                        ? "Mapillary token required (VITE_MAPILLARY_CLIENT_TOKEN)"
                        : opt.value === "off"
                          ? "Hide coverage overlay"
                          : opt.value === "osrm"
                            ? "Road coverage (Mapbox vs OSRM may differ)"
                            : opt.value === "mapillary"
                              ? "Street imagery (Mapillary)"
                              : "Road + Mapillary"
                    }
                    className={`map-view-sheet__chip ${
                      props.coverageOverlayMode === opt.value ? "is-active" : ""
                    }`}
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) props.onCoverageOverlayMode(opt.value);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {!props.mapillaryTokenConfigured ? (
              <span className="map-view-sheet__help map-view-sheet__help--inline" title="Mapillary 토큰 미설정">
                Mapillary 토큰 미설정
              </span>
            ) : null}
          </div>
        </div>

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label-title">거리뷰</span>
          <div className="map-view-sheet__row-body">
            <label className="map-view-sheet__toggle" title="Street view while riding">
              <input
                type="checkbox"
                checked={props.rideStreetViewEnabled}
                disabled={!props.mapillaryTokenConfigured}
                onChange={(e) => props.onRideStreetViewEnabled(e.target.checked)}
              />
              주행 중 거리뷰 창
            </label>
          </div>
        </div>

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label-title">맵 스타일</span>
          <div className="map-view-sheet__row-body">
            <label
              className="map-view-sheet__check map-view-sheet__check--inline-3d"
              title="Tilt map and show 3D buildings"
            >
              <input
                type="checkbox"
                checked={props.enable3D}
                onChange={(e) => props.onEnable3D(e.target.checked)}
              />
              3D 뷰
            </label>
            <label
              className="map-view-sheet__check map-view-sheet__check--inline-3d"
              title="임시 — RTW Dark에서 POI 라벨 표시(비교용, 다른 스타일에는 효과 없음)"
            >
              <input
                type="checkbox"
                checked={props.showRtwPoi}
                onChange={(e) => props.onShowRtwPoi(e.target.checked)}
              />
              POI
            </label>
            <div className="map-view-sheet__chips map-view-sheet__chips--inline">
              {props.mapStyleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`map-view-sheet__chip ${props.mapStyle === opt.value ? "is-active" : ""}`}
                  title={`${opt.label} basemap`}
                  onClick={() => props.onMapStyle(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label-title">카메라</span>
          <div className="map-view-sheet__row-body">
            <div className="map-view-sheet__chips map-view-sheet__chips--inline">
              {FOLLOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`map-view-sheet__chip ${props.followMode === opt.value ? "is-active" : ""}`}
                  title={FOLLOW_TITLES[opt.value]}
                  onClick={() => props.onFollowMode(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {props.rideActive ? (
          // 개발용 거리 튜닝 슬라이더 — 최적값 확정 후 제거 예정
          <div className="map-view-sheet__group">
            <span className="map-view-sheet__label-title">거리</span>
            <div className="map-view-sheet__row-body map-view-sheet__row-body--zoom">
              <button
                type="button"
                className="map-view-sheet__zoom-step"
                title="0.5m 가깝게"
                aria-label="거리 0.5m 가깝게"
                onClick={() => {
                  const m = Math.round((props.rideCameraDistanceM - 0.5) * 10) / 10;
                  props.onRideCameraDistanceM(Math.max(RIDE_CAMERA_DISTANCE_MIN_M, m));
                }}
              >
                −
              </button>
              <span className="map-view-sheet__zoom-readout" aria-live="polite">
                {props.rideCameraDistanceM.toFixed(1)}m
              </span>
              <button
                type="button"
                className="map-view-sheet__zoom-step"
                title="0.5m 멀게"
                aria-label="거리 0.5m 멀게"
                onClick={() => {
                  const m = Math.round((props.rideCameraDistanceM + 0.5) * 10) / 10;
                  props.onRideCameraDistanceM(Math.min(RIDE_CAMERA_DISTANCE_MAX_M, m));
                }}
              >
                +
              </button>
              <input
                type="range"
                className="map-view-sheet__range"
                min={RIDE_CAMERA_DISTANCE_MIN_M}
                max={RIDE_CAMERA_DISTANCE_MAX_M}
                step={0.5}
                value={Math.min(
                  RIDE_CAMERA_DISTANCE_MAX_M,
                  Math.max(RIDE_CAMERA_DISTANCE_MIN_M, props.rideCameraDistanceM),
                )}
                onChange={(e) => props.onRideCameraDistanceM(Number(e.target.value))}
                aria-label={`거리 ${props.rideCameraDistanceM.toFixed(1)}m`}
              />
            </div>
          </div>
        ) : (
          <div className="map-view-sheet__group">
            <span className="map-view-sheet__label-title">줌</span>
            <div className="map-view-sheet__row-body map-view-sheet__row-body--zoom">
              <button
                type="button"
                className="map-view-sheet__zoom-step"
                title="한 단계 축소"
                aria-label="줌 한 단계 축소"
                onClick={() => {
                  const z = Math.round((props.mapZoom - 1) * 10) / 10;
                  props.onMapZoom(Math.max(MAP_GLOBE_MIN_ZOOM, z));
                }}
              >
                −
              </button>
              <span className="map-view-sheet__zoom-readout" aria-live="polite">
                {props.mapZoom.toFixed(1)}
              </span>
              <button
                type="button"
                className="map-view-sheet__zoom-step"
                title="한 단계 확대"
                aria-label="줌 한 단계 확대"
                onClick={() => {
                  const z = Math.round((props.mapZoom + 1) * 10) / 10;
                  props.onMapZoom(Math.min(MAP_ZOOM_SLIDER_MAX, z));
                }}
              >
                +
              </button>
              <input
                type="range"
                className="map-view-sheet__range"
                min={MAP_GLOBE_MIN_ZOOM}
                max={MAP_ZOOM_SLIDER_MAX}
                step={0.1}
                value={Math.min(MAP_ZOOM_SLIDER_MAX, Math.max(MAP_GLOBE_MIN_ZOOM, props.mapZoom))}
                onChange={(e) => props.onMapZoom(Number(e.target.value))}
                aria-label={`줌 ${props.mapZoom.toFixed(1)}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

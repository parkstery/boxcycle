import { useEffect } from "react";
import type { CoverageOverlayMode } from "../lib/coverageOverlayMode";
import { COVERAGE_OVERLAY_OPTIONS } from "../lib/coverageOverlayMode";
import type { FollowMode } from "./RideRoutePanel";
import "./MapViewSheet.css";

type MapViewSheetProps = {
  open: boolean;
  onClose: () => void;
  mapStyle: string;
  mapStyleOptions: { value: string; label: string }[];
  onMapStyle: (v: string) => void;
  coverageOverlayMode: CoverageOverlayMode;
  onCoverageOverlayMode: (m: CoverageOverlayMode) => void;
  mapillaryTokenConfigured: boolean;
  enable3D: boolean;
  onEnable3D: (v: boolean) => void;
  followMode: FollowMode;
  onFollowMode: (m: FollowMode) => void;
  mapZoom: number;
  onMapZoom: (n: number) => void;
};

const FOLLOW_OPTIONS: { value: FollowMode; label: string }[] = [
  { value: "free", label: "자유" },
  { value: "keep", label: "유지" },
  { value: "north", label: "북향" },
  { value: "rear30", label: "후방" },
  { value: "front30", label: "전방" },
  { value: "leftFlat", label: "좌측" },
  { value: "rightFlat", label: "우측" },
];

/**
 * BC 슬롯에서 위로 슬라이드 인 하는 맵 뷰 컨트롤 시트.
 * - 맵 스타일·노선 커버리지·3D·카메라·줌. 라이딩 중에도 접근 가능.
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
        onClick={props.onClose}
      />
      <div className="map-view-sheet__panel">
        <div className="map-view-sheet__handle" aria-hidden />

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label">맵 스타일</span>
          <div className="map-view-sheet__chips">
            {props.mapStyleOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`map-view-sheet__chip ${props.mapStyle === opt.value ? "is-active" : ""}`}
                onClick={() => props.onMapStyle(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label">노선 커버리지</span>
          <div className="map-view-sheet__chips">
            {COVERAGE_OVERLAY_OPTIONS.map((opt) => {
              const needsMly = opt.value === "mapillary" || opt.value === "both";
              const disabled = needsMly && !props.mapillaryTokenConfigured;
              return (
                <button
                  key={opt.value}
                  type="button"
                  title={
                    disabled
                      ? "Mapillary 클라이언트 토큰이 필요합니다(VITE_MAPILLARY_CLIENT_TOKEN)"
                      : opt.value === "osrm" || opt.value === "both"
                        ? "Mapbox Streets 도로 클래스(자전거·도로 등) — OSRM 그래프와 동일하지 않을 수 있음"
                        : "Mapillary 촬영 시퀀스"
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
            <span className="map-view-sheet__help">Mapillary 토큰 미설정</span>
          ) : null}
        </div>

        <div className="map-view-sheet__group">
          <label className="map-view-sheet__check">
            <input
              type="checkbox"
              checked={props.enable3D}
              onChange={(e) => props.onEnable3D(e.target.checked)}
            />
            3D 뷰
          </label>
        </div>

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label">카메라</span>
          <div className="map-view-sheet__chips">
            {FOLLOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`map-view-sheet__chip ${props.followMode === opt.value ? "is-active" : ""}`}
                onClick={() => props.onFollowMode(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label">줌 · {props.mapZoom.toFixed(1)}</span>
          <input
            type="range"
            className="map-view-sheet__range"
            min={3}
            max={20}
            step={0.1}
            value={props.mapZoom}
            onChange={(e) => props.onMapZoom(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}

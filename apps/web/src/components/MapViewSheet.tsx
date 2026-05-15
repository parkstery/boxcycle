import { useEffect, useState } from "react";
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
  { value: "free", label: "free" },
  { value: "keep", label: "유지" },
  { value: "north", label: "북향" },
  { value: "rear30", label: "후방" },
  { value: "front30", label: "전방" },
  { value: "leftFlat", label: "좌측" },
  { value: "rightFlat", label: "우측" },
];

const FOLLOW_TITLES: Record<FollowMode, string> = {
  free: "Free camera",
  keep: "Follow, keep bearing",
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!props.open) {
      setAdvancedOpen(false);
      return;
    }
    if (props.coverageOverlayMode !== "off") {
      setAdvancedOpen(true);
    }
  }, [props.open, props.coverageOverlayMode]);

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

        <div className="map-view-sheet__advanced">
          <button
            type="button"
            className="map-view-sheet__advanced-toggle"
            id="map-view-advanced-toggle"
            aria-expanded={advancedOpen}
            aria-controls="map-view-advanced-panel"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <span className="map-view-sheet__advanced-leading">
              <strong>고급</strong>
              <span className="map-view-sheet__advanced-sub">노선·Mapillary</span>
            </span>
            {props.coverageOverlayMode !== "off" && !advancedOpen ? (
              <span className="map-view-sheet__advanced-pill">
                {COVERAGE_OVERLAY_OPTIONS.find((o) => o.value === props.coverageOverlayMode)?.label}
              </span>
            ) : null}
            <span className="map-view-sheet__advanced-chevron" aria-hidden>
              {advancedOpen ? "▾" : "▸"}
            </span>
          </button>
          {advancedOpen ? (
            <div id="map-view-advanced-panel" className="map-view-sheet__advanced-body" role="region" aria-labelledby="map-view-advanced-toggle">
              <div className="map-view-sheet__group map-view-sheet__group--in-advanced">
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
            </div>
          ) : null}
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

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label-title">줌</span>
          <div className="map-view-sheet__row-body map-view-sheet__row-body--zoom">
            <span className="map-view-sheet__zoom-readout" aria-live="polite">
              {props.mapZoom.toFixed(1)}
            </span>
            <input
              type="range"
              className="map-view-sheet__range"
              min={3}
              max={20}
              step={0.1}
              value={props.mapZoom}
              onChange={(e) => props.onMapZoom(Number(e.target.value))}
              aria-label={`줌 ${props.mapZoom.toFixed(1)}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { useDialogFocus } from "../ui/useDialogFocus";
import { useEscapeKeyClose } from "../ui/useEscapeKeyClose";
import { usePanelHeaderCloseDrag } from "../ui/usePanelHeaderCloseDrag";
import type { CoverageOverlayMode } from "../../lib/activity/coverageOverlayMode";
import { COVERAGE_OVERLAY_OPTIONS } from "../../lib/activity/coverageOverlayMode";
import {
  RIDE_CAMERA_DISTANCE_MIN_M,
  RIDE_CAMERA_DISTANCE_MAX_M,
  RIDE_CAMERA_DISTANCE_STEP_M,
} from "../../lib/map/mapGlobeView";
import type { ConquestDisplayMode } from "./routeConquestLayers";
import "./MapViewSheet.css";
import { SettingsCloseIcon } from "../ui/SettingsCloseIcon";

type MapViewSheetProps = {
  open: boolean;
  onClose: () => void;
  coverageOverlayMode: CoverageOverlayMode;
  onCoverageOverlayMode: (m: CoverageOverlayMode) => void;
  enable3D: boolean;
  onEnable3D: (v: boolean) => void;
  /** 주행 중이면 "줌" 그룹이 "거리" 슬라이더로 바뀐다(개발용, 최적값 확정 후 제거 예정) */
  rideActive: boolean;
  rideCameraDistanceM: number;
  onRideCameraDistanceM: (m: number) => void;
  conquestDisplayMode: ConquestDisplayMode;
  conquestHasRecentGeometry: boolean;
  onConquestDisplayMode: (mode: ConquestDisplayMode) => void;
  onShowAllConquest: () => void;
  revealProgress?: number | null;
};

function coverageDisplayLabel(value: CoverageOverlayMode, fallback: string): string {
  if (value === "osrm") return "도로 비교";
  return fallback;
}

/**
 * BC 슬롯에서 위로 슬라이드 인 하는 맵 뷰 컨트롤 시트.
 * 각 블록은 한 줄: 왼쪽 타이틀 · 오른쪽 컨트롤(줄바꿈 없이, 필요 시 가로 스크롤).
 */
export function MapViewSheet(props: MapViewSheetProps) {
  const { onClose } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setAdvancedOpen(false);
  }
  const [headerReveal, setHeaderReveal] = useState<number | null>(null);
  useDialogFocus(props.open, panelRef);
  const headerDrag = usePanelHeaderCloseDrag({
    enabled: props.open,
    closeDir: 1,
    onProgress: setHeaderReveal,
    onClose,
  });

  useEscapeKeyClose(props.open, onClose);

  const revealing = props.revealProgress != null;
  if (!props.open && !revealing) return null;
  const reveal =
    headerReveal ?? (props.open ? (props.revealProgress ?? 1) : (props.revealProgress ?? 0));

  return (
    <div
      className={`map-view-sheet settings-surface${props.open ? " is-open" : ""}${headerReveal != null || revealing ? " is-dragging" : ""}`}
      role="dialog"
      aria-label="맵 뷰"
      id="map-view-sheet"
      aria-hidden={!props.open}
      {...(!props.open ? { inert: true } : {})}
      style={{ ["--map-view-reveal" as string]: reveal }}
    >
      <button
        type="button"
        className="map-view-sheet__scrim"
        aria-label="닫기"
        title="닫기"
        onClick={props.onClose}
      />
      <div className="map-view-sheet__panel settings-surface__panel" ref={panelRef}>
        <div className="map-view-sheet__handle" aria-hidden />
        <div className="map-view-sheet__head settings-surface__head" {...headerDrag}>
          <span className="map-view-sheet__head-title settings-surface__title">맵 뷰</span>
          <button
            type="button"
            className="map-view-sheet__close settings-surface__close"
            aria-label="맵 뷰 닫기"
            title="닫기"
            onClick={props.onClose}
          >
            <SettingsCloseIcon />
          </button>
        </div>

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label-title">내 도로망</span>
          <div className="map-view-sheet__row-body">
            <div className="map-view-sheet__chips map-view-sheet__chips--inline">
              <button
                type="button"
                className={`map-view-sheet__chip ${props.conquestDisplayMode === "all" ? "is-active" : ""}`}
                onClick={() => {
                  props.onConquestDisplayMode("all");
                  props.onShowAllConquest();
                }}
              >
                전체 도로망
              </button>
              <button
                type="button"
                className={`map-view-sheet__chip ${props.conquestDisplayMode === "recent" ? "is-active" : ""}`}
                disabled={!props.conquestHasRecentGeometry}
                onClick={() => props.onConquestDisplayMode("recent")}
              >
                신규 도로만
              </button>
            </div>
          </div>
        </div>

        <div className="map-view-sheet__group">
          <span className="map-view-sheet__label-title">지도</span>
          <div className="map-view-sheet__row-body">
            <label
              className="map-view-sheet__check map-view-sheet__check--inline-3d"
              title="지도 기울기와 3D 건물 표시"
            >
              <input
                type="checkbox"
                role="switch"
                checked={props.enable3D}
                onChange={(e) => props.onEnable3D(e.target.checked)}
              />
              3D 뷰
            </label>
          </div>
        </div>

        <details
          className="map-view-sheet__advanced"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="map-view-sheet__advanced-toggle">
            <span className="map-view-sheet__advanced-leading">
              <strong>고급 설정</strong>
              <span className="map-view-sheet__advanced-sub">
                도로 비교와 주행 거리 조정
              </span>
            </span>
          </summary>
          <div className="map-view-sheet__advanced-body">
            <div className="map-view-sheet__group map-view-sheet__group--in-advanced">
              <span className="map-view-sheet__label-title">노선</span>
              <div className="map-view-sheet__row-body">
                <div className="map-view-sheet__chips map-view-sheet__chips--inline">
                  {COVERAGE_OVERLAY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title="지도 도로와 경로 엔진이 다를 수 있습니다"
                      className={`map-view-sheet__chip ${
                        props.coverageOverlayMode === opt.value ? "is-active" : ""
                      }`}
                      onClick={() => props.onCoverageOverlayMode(opt.value)}
                    >
                      {coverageDisplayLabel(opt.value, opt.label)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {props.rideActive ? (
              <div className="map-view-sheet__group map-view-sheet__group--in-advanced">
                <span className="map-view-sheet__label-title">거리</span>
                <div className="map-view-sheet__row-body map-view-sheet__row-body--zoom">
                  <button
                    type="button"
                    className="map-view-sheet__zoom-step"
                    title="한 눈금 가깝게"
                    aria-label="거리 한 눈금 가깝게"
                    onClick={() => {
                      const m =
                        Math.round((props.rideCameraDistanceM - RIDE_CAMERA_DISTANCE_STEP_M) * 10) /
                        10;
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
                    title="한 눈금 멀게"
                    aria-label="거리 한 눈금 멀게"
                    onClick={() => {
                      const m =
                        Math.round((props.rideCameraDistanceM + RIDE_CAMERA_DISTANCE_STEP_M) * 10) /
                        10;
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
                    step={RIDE_CAMERA_DISTANCE_STEP_M}
                    value={Math.min(
                      RIDE_CAMERA_DISTANCE_MAX_M,
                      Math.max(RIDE_CAMERA_DISTANCE_MIN_M, props.rideCameraDistanceM),
                    )}
                    onChange={(e) => props.onRideCameraDistanceM(Number(e.target.value))}
                    aria-label={`거리 ${props.rideCameraDistanceM.toFixed(1)}m`}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}

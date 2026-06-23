import { useEffect, useState } from "react";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import { SAVED_ROUTE_NAME_MAX, validateSavedRouteName } from "../../lib/firestoreSavedRoutes";
import { formatVirtualRideDurationLabel } from "../../lib/virtualRideDuration";
import { SESSION_SPEED_MIN_KMH } from "../../lib/sessionSpeedKmh";
import { SessionSpeedControl } from "./SessionSpeedControl";
import type { RouteDockStop, RouteDockStopId } from "./useRouteDockStops";
import "./RouteDock.css";

export type RouteDockProps = {
  stage: RideUiStage;
  stops: RouteDockStop[];
  routeDistanceMeters: number;
  hasRoute: boolean;
  routeLoading: boolean;
  speedKmh: number;
  onSpeedKmh: (n: number) => void;
  canStartRide: boolean;
  canSaveRoute: boolean;
  onSaveCurrentRoute: (name: string) => Promise<void> | void;
  onStartRide: () => void;
  onClearRoute: () => void;
  onRemoveStop: (id: RouteDockStopId) => void;
  onFocusStop: (stop: RouteDockStop) => void;
  editLocked?: boolean;
};

const STOP_KIND_LABEL: Record<RouteDockStop["kind"], string> = {
  start: "S",
  waypoint: "·",
  end: "E",
};

export function RouteDock(props: RouteDockProps) {
  const {
    stage,
    stops,
    routeDistanceMeters,
    hasRoute,
    routeLoading,
    speedKmh,
    onSpeedKmh,
    canStartRide,
    canSaveRoute,
    onSaveCurrentRoute,
    onStartRide,
    onClearRoute,
    onRemoveStop,
    onFocusStop,
    editLocked = false,
  } = props;

  const visible = stage === "setup" || stage === "ready-to-start";
  const [expanded, setExpanded] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveDraft, setSaveDraft] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && stops.length > 0) setExpanded(true);
  }, [visible, stops.length]);

  async function commitSave() {
    if (saveBusy) return;
    let normalizedName: string;
    try {
      normalizedName = validateSavedRouteName(saveDraft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSaveBusy(true);
    setSaveError(null);
    try {
      await onSaveCurrentRoute(normalizedName);
      setSaveOpen(false);
      setSaveDraft("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }
  if (!visible) return null;

  const distanceKmLabel =
    hasRoute && routeDistanceMeters > 0 ? (routeDistanceMeters / 1000).toFixed(1) : null;
  const durationLabel =
    distanceKmLabel != null ? formatVirtualRideDurationLabel(routeDistanceMeters, speedKmh) : null;

  return (
    <div
      className={`route-dock-anchor${expanded ? " route-dock-anchor--open" : ""}`}
      aria-label="경로 설정"
    >
      <div className="route-dock__shell">
        <button
          type="button"
          className="route-dock__caret hud-glass"
          aria-expanded={expanded}
          aria-label={expanded ? "경로 패널 접기" : "경로 패널 펼치기"}
          title={expanded ? "접기" : "펼치기"}
          onClick={() => setExpanded((v) => !v)}
        >
          <svg
            className="route-dock__caret-icon"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden
          >
            {expanded ? (
              <path
                d="M14 6l-6 6 6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M10 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>

        <div
          className="route-dock__panel hud-glass"
          hidden={!expanded}
          aria-hidden={!expanded}
        >
        <header className="route-dock__head">
          <h2 className="route-dock__title">경로</h2>
          <div className="route-dock__head-actions">
            {!saveOpen ? (
              <button
                type="button"
                className="route-dock__save-trigger"
                disabled={!canSaveRoute || editLocked}
                title="Save as my route"
                onClick={() => {
                  setSaveError(null);
                  setSaveDraft("");
                  setSaveOpen(true);
                }}
              >
                내 경로로 저장
              </button>
            ) : null}
            <button
              type="button"
              className="route-dock__icon-btn"
              disabled={editLocked || stops.length === 0}
              aria-label="경로 전체 삭제"
              title="경로 전체 삭제"
              onClick={onClearRoute}
            >
              삭제
            </button>
          </div>
        </header>

        {saveOpen ? (
          <div className="route-dock__save-form">
            <label className="route-dock__save-label" htmlFor="route-dock-save-name">
              경로 이름
            </label>
            <input
              id="route-dock-save-name"
              className="route-dock__save-input"
              type="text"
              maxLength={SAVED_ROUTE_NAME_MAX}
              value={saveDraft}
              placeholder="예: 한강"
              autoFocus
              onChange={(e) => setSaveDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitSave();
                if (e.key === "Escape") {
                  setSaveOpen(false);
                  setSaveDraft("");
                  setSaveError(null);
                }
              }}
            />
            {saveError ? (
              <p className="route-dock__save-error" role="alert">
                {saveError}
              </p>
            ) : null}
            <div className="route-dock__save-actions">
              <button
                type="button"
                className="route-dock__save-commit"
                disabled={saveBusy}
                onClick={() => void commitSave()}
              >
                {saveBusy ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                className="route-dock__save-cancel"
                disabled={saveBusy}
                onClick={() => {
                  setSaveOpen(false);
                  setSaveDraft("");
                  setSaveError(null);
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : null}

        <ul className="route-dock__stops" role="list">
          {stops.length === 0 ? (
            <li className="route-dock__stops-empty">지도를 탭해 출발·도착을 설정하세요</li>
          ) : (
            stops.map((stop, index) => (
              <li key={stop.id}>
                <button
                  type="button"
                  className="route-dock__stop"
                  onClick={() => onFocusStop(stop)}
                  title="지도에서 보기"
                >
                  <span
                    className={`route-dock__stop-dot route-dock__stop-dot--${stop.kind}`}
                    aria-hidden
                  >
                    {stop.kind === "waypoint"
                      ? String((stop.waypointIndex ?? index) + 1)
                      : STOP_KIND_LABEL[stop.kind]}
                  </span>
                  <span
                    className="route-dock__stop-label"
                    title={stop.loading ? undefined : stop.label}
                  >
                    {stop.loading ? "주소 불러오는 중…" : stop.label}
                  </span>
                </button>
                <button
                  type="button"
                  className="route-dock__stop-remove"
                  disabled={editLocked}
                  aria-label={`${stop.kind === "start" ? "출발" : stop.kind === "end" ? "도착" : "경유"} 삭제`}
                  onClick={() => onRemoveStop(stop.id)}
                >
                  ✕
                </button>
              </li>
            ))
          )}
        </ul>

        <SessionSpeedControl speedKmh={speedKmh} onSpeedKmh={onSpeedKmh} disabled={editLocked} />

        <footer className="route-dock__foot">
          <div className="route-dock__summary" aria-live="polite">
            {distanceKmLabel != null ? (
              <>
                <strong>{distanceKmLabel} km</strong>
                <span className="route-dock__summary-sep" aria-hidden>
                  {" "}
                </span>
                <span>{durationLabel}</span>
              </>
            ) : (
              <span className="route-dock__summary-muted">
                {routeLoading ? "경로 계산 중…" : "출발·도착 후 거리 표시"}
              </span>
            )}
          </div>
          <div className="route-dock__foot-actions">
            <button
              type="button"
              className="route-dock__reset-speed"
              disabled={editLocked || speedKmh === SESSION_SPEED_MIN_KMH}
              aria-label="속도 기본값"
              title={`속도 ${SESSION_SPEED_MIN_KMH} km/h`}
              onClick={() => onSpeedKmh(SESSION_SPEED_MIN_KMH)}
            >
              ↺
            </button>
            {stage === "ready-to-start" ? (
              <button
                type="button"
                className="route-dock__go"
                disabled={!canStartRide || routeLoading || editLocked}
                aria-label="주행 시작"
                title="Start ride"
                onClick={onStartRide}
              >
                Go
              </button>
            ) : null}
          </div>
        </footer>
        </div>
      </div>
    </div>
  );
}

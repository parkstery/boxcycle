import { useState } from "react";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import { isRouteDockVisible, routeDockUiPolicy } from "../../lib/route/routeDockUiPolicy";
import type { RouteDockStop, RouteDockStopId } from "./useRouteDockStops";
import "./RouteDock.css";

export type RouteDockProps = {
  stage: RideUiStage;
  stops: RouteDockStop[];
  routeLoading: boolean;
  onRemoveStop: (id: RouteDockStopId) => void;
  onFocusStop: (stop: RouteDockStop) => void;
  /** 출발↔도착을 바꾸고 경유지 순서를 뒤집는다. 출발·도착이 모두 있을 때만 보인다 */
  onSwapEndpoints?: () => void;
  editLocked?: boolean;
};
const STOP_KIND_LABEL: Record<RouteDockStop["kind"], string> = { start: "S", waypoint: "·", end: "E" };

/** Addresses only: collapsing the route never hides ride controls or the sensor. */
export function RouteDock({stage, stops, routeLoading, onRemoveStop, onFocusStop, onSwapEndpoints, editLocked = false}: RouteDockProps) {
  const [expanded, setExpanded] = useState(true);
  const { lockStopEditing, isActiveRide } = routeDockUiPolicy(stage, editLocked);
  if (!isRouteDockVisible(stage) || stops.length === 0) return null;
  const canSwap = Boolean(onSwapEndpoints) && !lockStopEditing &&
    stops.some(s => s.kind === "start") && stops.some(s => s.kind === "end");
  return (
    <div className={`route-dock-anchor${expanded ? " route-dock-anchor--open" : ""}`} aria-label="경로 보기" aria-busy={routeLoading}>
      <div className="route-dock__shell">
        <button type="button" className="route-dock__caret" aria-expanded={expanded}
          aria-label={expanded ? "경로 패널 접기" : "경로 패널 펼치기"} onClick={() => setExpanded(v => !v)}>
          <span aria-hidden>{expanded ? "‹" : "›"}</span>
        </button>
        <div className="route-dock__body">
          <div className="route-dock__panel" hidden={!expanded} aria-hidden={!expanded}>
          <ul className="route-dock__stops" role="list">
            {stops.length === 0 ? (
              isActiveRide ? null : (
                <li className="route-dock__stops-empty">지도를 탭해 출발·도착 설정</li>
              )
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
                    disabled={lockStopEditing}
                    aria-label={`${stop.kind === "start" ? "출발" : stop.kind === "end" ? "도착" : "경유"} 삭제`}
                    title={`${stop.kind === "start" ? "출발" : stop.kind === "end" ? "도착" : "경유"} 삭제`}
                    onClick={() => onRemoveStop(stop.id)}
                  >
                    ✕
                  </button>
                </li>
              ))
            )}
          </ul>
          {canSwap ? (
            <button type="button" className="route-dock__swap" aria-label="출발·도착 바꾸기"
              title="출발·도착 바꾸기" onClick={onSwapEndpoints}>
              <span aria-hidden>⇅</span>
            </button>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

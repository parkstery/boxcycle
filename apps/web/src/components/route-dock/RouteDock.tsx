import { useEffect, useRef, useState } from "react";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import {
  isRouteDockActiveRide,
  isRouteDockVisible,
  routeDockDefaultExpanded,
  routeDockUiPolicy,
} from "../../lib/route/routeDockUiPolicy";
import { sensorChipSlot } from "../../lib/route/sensorChipSlot";
import { CadenceHudChip, type CadenceChipBinding } from "../maphud/CadenceHudChip";
import type { RouteDockStop, RouteDockStopId } from "./useRouteDockStops";
import "../maphud/CadenceHudChip.css";
import "./RouteDock.css";

export type RouteDockProps = {
  stage: RideUiStage;
  stops: RouteDockStop[];
  routeLoading: boolean;
  onRemoveStop: (id: RouteDockStopId) => void;
  onFocusStop: (stop: RouteDockStop) => void;
  onSwapEndpoints?: () => void;
  editLocked?: boolean;
  cadence?: CadenceChipBinding | null;
  sensorAttention?: boolean;
};

const KIND_LABEL: Record<RouteDockStop["kind"], string> = {
  start: "출발",
  waypoint: "경유",
  end: "도착",
};

/** Addresses (+ sensor chip when ready). Stays visible during ride; editing locks while riding. */
export function RouteDock({
  stage,
  stops,
  routeLoading,
  onRemoveStop,
  onFocusStop,
  onSwapEndpoints,
  editLocked = false,
  cadence = null,
  sensorAttention = false,
}: RouteDockProps) {
  const [expanded, setExpanded] = useState(() => routeDockDefaultExpanded(stage));
  const prevStageRef = useRef(stage);
  const { lockStopEditing } = routeDockUiPolicy(stage, editLocked);

  useEffect(() => {
    const prev = prevStageRef.current;
    prevStageRef.current = stage;
    const wasActive = isRouteDockActiveRide(prev);
    const nowActive = isRouteDockActiveRide(stage);
    if (!wasActive && nowActive) {
      setExpanded(false);
    } else if (wasActive && !nowActive) {
      setExpanded(true);
    }
  }, [stage]);
  if (!isRouteDockVisible(stage)) return null;
  if (stops.length === 0 && !cadence) return null;

  const canSwap =
    Boolean(onSwapEndpoints) &&
    !lockStopEditing &&
    stops.some((s) => s.kind === "start") &&
    stops.some((s) => s.kind === "end");
  const sensorInDock =
    sensorChipSlot({ stage, hasCadence: Boolean(cadence), expanded: true }) === "route-dock";
  const sensorFooter =
    sensorInDock && cadence ? (
      <div className="route-dock__footer">
        <CadenceHudChip
          placement="dock"
          state={cadence.state}
          riding={false}
          open={cadence.open}
          onOpen={cadence.onOpen}
          attention={sensorAttention}
        />
      </div>
    ) : null;

  return (
    <div
      className={`route-dock-anchor${expanded ? " route-dock-anchor--open" : ""}`}
      aria-label="경로 보기"
      aria-busy={routeLoading}
    >
      <div className="route-dock__card">
        <div
          className={`route-dock__grid${lockStopEditing ? " route-dock__grid--locked" : ""}`}
        >
          <ol className="route-dock__stops" role="list">
            {stops.length === 0 ? (
              <li className="route-dock__stops-empty">지도를 탭해 출발·도착 설정</li>
            ) : (
              stops.map((stop) => (
                <li key={stop.id} className="route-dock__row">
                  <button
                    type="button"
                    className="route-dock__stop"
                    onClick={() => onFocusStop(stop)}
                    title="지도에서 보기"
                  >
                    <span
                      className={`route-dock__dot route-dock__dot--${stop.kind}`}
                      aria-hidden
                    />
                    <span className="route-dock__kind">{KIND_LABEL[stop.kind]}</span>
                    <span className="route-dock__label" title={stop.loading ? undefined : stop.label}>
                      {stop.loading ? "주소 불러오는 중…" : stop.label}
                    </span>
                  </button>
                  {!lockStopEditing ? (
                    <button
                      type="button"
                      className="route-dock__remove"
                      aria-label={`${KIND_LABEL[stop.kind]} 삭제`}
                      onClick={() => onRemoveStop(stop.id)}
                    >
                      ✕
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ol>
          {canSwap ? (
            <button
              type="button"
              className="route-dock__swap"
              aria-label="출발·도착 바꾸기"
              onClick={onSwapEndpoints}
            >
              <span className="route-dock__swap-icon" aria-hidden />
            </button>
          ) : lockStopEditing ? null : (
            <span className="route-dock__swap-spacer" aria-hidden />
          )}
        </div>
        {expanded ? sensorFooter : null}
        <button
          type="button"
          className="route-dock__caret"
          aria-expanded={expanded}
          aria-label={expanded ? "경로 패널 접기" : "경로 패널 펼치기"}
          onClick={() => setExpanded((v) => !v)}
        >
          <span aria-hidden>{expanded ? "‹" : "›"}</span>
        </button>
      </div>
      {!expanded ? sensorFooter : null}
    </div>
  );
}

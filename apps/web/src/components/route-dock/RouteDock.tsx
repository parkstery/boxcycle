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

/* 2026-10-24 Chief 제안 A: 글자 기호(✕ ‹ ›)·CSS 막대 대신 선 1.7 인라인 아이콘. 색은 currentColor. */
function DockIcon({ d, size }: { d: string; size: number }) {
  return (
    <svg
      className="route-dock__icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const ICON_REMOVE = "M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5";
const ICON_SWAP = "M5 13V3M2.5 5.5L5 3L7.5 5.5M11 3V13M8.5 10.5L11 13L13.5 10.5";
const ICON_COLLAPSE = "M10 3.5L5.5 8L10 12.5";
const ICON_EXPAND = "M6 3.5L10.5 8L6 12.5";

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
          <div className={`route-dock__stops-wrap${canSwap ? " route-dock__stops-wrap--swap" : ""}`}>
            <ol className="route-dock__stops" role="list">
              {stops.length === 0 ? (
                <li className="route-dock__stops-empty">지도를 탭해 출발·도착 설정</li>
              ) : (
                stops.map((stop) => (
                  <li key={stop.id} className={`route-dock__row route-dock__row--${stop.kind}`}>
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
                        <DockIcon d={ICON_REMOVE} size={11} />
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ol>
            {/* 2026-10-24 Chief: ⇅ 는 목록 앞쪽 — 점 열 위, 목록 세로 가운데(출발·도착 사이). */}
            {canSwap ? (
              <button
                type="button"
                className="route-dock__swap"
                aria-label="출발·도착 바꾸기"
                onClick={onSwapEndpoints}
              >
                <DockIcon d={ICON_SWAP} size={12} />
              </button>
            ) : null}
          </div>
          {lockStopEditing ? null : <span className="route-dock__swap-spacer" aria-hidden />}
        </div>
        {expanded ? sensorFooter : null}
        <button
          type="button"
          className="route-dock__caret"
          aria-expanded={expanded}
          aria-label={expanded ? "경로 패널 접기" : "경로 패널 펼치기"}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <DockIcon d={ICON_COLLAPSE} size={12} /> : <DockIcon d={ICON_EXPAND} size={16} />}
        </button>
      </div>
      {!expanded ? sensorFooter : null}
    </div>
  );
}

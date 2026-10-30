import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import {
  isRouteDockActiveRide,
  isRouteDockVisible,
  routeDockDefaultExpanded,
  routeDockUiPolicy,
} from "../../lib/route/routeDockUiPolicy";
import { sensorChipSlot } from "../../lib/route/sensorChipSlot";
import { cadenceChipView } from "../../lib/sensor/cadenceSensorUi";
import { CadenceHudChip, type CadenceChipBinding } from "../maphud/CadenceHudChip";
import { RouteOverviewFoldToggle } from "./RouteOverviewFoldToggle";
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
  onOpenIntervalSettings?: () => void;
  /** 지도 핀 — 경로 목록 창(기본 「내 경로」)을 연다. 주행 전에만 보인다(10-30 Chief) */
  onOpenRouteList?: () => void;
  /** ⚙ — 주행 설정 창을 연다. 주행 전엔 핀 오른쪽, 주행 중엔 INT 자리(10-30 Chief) */
  onOpenSettings?: () => void;
  intervalEnabled?: boolean;
  rideControls?: ReactNode;
};

/* 2026-10-24 Chief: 「출발·경유·도착」 글자 대신 지도 핀과 같은 기호 S · 1 2 3 · E(영어로 통일). */
function stopBadge(stop: RouteDockStop): string {
  if (stop.kind === "start") return "S";
  if (stop.kind === "end") return "E";
  return String((stop.waypointIndex ?? 0) + 1);
}

function stopName(stop: RouteDockStop): string {
  if (stop.kind === "start") return "Start";
  if (stop.kind === "end") return "End";
  return `WP${(stop.waypointIndex ?? 0) + 1}`;
}

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
const ROUTE_DOCK_PANEL_ID = "route-dock-panel";

/** Addresses (+ sensor chip when expanded). Stays visible during ride; editing locks while riding. */
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
  onOpenIntervalSettings,
  onOpenRouteList,
  onOpenSettings,
  intervalEnabled = false,
  rideControls,
}: RouteDockProps) {
  const [expanded, setExpanded] = useState(() => routeDockDefaultExpanded(stage, stops.length));
  const [prevStage, setPrevStage] = useState(stage);
  const [prevStopCount, setPrevStopCount] = useState(stops.length);
  const ledRef = useRef<HTMLButtonElement>(null);
  const foldRef = useRef<HTMLButtonElement>(null);
  const focusAfterToggle = useRef<"led" | "fold" | null>(null);
  const { lockStopEditing } = routeDockUiPolicy(stage, editLocked);
  const activeRide = isRouteDockActiveRide(stage);
  useLayoutEffect(() => {
    const next = focusAfterToggle.current;
    if (!next) return;
    focusAfterToggle.current = null;
    (next === "fold" ? foldRef.current : ledRef.current)?.focus();
  }, [expanded]);

  /*
   * 주행 시작엔 접고 끝나면 편다. effect 에서 바꾸면 펼친 카드가 한 번 commit 된 뒤 접혀
   * 주행 시작 순간 깜빡였다(감리40 LOW, 10-25 해소) — 렌더 중에 이전 stage 와 비교해 맞춘다.
   * 경로가 생기면 자동 펼침, 삭제되면 LED만.
   */
  if (stage !== prevStage) {
    setPrevStage(stage);
    const wasActive = isRouteDockActiveRide(prevStage);
    const nowActive = isRouteDockActiveRide(stage);
    if (!wasActive && nowActive) {
      setExpanded(false);
    } else if (wasActive && !nowActive) {
      setExpanded(stops.length > 0);
    }
  }
  if (stops.length !== prevStopCount) {
    setPrevStopCount(stops.length);
    if (stops.length > 0 && prevStopCount === 0 && !isRouteDockActiveRide(stage)) {
      setExpanded(true);
    } else if (stops.length === 0 && prevStopCount > 0 && !isRouteDockActiveRide(stage)) {
      setExpanded(false);
    }
  }
  if (!isRouteDockVisible(stage)) return null;
  const sensorInDock =
    sensorChipSlot({ stage, hasCadence: Boolean(cadence), expanded }) === "route-dock";
  // 지시10: 빈 경로에서는 주소 판을 남기지 않는다. 센서·INT 가 이 카드에 배치될 때만 예외다.
  if (stops.length === 0 && !sensorInDock && !onOpenIntervalSettings && !onOpenRouteList && !onOpenSettings) return null;

  const canSwap =
    Boolean(onSwapEndpoints) &&
    !lockStopEditing &&
    stops.some((s) => s.kind === "start") &&
    stops.some((s) => s.kind === "end");
  const sensorChip =
    sensorInDock && expanded && cadence ? (
      <CadenceHudChip
        placement="dock"
        state={cadence.state}
        riding={activeRide}
        open={cadence.open}
        onOpen={cadence.onOpen}
        attention={sensorAttention}
      />
    ) : null;
  // 10-30 Chief: 인터벌·경로 목록·주행 설정은 메인 메뉴에서 빠지고 여기서 연다(펼침·접힘 모두).
  // 주행 전: INT · 지도 핀 · ⚙ · 주행 시작 / 주행 중: INT 자리에 ⚙ 만(인터벌 변경 불가 — 의도).
  // 일시정지: ⚙ 자리에 INT 가 돌아온다 — 인터벌은 멈춘 뒤에만 바꾸고, 바꾸면 준비부터 다시 시작한다.
  const paused = stage === "paused";
  const intervalButton = onOpenIntervalSettings && (!activeRide || paused) ? (
    <button type="button" className={`route-dock__interval${intervalEnabled ? " route-dock__interval--active" : ""}`} aria-label="인터벌 운동 설정" title="인터벌 운동 설정" onClick={onOpenIntervalSettings}>
      INT
    </button>
  ) : null;
  const routeListButton = onOpenRouteList && !activeRide ? (
    <button type="button" className="route-dock__tool route-dock__tool--routes" aria-label="경로 목록" title="경로 목록" onClick={onOpenRouteList}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 21s-6.5-5.8-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z" />
        <circle cx="12" cy="10.5" r="2.3" />
      </svg>
    </button>
  ) : null;
  const settingsButton = onOpenSettings && !paused ? (
    <button type="button" className="route-dock__tool route-dock__tool--settings" aria-label="주행 설정" title="주행 설정" onClick={onOpenSettings}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M10.11 4.12L10.34 1.53A10.6 10.6 0 0 1 13.66 1.53L13.89 4.12A8.1 8.1 0 0 1 16.23 5.09L18.23 3.42A10.6 10.6 0 0 1 20.58 5.77L18.91 7.77A8.1 8.1 0 0 1 19.88 10.11L22.47 10.34A10.6 10.6 0 0 1 22.47 13.66L19.88 13.89A8.1 8.1 0 0 1 18.91 16.23L20.58 18.23A10.6 10.6 0 0 1 18.23 20.58L16.23 18.91A8.1 8.1 0 0 1 13.89 19.88L13.66 22.47A10.6 10.6 0 0 1 10.34 22.47L10.11 19.88A8.1 8.1 0 0 1 7.77 18.91L5.77 20.58A10.6 10.6 0 0 1 3.42 18.23L5.09 16.23A8.1 8.1 0 0 1 4.12 13.89L1.53 13.66A10.6 10.6 0 0 1 1.53 10.34L4.12 10.11A8.1 8.1 0 0 1 5.09 7.77L3.42 5.77A10.6 10.6 0 0 1 5.77 3.42L7.77 5.09A8.1 8.1 0 0 1 10.11 4.12ZM12 8.7a3.3 3.3 0 1 0 0 6.6a3.3 3.3 0 1 0 0 -6.6Z" />
      </svg>
    </button>
  ) : null;
  const toolButtons = (
    <>
      {intervalButton}
      {routeListButton}
      {settingsButton}
    </>
  );
  const ledConnected = cadence != null && cadenceChipView(cadence.state, false).led === "green";
  const setUserExpanded = (next: boolean) => {
    focusAfterToggle.current = next ? "fold" : "led";
    setExpanded(next);
  };

  return (
    <div
      className={`route-dock-anchor${expanded ? " route-dock-anchor--open" : ""}`}
      aria-label="경로 보기"
      aria-busy={routeLoading}
    >
      <div
        className={`route-dock__card${expanded ? " route-dock__card--head" : " route-dock__card--led"}`}
      >
        <div className={`route-dock__head${activeRide ? " route-dock__head--active" : ""}`}>
          {expanded ? (
            <>
              {sensorChip}
              {toolButtons}
              <RouteOverviewFoldToggle
                kind="route"
                expanded
                ariaLabel="경로 패널 접기"
                controls={ROUTE_DOCK_PANEL_ID}
                className="route-dock__fold"
                buttonRef={foldRef}
                onClick={() => setUserExpanded(false)}
              />
            </>
          ) : (
            <button
              ref={ledRef}
              type="button"
              className={`route-dock__led-toggle${ledConnected ? " route-dock__led-toggle--connected" : ""}`}
              aria-label="경로 패널 펼치기"
              title="경로 패널 펼치기"
              aria-expanded={false}
              aria-controls={ROUTE_DOCK_PANEL_ID}
              data-led={ledConnected ? "green" : "white"}
              onClick={() => setUserExpanded(true)}
            >
              <span className="route-dock__led" aria-hidden />
            </button>
          )}
          {!expanded ? toolButtons : null}
          {rideControls}
        </div>
        <div
          id={ROUTE_DOCK_PANEL_ID}
          className={`route-dock__grid${lockStopEditing ? " route-dock__grid--locked" : ""}`}
        >
          <div className="route-dock__stops-wrap">
            <ol className="route-dock__stops" role="list">
              {stops.length === 0 ? (
                <li className="route-dock__stops-empty">지도를 탭해 Start·End 설정</li>
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
                        className={`route-dock__badge route-dock__badge--${stop.kind}`}
                        aria-label={stopName(stop)}
                      >
                        {stopBadge(stop)}
                      </span>
                      <span className="route-dock__label" title={stop.loading ? undefined : stop.label}>
                        {stop.loading ? "주소 불러오는 중…" : stop.label}
                      </span>
                    </button>
                    {!lockStopEditing ? (
                      <button
                        type="button"
                        className="route-dock__remove"
                        aria-label={`${stopName(stop)} 삭제`}
                        title={`${stopName(stop)} 삭제`}
                        onClick={() => onRemoveStop(stop.id)}
                      >
                        <DockIcon d={ICON_REMOVE} size={11} />
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ol>
            {/* 2026-10-24 Chief: ⇅ 는 목록 앞쪽 — 기호 열 위, 목록 세로 가운데(S·E 사이). */}
            {canSwap ? (
              <button
                type="button"
                className="route-dock__swap"
                aria-label="Start·End 바꾸기"
                title="Start·End 바꾸기"
                onClick={onSwapEndpoints}
              >
                <DockIcon d={ICON_SWAP} size={12} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useLayoutEffect, useRef, useState } from "react";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import {
  isRouteDockActiveRide,
  isRouteDockVisible,
  routeDockDefaultExpanded,
  routeDockUiPolicy,
} from "../../lib/route/routeDockUiPolicy";
import { RouteOverviewFoldToggle } from "./RouteOverviewFoldToggle";
import type { RouteDockStop, RouteDockStopId } from "./useRouteDockStops";
import "./RouteDock.css";

export type RouteDockProps = {
  stage: RideUiStage;
  stops: RouteDockStop[];
  routeLoading: boolean;
  onRemoveStop: (id: RouteDockStopId) => void;
  onFocusStop: (stop: RouteDockStop) => void;
  onSwapEndpoints?: () => void;
  editLocked?: boolean;
  /** 접힌 줄의 미니맵 접기·펼치기(Chief 11-02 — 미니맵 위 28px 버튼 대체). 미니맵이 있을 때만 준다. */
  minimap?: { expanded: boolean; onToggle: () => void } | null;
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

/**
 * 경로 주소 카드. 주행 중에도 남고 편집만 잠긴다. 접히면 40px 경로 손잡이(+ 미니맵 버튼).
 * Chief 11-02 v4(B단계): 센서 LED·RPM 은 여기서 빠져 계기판 맨 앞 칸(`CadenceMetricCell`)으로 갔다.
 */
export function RouteDock({
  stage,
  stops,
  routeLoading,
  onRemoveStop,
  onFocusStop,
  onSwapEndpoints,
  editLocked = false,
  minimap = null,
}: RouteDockProps) {
  const [expanded, setExpanded] = useState(() => routeDockDefaultExpanded(stage, stops.length));
  const [prevStage, setPrevStage] = useState(stage);
  const [prevStopCount, setPrevStopCount] = useState(stops.length);
  const handleRef = useRef<HTMLButtonElement>(null);
  const foldRef = useRef<HTMLButtonElement>(null);
  const focusAfterToggle = useRef<"handle" | "fold" | null>(null);
  const { lockStopEditing } = routeDockUiPolicy(stage, editLocked);
  const activeRide = isRouteDockActiveRide(stage);
  useLayoutEffect(() => {
    const next = focusAfterToggle.current;
    if (!next) return;
    focusAfterToggle.current = null;
    (next === "fold" ? foldRef.current : handleRef.current)?.focus();
  }, [expanded]);

  /*
   * 주행 시작엔 접고 끝나면 편다. effect 에서 바꾸면 펼친 카드가 한 번 commit 된 뒤 접혀
   * 주행 시작 순간 깜빡였다(감리40 LOW, 10-25 해소) — 렌더 중에 이전 stage 와 비교해 맞춘다.
   * 경로가 생기면 자동 펼침, 삭제되면 카드를 내린다.
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
  // 지시10: 빈 경로에서는 주소 판을 남기지 않는다(센서는 계기판 칸이라 예외 없음).
  if (stops.length === 0) return null;

  const canSwap =
    Boolean(onSwapEndpoints) &&
    !lockStopEditing &&
    stops.some((s) => s.kind === "start") &&
    stops.some((s) => s.kind === "end");
  // Chief 11-02 v4: INT·주행 버튼은 오른쪽 2열 묶음, 지도 핀(경로 목록)·⚙(주행 설정)은 왼쪽 메뉴 머리줄로 옮겼다.
  const setUserExpanded = (next: boolean) => {
    focusAfterToggle.current = next ? "fold" : "handle";
    setExpanded(next);
  };

  return (
    <div
      className={`route-dock-anchor${expanded ? " route-dock-anchor--open" : ""}`}
      aria-label="경로 보기"
      aria-busy={routeLoading}
    >
      <div
        className={`route-dock__card${expanded ? " route-dock__card--head" : " route-dock__card--handle"}`}
      >
        <div className={`route-dock__head${activeRide ? " route-dock__head--active" : ""}`}>
          {expanded ? (
            <>
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
              ref={handleRef}
              type="button"
              className="route-dock__handle"
              aria-label="경로 패널 펼치기"
              title="경로 패널 펼치기"
              aria-expanded={false}
              aria-controls={ROUTE_DOCK_PANEL_ID}
              onClick={() => setUserExpanded(true)}
            >
              <svg viewBox="0 0 28 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                <circle cx="9" cy="6" r="2" />
                <circle cx="9" cy="14" r="2" />
                <path d="M11 6h8M11 14h8" />
              </svg>
            </button>
          )}
          {!expanded && minimap ? (
            <button type="button" className="route-dock__tool route-dock__tool--minimap" aria-label={minimap.expanded ? "미니맵 접기" : "미니맵 펼치기"}
              title={minimap.expanded ? "미니맵 접기" : "미니맵 펼치기"} aria-expanded={minimap.expanded} onClick={minimap.onToggle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z" />
                <path d="M8.5 4v13.5M15.5 6.5V20" />
              </svg>
            </button>
          ) : null}
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

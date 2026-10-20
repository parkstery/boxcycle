import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import type { LineStringGeometry, LngLat } from "../../lib/geo/geo";
import { ROUTE_LINE_COLOR } from "../../components/map/routeConquestLayers";
import { ridePulseAnimationDelay } from "../../lib/ride/ridePulse";
import {
  detectRideMilestone,
  isGoalFlagWaving,
  RIDE_MILESTONE_TEXT,
  type RideMilestoneKind,
} from "../../lib/ride/rideStory";
import {
  computeRouteMinimapSize,
  projectRouteMinimap,
  ROUTE_MINIMAP_PAD_PX,
  ROUTE_MINIMAP_PAD_TOP_PX,
  routeMinimapStaticImageUrl,
} from "./routeMinimapProjection";
import { isMapCutKeyActive } from "../../lib/map/mapCut";
import "./RouteMinimap.css";

export type RouteMinimapProps = {
  /** `riding`·`paused` 일 때만 true — false 면 null 반환(리렌더 방지) */
  active: boolean;
  routeGeometry: LineStringGeometry | null;
  /** 경로 폴리라인 위의 현재 위치 */
  liveLngLat: LngLat | null;
  /** 배경 정지 지도용. 비면 어두운 배경으로 폴백 */
  mapboxAccessToken: string;
  /** 경로상 누적 거리(이어달리기 offset 포함) — 이정표 판정(주행 스토리 M2) */
  traveledMeters: number;
  /** 경로 전체 거리 */
  routeMeters: number;
};

/** 이정표 띠가 보이는 시간 — 잠깐 보였다 사라진다(N8, 상시 표시 금지) */
const MILESTONE_BAND_MS = 4000;

const GAP_REM = 0.35;

type BoxState = {
  w: number;
  h: number;
  aspect: number;
};

function remToPx(rem: number): number {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return (Number.isFinite(root) ? root : 16) * rem;
}

/** 펄스 위상을 메인 지도 내 위치 마커·HUD 와 같은 격자에 못 박는다 — 마운트 때 한 번만 */
function lockRidePulsePhase(el: SVGCircleElement | null): void {
  if (el && !el.style.animationDelay) el.style.animationDelay = ridePulseAnimationDelay();
}

/** 종점 깃발 — 장대 밑동이 종점. 오른쪽 끝에 붙으면 깃발을 왼쪽으로 단다 */
const FLAG_POLE_H = 13;
const FLAG_W = 9;
const FLAG_H = 6;

function GoalFlag({ x, y, boxW, waving }: { x: number; y: number; boxW: number; waving: boolean }) {
  const dir = x + FLAG_W + 2 > boxW ? -1 : 1;
  const top = y - FLAG_POLE_H;
  const cell = FLAG_W / 3;
  const cells = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const cx = dir > 0 ? x + c * cell : x - (c + 1) * cell;
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={cx}
          y={top + r * (FLAG_H / 2)}
          width={cell}
          height={FLAG_H / 2}
          fill={(r + c) % 2 === 0 ? "#10151f" : "#ffffff"}
        />,
      );
    }
  }
  return (
    <g className={`route-minimap__goal${waving ? " route-minimap__goal--waving" : ""}`}>
      <line className="route-minimap__goal-pole" x1={x} y1={y} x2={x} y2={top} />
      {/* 깃발 천 — 펄럭일 땐 장대 쪽을 축으로 흔든다 */}
      <g
        className="route-minimap__goal-cloth"
        style={{ transformOrigin: `${x}px ${top + FLAG_H / 2}px` }}
      >
        {cells}
        <rect
        className="route-minimap__goal-frame"
        x={dir > 0 ? x : x - FLAG_W}
        y={top}
        width={FLAG_W}
        height={FLAG_H}
        fill="none"
      />
      </g>
      <circle className="route-minimap__goal-base" cx={x} cy={y} r={1.8} />
    </g>
  );
}

function nearlySame(a: number, b: number, eps = 1): boolean {
  return Math.abs(a - b) < eps;
}

/**
 * 주행 중 좌측 미니맵 — Outdoors 정지 지도 한 장 + SVG 경로·현재 위치.
 * 좌하단 스택에서 RouteDock 아래에 놓는다. dock 높이·HUD를 실측해 상자 크기를 제한한다.
 * 지도 터치 전파 차단. 접기·펼치기 버튼은 기본 터치·키보드 동작을 허용한다.
 */
export function RouteMinimap({
  active,
  routeGeometry,
  liveLngLat,
  mapboxAccessToken,
  traveledMeters,
  routeMeters,
}: RouteMinimapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentId = useId();
  const [expanded, setExpanded] = useState(true);

  // mapcut 측정 스위치 — `?mapcut=minimap` 이면 렌더 중지(DOM·정지 지도 요청·펄스 없음).
  const mapcutMinimapOff = isMapCutKeyActive("minimap");
  const effectiveActive = active && !mapcutMinimapOff;

  /*
   * 이정표(주행 스토리 M2) — 진행이 갱신될 때 직전 값과 비교해 「지나간」 순간만 띠를 띄운다.
   * 직전 값은 렌더 중 비교 패턴으로 state 에 둔다(effect 안 setState 금지 규칙).
   */
  const [prevTraveled, setPrevTraveled] = useState(traveledMeters);
  const [milestone, setMilestone] = useState<{ kind: RideMilestoneKind; seq: number } | null>(null);
  if (traveledMeters !== prevTraveled) {
    setPrevTraveled(traveledMeters);
    const kind = effectiveActive ? detectRideMilestone(prevTraveled, traveledMeters, routeMeters) : null;
    if (kind) setMilestone((m) => ({ kind, seq: (m?.seq ?? 0) + 1 }));
  }
  const milestoneSeq = milestone?.seq ?? 0;
  useEffect(() => {
    if (!milestoneSeq) return;
    const t = window.setTimeout(() => setMilestone(null), MILESTONE_BAND_MS);
    return () => window.clearTimeout(t);
  }, [milestoneSeq]);
  const flagWaving = effectiveActive && isGoalFlagWaving(traveledMeters, routeMeters);
  const [box, setBox] = useState<BoxState>({
    w: 0,
    h: 0,
    aspect: 1,
  });

  useLayoutEffect(() => {
    if (!effectiveActive || !routeGeometry) return;

    const sync = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // 두 패널 간격 ≥ 8px. 스택 CSS와 같은 값이다.
      const gapPx = Math.max(remToPx(GAP_REM), 8);

      const dockEl = document.querySelector(".route-dock-anchor");
      const tlEl = document.querySelector(".map-hud__tl");
      const stackEl = rootRef.current?.parentElement;

      let tlBottom: number | null = null;
      if (tlEl instanceof HTMLElement) {
        tlBottom = tlEl.getBoundingClientRect().bottom;
      }

      let availH: number;
      if (stackEl instanceof HTMLElement && dockEl instanceof HTMLElement) {
        // 스택 하단은 미니맵 크기와 무관하게 고정되어 측정·크기 변경 순환을 만들지 않는다.
        const stackBottom = stackEl.getBoundingClientRect().bottom;
        const dockHeight = dockEl.getBoundingClientRect().height;
        const topLimit = tlBottom != null ? tlBottom + gapPx : remToPx(0.6 + 2.55 + 0.35);
        availH = Math.max(0, stackBottom - dockHeight - gapPx - topLimit);
      } else {
        // 측정 대상 미발견 시에도 크기를 확보한다.
        availH = Math.max(40, vh * 0.35);
      }

      const fit = computeRouteMinimapSize(vw, vh, availH);
      // 정지 지도는 정수 px 로만 요청된다 — 상자도 정수로 맞춰야 이미지와 SVG 배율이 같다.
      const next = { ...fit, width: Math.floor(fit.width), height: Math.floor(fit.height) };
      setBox((prev) => {
        if (
          nearlySame(prev.w, next.width, 0.5) &&
          nearlySame(prev.h, next.height, 0.5)
        ) {
          return prev;
        }
        return {
          w: next.width,
          h: next.height,
          aspect: next.aspect,
        };
      });
    };

    sync();
    const raf = requestAnimationFrame(() => sync());
    void document.fonts?.ready?.then(() => sync());

    const ro = new ResizeObserver(() => sync());
    const dockEl = document.querySelector(".route-dock-anchor");
    if (dockEl instanceof Element) ro.observe(dockEl);
    const tlEl = document.querySelector(".map-hud__tl");
    if (tlEl instanceof Element) ro.observe(tlEl);
    if (document.body) ro.observe(document.body);

    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
    };
  }, [effectiveActive, routeGeometry]);

  const layout = useMemo(() => {
    if (!routeGeometry || box.w < 8 || box.h < 8) return null;
    return projectRouteMinimap(routeGeometry, box.w, box.h, ROUTE_MINIMAP_PAD_PX, ROUTE_MINIMAP_PAD_TOP_PX);
  }, [routeGeometry, box.w, box.h]);

  // 경로·상자 크기가 같으면 같은 URL — 주행 중 재요청 없음.
  const mapImageUrl = useMemo(
    () => (layout ? routeMinimapStaticImageUrl(layout, box.w, box.h, mapboxAccessToken) : null),
    [layout, box.w, box.h, mapboxAccessToken],
  );
  // 실패한 URL 을 기억해 어두운 배경으로 폴백한다(깨진 이미지 아이콘 금지). URL 이 바뀌면 다시 시도.
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const showMap = mapImageUrl != null && failedImageUrl !== mapImageUrl;

  const livePt = useMemo(() => {
    if (!layout || !liveLngLat) return null;
    return layout.project(liveLngLat);
  }, [layout, liveLngLat]);

  if (!effectiveActive || !routeGeometry || routeGeometry.coordinates.length < 1) {
    return null;
  }

  const blockMap = (e: PointerEvent | TouchEvent) => {
    e.stopPropagation();
    if (e.target instanceof Element && e.target.closest("button")) return;
    e.preventDefault();
  };

  return (
    <div
      ref={rootRef}
      className={`route-minimap hud-glass${showMap && expanded ? " route-minimap--map" : ""}${expanded ? "" : " route-minimap--collapsed"}`}
      role="group"
      aria-label="경로 미니맵"
      style={{
        width: expanded ? box.w || undefined : 24,
        height: box.h || undefined,
      }}
      onPointerDown={blockMap}
      onTouchStart={blockMap}
    >
      <div
        id={contentId}
        className="route-minimap__content"
        hidden={!expanded}
        role="img"
        aria-label="전체 경로와 현재 위치"
      >
      {showMap ? (
        <img
          className="route-minimap__map"
          src={mapImageUrl}
          alt=""
          width={box.w}
          height={box.h}
          draggable={false}
          onError={() => setFailedImageUrl(mapImageUrl)}
        />
      ) : null}
      {layout && box.w >= 8 && box.h >= 8 ? (
        <svg
          className="route-minimap__svg"
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
        >
          <path className="route-minimap__path-outline" d={layout.pathD} fill="none" />
          <path className="route-minimap__path" d={layout.pathD} fill="none" stroke={ROUTE_LINE_COLOR} />
          <circle
            className="route-minimap__endpoint route-minimap__endpoint--start"
            cx={layout.start.x}
            cy={layout.start.y}
            r={3.4}
          />
          <GoalFlag x={layout.end.x} y={layout.end.y} boxW={box.w} waving={flagWaving} />
          {livePt ? (
            <g className="route-minimap__live">
              <circle
                ref={lockRidePulsePhase}
                className="route-minimap__live-pulse"
                cx={livePt.x}
                cy={livePt.y}
                r={4}
              />
              <circle className="route-minimap__live-core" cx={livePt.x} cy={livePt.y} r={3.6} />
            </g>
          ) : null}
        </svg>
      ) : null}
      {milestone ? (
        <div key={milestone.seq} className="route-minimap__milestone" role="status">
          {RIDE_MILESTONE_TEXT[milestone.kind]}
        </div>
      ) : null}
      </div>
      <button
        type="button"
        className="route-minimap__toggle"
        aria-label={expanded ? "미니맵 접기" : "미니맵 펼치기"}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((value) => !value);
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d={expanded ? "m10 4-4 4 4 4" : "m6 4 4 4-4 4"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import type { LineStringGeometry, LngLat } from "../../lib/geo/geo";
import { computeRouteMinimapSize, projectRouteMinimap } from "./routeMinimapProjection";
import "./RouteMinimap.css";

export type RouteMinimapProps = {
  /** `riding`·`paused` 일 때만 true — false 면 null 반환(리렌더 방지) */
  active: boolean;
  routeGeometry: LineStringGeometry | null;
  /** 경로 폴리라인 위의 현재 위치 */
  liveLngLat: LngLat | null;
};

const GAP_REM = 0.35;

type BoxState = {
  w: number;
  h: number;
  aspect: number;
  /** viewport 하단에서 미니맵 bottom 까지 px. null = CSS 폴백 */
  bottomPx: number | null;
  leftPx: number | null;
};

function remToPx(rem: number): number {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return (Number.isFinite(root) ? root : 16) * rem;
}

function nearlySame(a: number, b: number, eps = 1): boolean {
  return Math.abs(a - b) < eps;
}

/**
 * 주행 중 좌측 미니맵 — SVG.
 * 위치는 RouteDock·좌상단 **실측**(지시06). 탭 없음 · 터치 지도 전파 차단.
 */
export function RouteMinimap({ active, routeGeometry, liveLngLat }: RouteMinimapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const collapsedDockTopRef = useRef<number | null>(null);
  const [box, setBox] = useState<BoxState>({
    w: 0,
    h: 0,
    aspect: 1,
    bottomPx: null,
    leftPx: null,
  });

  useLayoutEffect(() => {
    if (!active || !routeGeometry) return;

    const sync = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gapPx = remToPx(GAP_REM);

      const dockEl = document.querySelector(".route-dock-anchor");
      const tlEl = document.querySelector(".map-hud__tl");

      let dockTop: number | null = null;
      let dockLeft: number | null = null;
      if (dockEl instanceof HTMLElement) {
        const open = dockEl.classList.contains("route-dock-anchor--open");
        const r = dockEl.getBoundingClientRect();
        if (!open) {
          collapsedDockTopRef.current = r.top;
          dockLeft = r.left;
        }
        dockTop = collapsedDockTopRef.current;
        if (dockLeft == null) dockLeft = r.left;
      }

      let tlBottom: number | null = null;
      if (tlEl instanceof HTMLElement) {
        tlBottom = tlEl.getBoundingClientRect().bottom;
      }

      let availH: number;
      let bottomPx: number | null = null;
      let leftPx: number | null = null;

      if (dockTop != null && Number.isFinite(dockTop)) {
        // bottom = innerHeight − dockTop + gap  → 미니맵 하단이 dock 상단 − gap
        bottomPx = vh - dockTop + gapPx;
        leftPx = dockLeft;
        const topLimit = tlBottom != null ? tlBottom + gapPx : remToPx(0.6 + 2.55 + 0.35);
        availH = Math.max(0, dockTop - gapPx - topLimit);
      } else {
        // dock 미발견 — CSS 폴백. avail 은 대략치
        bottomPx = null;
        leftPx = null;
        availH = Math.max(40, vh * 0.35);
      }

      const next = computeRouteMinimapSize(vw, vh, availH);
      setBox((prev) => {
        if (
          nearlySame(prev.w, next.width, 0.5) &&
          nearlySame(prev.h, next.height, 0.5) &&
          ((prev.bottomPx == null && bottomPx == null) ||
            (prev.bottomPx != null && bottomPx != null && nearlySame(prev.bottomPx, bottomPx))) &&
          ((prev.leftPx == null && leftPx == null) ||
            (prev.leftPx != null && leftPx != null && nearlySame(prev.leftPx, leftPx)))
        ) {
          return prev;
        }
        return {
          w: next.width,
          h: next.height,
          aspect: next.aspect,
          bottomPx,
          leftPx,
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
  }, [active, routeGeometry]);

  const layout = useMemo(() => {
    if (!routeGeometry || box.w < 8 || box.h < 8) return null;
    return projectRouteMinimap(routeGeometry, box.w, box.h);
  }, [routeGeometry, box.w, box.h]);

  const livePt = useMemo(() => {
    if (!layout || !liveLngLat) return null;
    return layout.project(liveLngLat);
  }, [layout, liveLngLat]);

  if (!active || !routeGeometry || routeGeometry.coordinates.length < 1) {
    return null;
  }

  const blockMap = (e: PointerEvent | TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const measured = box.bottomPx != null;

  return (
    <div
      ref={rootRef}
      className={`route-minimap hud-glass${measured ? "" : " route-minimap--css-fallback"}`}
      role="img"
      aria-hidden
      aria-label="경로 미니맵"
      style={{
        width: box.w || undefined,
        height: box.h || undefined,
        ...(measured
          ? {
              left: box.leftPx ?? undefined,
              bottom: box.bottomPx ?? undefined,
            }
          : {}),
      }}
      onPointerDown={blockMap}
      onTouchStart={blockMap}
    >
      {layout && box.w >= 8 && box.h >= 8 ? (
        <svg
          className="route-minimap__svg"
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
        >
          <path className="route-minimap__path-outline" d={layout.pathD} fill="none" />
          <path className="route-minimap__path" d={layout.pathD} fill="none" />
          <circle
            className="route-minimap__endpoint route-minimap__endpoint--start"
            cx={layout.start.x}
            cy={layout.start.y}
            r={3.2}
          />
          <circle
            className="route-minimap__endpoint route-minimap__endpoint--end"
            cx={layout.end.x}
            cy={layout.end.y}
            r={3.2}
          />
          {livePt ? (
            <circle className="route-minimap__live" cx={livePt.x} cy={livePt.y} r={3.5} />
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}

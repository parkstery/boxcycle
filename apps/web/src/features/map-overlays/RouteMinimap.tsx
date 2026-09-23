import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import type { LineStringGeometry, LngLat } from "../../lib/geo";
import { computeRouteMinimapSize, projectRouteMinimap } from "./routeMinimapProjection";
import "./RouteMinimap.css";

export type RouteMinimapProps = {
  /** `riding`·`paused` 일 때만 true — false 면 null 반환(리렌더 방지) */
  active: boolean;
  routeGeometry: LineStringGeometry | null;
  /** 경로 폴리라인 위의 현재 위치 */
  liveLngLat: LngLat | null;
};

/**
 * 주행 중 좌측 미니맵 — SVG 한 장(전체 경로 · S/E · 현재 위치).
 * 상자 비 = 화면 비(지시03). 탭 동작 없음. 터치는 지도로 내려보내지 않는다.
 */
export function RouteMinimap({ active, routeGeometry, liveLngLat }: RouteMinimapProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0, aspect: 1 });

  useLayoutEffect(() => {
    if (!active || !routeGeometry) return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    const sync = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const availH = anchor.clientHeight;
      const next = computeRouteMinimapSize(vw, vh, availH);
      setBox((prev) =>
        Math.abs(prev.w - next.width) < 0.5 && Math.abs(prev.h - next.height) < 0.5
          ? prev
          : { w: next.width, h: next.height, aspect: next.aspect },
      );
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(anchor);
    if (anchor.offsetParent instanceof Element) ro.observe(anchor.offsetParent);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
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

  return (
    <div className="route-minimap-anchor" ref={anchorRef} aria-hidden>
      <div
        ref={rootRef}
        className="route-minimap hud-glass"
        role="img"
        aria-label="경로 미니맵"
        style={{ width: box.w || undefined, height: box.h || undefined }}
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
    </div>
  );
}

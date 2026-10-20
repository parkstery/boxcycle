import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

export const EDGE_DRAG_THRESHOLD_PX = 48;
export const EDGE_DRAG_MIN_INTENT_PX = 24;
export const EDGE_DRAG_TAP_SLOP_PX = 6;
export const EDGE_DRAG_AXIS_LOCK_PX = 10;
export const EDGE_DRAG_VELOCITY_PX_MS = 0.35;

export type Point = { x: number; y: number; t: number };

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function pointerTravelPx(start: Point, end: { x: number; y: number }): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

/** 48px 이상이거나 24px 이상 + 빠른 속도일 때만 확정 */
export function shouldCommitAxisGesture(along: number, dt: number): boolean {
  if (along < EDGE_DRAG_MIN_INTENT_PX) return false;
  const velocity = along / Math.max(1, dt);
  return along >= EDGE_DRAG_THRESHOLD_PX || velocity >= EDGE_DRAG_VELOCITY_PX_MS;
}

export type PanelHeaderDragBind = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onLostPointerCapture: () => void;
};

/** 열린 패널 헤더에서 바깥 방향으로 드래그해 닫기. 본문 스크롤과 분리. */
export function usePanelHeaderCloseDrag(options: {
  enabled: boolean;
  closeDir: 1 | -1;
  onProgress: (progress: number | null) => void;
  onClose: () => void;
}): PanelHeaderDragBind {
  const { enabled, closeDir, onProgress, onClose } = options;
  const pointerIdRef = useRef<number | null>(null);
  const startRef = useRef<Point | null>(null);
  const axisRef = useRef<"x" | "y" | null>(null);
  const draggedRef = useRef(false);
  const rejectRef = useRef(false);

  const reset = useCallback(() => {
    pointerIdRef.current = null;
    startRef.current = null;
    axisRef.current = null;
    draggedRef.current = false;
    rejectRef.current = false;
    onProgress(null);
  }, [onProgress]);

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => {
      if (pointerIdRef.current != null) reset();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled, reset]);

  return {
    onPointerDown: (e) => {
      if (!enabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!e.isPrimary) return;
      if (pointerIdRef.current != null) return;
      if ((e.target as HTMLElement | null)?.closest("button, a, input, select, textarea")) return;
      pointerIdRef.current = e.pointerId;
      startRef.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      axisRef.current = null;
      draggedRef.current = false;
      rejectRef.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      if (!enabled || pointerIdRef.current !== e.pointerId || !startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const travel = Math.hypot(dx, dy);
      if (axisRef.current == null) {
        if (travel < EDGE_DRAG_AXIS_LOCK_PX) return;
        axisRef.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        if (axisRef.current === "y") {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* already released */
          }
          reset();
          return;
        }
      }
      if (axisRef.current !== "x") return;
      const alongClose = dx * closeDir;
      if (alongClose <= 0) {
        if (travel > EDGE_DRAG_TAP_SLOP_PX) rejectRef.current = true;
        onProgress(1);
        return;
      }
      draggedRef.current = true;
      const width = Math.max(160, Math.min(window.innerWidth * 0.4, 280));
      const progress = Math.max(0, Math.min(1, 1 - alongClose / width));
      onProgress(prefersReducedMotion() ? (progress <= 0.5 ? 0 : 1) : progress);
    },
    onPointerUp: (e) => {
      if (!enabled || pointerIdRef.current !== e.pointerId || !startRef.current) return;
      const start = startRef.current;
      const alongClose = (e.clientX - start.x) * closeDir;
      const dt = e.timeStamp - start.t;
      const dragged = draggedRef.current;
      const rejected = rejectRef.current;
      pointerIdRef.current = null;
      startRef.current = null;
      axisRef.current = null;
      draggedRef.current = false;
      rejectRef.current = false;
      if (!dragged || rejected || alongClose <= 0) {
        onProgress(null);
        return;
      }
      if (shouldCommitAxisGesture(alongClose, dt)) onClose();
      onProgress(null);
    },
    onPointerCancel: () => {
      if (pointerIdRef.current != null) reset();
    },
    onLostPointerCapture: () => {
      if (pointerIdRef.current != null) reset();
    },
  };
}

import {
  EDGE_DRAG_AXIS_LOCK_PX,
  EDGE_DRAG_TAP_SLOP_PX,
  prefersReducedMotion,
  shouldCommitAxisGesture,
  type Point,
} from "./usePanelHeaderCloseDrag";
import type { EdgeSide } from "./EdgePanelHandle";

export const EDGE_GESTURE_BAND_PX = 20;

const YIELD_SELECTOR =
  "button, a, input, select, textarea, [role='button'], .mapboxgl-control, .mapboxgl-ctrl, .mapboxgl-ctrl-group, .route-dock-anchor, .ride-control-anchor";

type EdgeCallbacks = {
  openDir: number;
  onOpen: () => void;
  onClose: () => void;
  onDragProgress: (progress: number | null) => void;
};

type ActiveSession = {
  edge: EdgeSide;
  pointerId: number;
  start: Point;
  axis: "x" | "y" | null;
  dragged: boolean;
  reject: boolean;
  captureEl: Element;
  callbacks: EdgeCallbacks;
  viewportWidth: number;
  viewportHeight: number;
};

let session: ActiveSession | null = null;
let bound = false;
let registrations = 0;

function inHorizontalBand(edge: EdgeSide, clientX: number): boolean {
  const w = window.innerWidth;
  if (edge === "left") return clientX <= EDGE_GESTURE_BAND_PX;
  return w - clientX <= EDGE_GESTURE_BAND_PX;
}

function inVerticalBand(clientY: number, marker: HTMLElement | null): boolean {
  if (!marker) return true;
  const r = marker.getBoundingClientRect();
  return clientY >= r.top && clientY <= r.bottom;
}

function shouldYieldAt(clientX: number, clientY: number): boolean {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return true;
  return Boolean(hit.closest(YIELD_SELECTOR));
}

function clearSession() {
  if (!session) return;
  const { captureEl, pointerId, callbacks } = session;
  session = null;
  callbacks.onDragProgress(null);
  try {
    if (captureEl.hasPointerCapture?.(pointerId)) captureEl.releasePointerCapture(pointerId);
  } catch {
    /* already released */
  }
}

function pickCaptureTarget(clientX: number, clientY: number): Element {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return document.body;
  const canvas = hit.closest(".mapboxgl-canvas");
  if (canvas) return canvas;
  return hit;
}

function onDocumentPointerMove(e: PointerEvent) {
  if (!session || session.pointerId !== e.pointerId) return;
  e.stopPropagation();
  const { start, callbacks } = session;
  const openDir = callbacks.openDir;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  const travel = Math.hypot(dx, dy);
  if (session.axis == null) {
    if (travel < EDGE_DRAG_AXIS_LOCK_PX) return;
    session.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    if (session.axis === "y") {
      clearSession();
      return;
    }
    e.preventDefault();
  }
  if (session.axis !== "x") return;
  const along = dx * openDir;
  if (along <= 0) {
    if (travel > EDGE_DRAG_TAP_SLOP_PX) session.reject = true;
    callbacks.onDragProgress(0);
    return;
  }
  session.dragged = true;
  e.preventDefault();
  const width = Math.max(160, Math.min(window.innerWidth * 0.4, 280));
  const progress = Math.max(0, Math.min(1, along / width));
  callbacks.onDragProgress(prefersReducedMotion() ? (progress >= 0.5 ? 1 : 0) : progress);
}

function onDocumentPointerEnd(e: PointerEvent) {
  if (!session || session.pointerId !== e.pointerId) return;
  e.preventDefault();
  e.stopPropagation();
  const { start, callbacks, dragged, reject, viewportWidth, viewportHeight } = session;
  const viewportChanged = viewportWidth !== window.innerWidth || viewportHeight !== window.innerHeight;
  const along = (e.clientX - start.x) * callbacks.openDir;
  const dt = e.timeStamp - start.t;
  if (dragged) blockFollowupClick();
  clearSession();

  if (!dragged) return;
  if (reject || viewportChanged || along <= 0) return;
  if (shouldCommitAxisGesture(along, dt)) callbacks.onOpen();
  else callbacks.onClose();
}

/** Pointerup can generate a compatibility click on Mapbox after the panel opens. */
function blockFollowupClick() {
  const cleanup = () => {
    document.removeEventListener("click", block, true);
    document.removeEventListener("pointerdown", cleanup, true);
    window.clearTimeout(timeout);
  };
  const block = (e: MouseEvent) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    cleanup();
  };
  const timeout = window.setTimeout(cleanup, 500);
  document.addEventListener("click", block, true);
  document.addEventListener("pointerdown", cleanup, true);
}

function onDocumentPointerCancel(e: PointerEvent) {
  if (!session || session.pointerId !== e.pointerId) return;
  clearSession();
}

function onResize() {
  clearSession();
}

function onTouchStart(e: TouchEvent) {
  if (!session) return;
  e.preventDefault();
  e.stopPropagation();
}

function ensureDocumentListeners() {
  if (bound) return;
  bound = true;
  document.addEventListener("pointermove", onDocumentPointerMove, true);
  document.addEventListener("pointerup", onDocumentPointerEnd, true);
  document.addEventListener("pointercancel", onDocumentPointerCancel, true);
  document.addEventListener("lostpointercapture", onDocumentPointerCancel, true);
  document.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
  window.addEventListener("resize", onResize);
}

export function tryStartEdgeGesture(
  edge: EdgeSide,
  e: PointerEvent,
  marker: HTMLElement | null,
  callbacks: EdgeCallbacks,
): boolean {
  if (session) {
    if (e.pointerId !== session.pointerId) clearSession();
    return false;
  }
  if (e.pointerType === "mouse" && e.button !== 0) return false;
  if (!e.isPrimary) return false;
  if (!inHorizontalBand(edge, e.clientX)) return false;
  if (!inVerticalBand(e.clientY, marker)) return false;
  if (shouldYieldAt(e.clientX, e.clientY)) return false;

  const captureEl = pickCaptureTarget(e.clientX, e.clientY);
  session = {
    edge,
    pointerId: e.pointerId,
    start: { x: e.clientX, y: e.clientY, t: e.timeStamp },
    axis: null,
    dragged: false,
    reject: false,
    captureEl,
    callbacks,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };

  try {
    captureEl.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }

  e.preventDefault();
  e.stopPropagation();
  return true;
}

export function registerEdgeDocumentGesture(
  edge: EdgeSide,
  enabled: boolean,
  getMarker: () => HTMLElement | null,
  callbacks: EdgeCallbacks,
): () => void {
  ensureDocumentListeners();
  registrations += 1;

  const onPointerDown = (e: PointerEvent) => {
    if (!enabled) return;
    tryStartEdgeGesture(edge, e, getMarker(), callbacks);
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    if (session?.edge === edge) clearSession();
    registrations -= 1;
    if (registrations === 0) {
      document.removeEventListener("pointermove", onDocumentPointerMove, true);
      document.removeEventListener("pointerup", onDocumentPointerEnd, true);
      document.removeEventListener("pointercancel", onDocumentPointerCancel, true);
      document.removeEventListener("lostpointercapture", onDocumentPointerCancel, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      window.removeEventListener("resize", onResize);
      bound = false;
    }
  };
}

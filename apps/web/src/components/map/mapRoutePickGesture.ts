import type { Map as MapboxMap, MapboxEvent } from "mapbox-gl";
import type { LngLat } from "../../lib/geo/geo";

export const MAP_ROUTE_PICK_LONG_PRESS_MS = 500;
export const MAP_ROUTE_PICK_MOVE_TOLERANCE_PX = 10;
export const MAP_ROUTE_PICK_GESTURE_SUPPRESS_MS = 300;
/** 짧은 탭 상한 — 롱프레스보다 짧아야 한다 */
const MAP_ROUTE_PICK_SHORT_TAP_MAX_MS = 450;

export type MapRoutePickCommit = {
  lngLat: LngLat;
  point: { x: number; y: number };
};

export function isMapboxCanvasTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as HTMLCanvasElement;
  return (
    typeof el.classList?.contains === "function" &&
    el.classList.contains("mapboxgl-canvas")
  );
}

export function pointerDeltaPx(
  start: { x: number; y: number },
  current: { x: number; y: number },
): number {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return Math.hypot(dx, dy);
}

export function exceedsMoveTolerance(
  start: { x: number; y: number },
  current: { x: number; y: number },
  tolerancePx = MAP_ROUTE_PICK_MOVE_TOLERANCE_PX,
): boolean {
  return pointerDeltaPx(start, current) > tolerancePx;
}

export type MapRoutePickGestureAttachOptions = {
  map: MapboxMap;
  longPressMs?: number;
  moveTolerancePx?: number;
  gestureSuppressMs?: number;
  shortTapMaxMs?: number;
  getAutoRouteMapPick: () => "start" | "direction" | null;
  isRoutePickOverlayOpen: () => boolean;
  shouldBlockPick: () => boolean;
  onLongPressPick: (commit: MapRoutePickCommit) => void;
  onDirectionShortTap: (commit: MapRoutePickCommit) => void;
  /** 출발 지점 클릭 대기(`pick_start`) 중의 짧은 탭 — 간편 인터벌 주행이 쓴다 */
  onStartShortTap?: (commit: MapRoutePickCommit) => void;
  onShortTapNoPick?: () => void;
  onActivityPinShortTap?: (commit: MapRoutePickCommit) => boolean;
  now?: () => number;
  scheduleTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancelScheduled?: (id: ReturnType<typeof setTimeout>) => void;
};

type ActivePointer = {
  id: number;
  pointerType: string;
  startClient: { x: number; y: number };
  startAt: number;
  startedOnCanvas: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  longPressFired: boolean;
  canceled: boolean;
};

export function attachMapRoutePickGesture(
  options: MapRoutePickGestureAttachOptions,
): () => void {
  const longPressMs = options.longPressMs ?? MAP_ROUTE_PICK_LONG_PRESS_MS;
  const moveTolerancePx = options.moveTolerancePx ?? MAP_ROUTE_PICK_MOVE_TOLERANCE_PX;
  const gestureSuppressMs =
    options.gestureSuppressMs ?? MAP_ROUTE_PICK_GESTURE_SUPPRESS_MS;
  const shortTapMaxMs = options.shortTapMaxMs ?? MAP_ROUTE_PICK_SHORT_TAP_MAX_MS;
  const now = options.now ?? (() => performance.now());
  const scheduleTimeout = options.scheduleTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const cancelScheduled = options.cancelScheduled ?? ((id) => clearTimeout(id));

  const canvas = options.map.getCanvas();
  let suppressPickUntil = 0;
  const activePointers = new Map<number, ActivePointer>();
  const userGestures = new Set<string>();
  /** UI 등 canvas 밖에서 시작한 pointerId — 해당 제스처는 pick 으로 쓰지 않는다 */
  const taintedPointerIds = new Set<number>();
  let disposed = false;

  const clearTimer = (session: ActivePointer) => {
    if (session.longPressTimer != null) {
      cancelScheduled(session.longPressTimer);
      session.longPressTimer = null;
    }
  };

  const cancelSession = (session: ActivePointer) => {
    session.canceled = true;
    clearTimer(session);
  };

  const cancelAllSessions = () => {
    for (const session of activePointers.values()) {
      cancelSession(session);
    }
  };

  const noteUserMapGesture = () => {
    suppressPickUntil = now() + gestureSuppressMs;
    cancelAllSessions();
  };

  const lngLatFromClient = (clientX: number, clientY: number): MapRoutePickCommit | null => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const lngLat = options.map.unproject([x, y]);
    return {
      lngLat: [lngLat.lng, lngLat.lat],
      point: { x, y },
    };
  };

  const canBeginPick = (): boolean => {
    if (disposed) return false;
    if (options.shouldBlockPick()) return false;
    if (options.isRoutePickOverlayOpen()) return false;
    if (userGestures.size > 0) return false;
    if (now() < suppressPickUntil) return false;
    return true;
  };

  const fireLongPress = (session: ActivePointer, event: { clientX: number; clientY: number }) => {
    if (session.canceled || session.longPressFired) return;
    if (!canBeginPick()) return;
    const commit = lngLatFromClient(event.clientX, event.clientY);
    if (!commit) return;
    session.longPressFired = true;
    options.onLongPressPick(commit);
  };

  const scheduleLongPress = (session: ActivePointer, event: PointerEvent) => {
    clearTimer(session);
    session.longPressTimer = scheduleTimeout(() => {
      fireLongPress(session, event);
    }, longPressMs);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button != null && event.button !== 0) return;
    if (!event.isPrimary) {
      cancelAllSessions();
      return;
    }
    if (!isMapboxCanvasTarget(event.target)) return;
    if (taintedPointerIds.has(event.pointerId)) return;
    if (!canBeginPick()) return;

    const session: ActivePointer = {
      id: event.pointerId,
      pointerType: event.pointerType,
      startClient: { x: event.clientX, y: event.clientY },
      startAt: now(),
      startedOnCanvas: true,
      longPressTimer: null,
      longPressFired: false,
      canceled: false,
    };
    activePointers.set(event.pointerId, session);
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    scheduleLongPress(session, event);
  };

  const onPointerMove = (event: PointerEvent) => {
    const session = activePointers.get(event.pointerId);
    if (!session || session.canceled) return;
    if (exceedsMoveTolerance(session.startClient, { x: event.clientX, y: event.clientY }, moveTolerancePx)) {
      cancelSession(session);
    }
  };

  const finishPointer = (event: PointerEvent) => {
    const session = activePointers.get(event.pointerId);
    if (!session) return;
    clearTimer(session);
    activePointers.delete(event.pointerId);
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }

    if (session.canceled || !session.startedOnCanvas || taintedPointerIds.has(event.pointerId)) {
      suppressPickUntil = now() + gestureSuppressMs;
      return;
    }

    const duration = now() - session.startAt;
    const commit = lngLatFromClient(event.clientX, event.clientY);
    if (!commit) return;

    if (session.longPressFired) {
      return;
    }

    if (duration > shortTapMaxMs) {
      return;
    }

    if (exceedsMoveTolerance(session.startClient, { x: event.clientX, y: event.clientY }, moveTolerancePx)) {
      return;
    }

    if (!canBeginPick()) return;

    const pickMode = options.getAutoRouteMapPick();
    if (pickMode === "direction") {
      options.onDirectionShortTap(commit);
      return;
    }
    if (pickMode === "start" && options.onStartShortTap) {
      options.onStartShortTap(commit);
      return;
    }

    if (options.onActivityPinShortTap?.(commit)) {
      return;
    }

    options.onShortTapNoPick?.();
  };

  const onPointerUp = (event: PointerEvent) => {
    finishPointer(event);
    taintedPointerIds.delete(event.pointerId);
  };

  const onPointerCancel = (event: PointerEvent) => {
    const session = activePointers.get(event.pointerId);
    // native longpress 뒤의 cancel은 이미 확정한 선택의 취소가 아니다.
    if (session && !session.longPressFired) cancelSession(session);
    finishPointer(event);
    taintedPointerIds.delete(event.pointerId);
  };

  const onContextMenu = (event: Event) => {
    event.preventDefault();
    const session = activePointers.size === 1 ? activePointers.values().next().value : undefined;
    if (session?.pointerType === "touch" && !session.canceled && session.longPressFired) return;
    if (session?.pointerType === "touch" && !session.canceled && canBeginPick()) {
      // 모바일 자체 longpress가 앱 timer보다 먼저/나중에 와도 동일 선택을 한 번만 확정한다.
      clearTimer(session);
      fireLongPress(session, { clientX: session.startClient.x, clientY: session.startClient.y });
      return;
    }
    cancelAllSessions();
  };

  const onDocumentPointerDownCapture = (event: PointerEvent) => {
    taintedPointerIds.delete(event.pointerId);
    if (!event.isPrimary) cancelAllSessions();
    if (event.target === canvas) return;
    taintedPointerIds.add(event.pointerId);
    cancelAllSessions();
  };

  const onDragStart = (e: MapboxEvent & { originalEvent?: Event }) => {
    if (e.originalEvent) { userGestures.add("drag"); noteUserMapGesture(); }
  };

  const onZoomStart = (e: MapboxEvent & { originalEvent?: Event }) => {
    if (e.originalEvent) { userGestures.add("zoom"); noteUserMapGesture(); }
  };

  const onDragEnd = () => { if (userGestures.delete("drag")) noteUserMapGesture(); };
  const onZoomEnd = () => { if (userGestures.delete("zoom")) noteUserMapGesture(); };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      cancelAllSessions();
    }
  };

  const onWindowResize = () => {
    cancelAllSessions();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("pointerdown", onDocumentPointerDownCapture, true);
  // 에지 스와이프가 버블링을 막아도 이동·종료를 관측한다. 중복 종료는 무시한다.
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("pointercancel", onPointerCancel, true);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("blur", onWindowResize);
  options.map.on("dragstart", onDragStart);
  options.map.on("zoomstart", onZoomStart);
  options.map.on("dragend", onDragEnd);
  options.map.on("zoomend", onZoomEnd);

  return () => {
    disposed = true;
    cancelAllSessions();
    activePointers.clear();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("contextmenu", onContextMenu);
    document.removeEventListener("pointerdown", onDocumentPointerDownCapture, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("blur", onWindowResize);
    options.map.off("dragstart", onDragStart);
    options.map.off("zoomstart", onZoomStart);
    options.map.off("dragend", onDragEnd);
    options.map.off("zoomend", onZoomEnd);
  };
}

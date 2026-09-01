export const ROUTE_PICK_DOCK_MARGIN_PX = 8;

export type RectLike = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type RoutePickDockPoint = { x: number; y: number };

export type RoutePickDockFocus = {
  clickPoint?: RoutePickDockPoint | null;
  startPoint?: RoutePickDockPoint | null;
  routePoints?: RoutePickDockPoint[];
};

export type RoutePickDockCandidate = {
  left: number;
  top: number;
  edge: "left" | "right" | "top" | "bottom";
};

function rectFromLike(r: RectLike): RectLike {
  return r;
}

function rectsOverlap(a: RectLike, b: RectLike): boolean {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function overlapArea(a: RectLike, b: RectLike): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

function panelRectAt(left: number, top: number, width: number, height: number): RectLike {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function focusRects(focus: RoutePickDockFocus, radius = 72): RectLike[] {
  const pts = [focus.clickPoint, focus.startPoint, ...(focus.routePoints ?? [])].filter(
    (p): p is RoutePickDockPoint => Boolean(p),
  );
  return pts.map((p) => ({
    left: p.x - radius,
    top: p.y - radius,
    right: p.x + radius,
    bottom: p.y + radius,
    width: radius * 2,
    height: radius * 2,
  }));
}

export function clampRoutePickDockPosition(
  left: number,
  top: number,
  panelWidth: number,
  panelHeight: number,
  viewport: RectLike,
  margin = ROUTE_PICK_DOCK_MARGIN_PX,
): { left: number; top: number } {
  const maxLeft = Math.max(margin, viewport.width - panelWidth - margin);
  const maxTop = Math.max(margin, viewport.height - panelHeight - margin);
  return {
    left: Math.min(maxLeft, Math.max(margin, left)),
    top: Math.min(maxTop, Math.max(margin, top)),
  };
}

export function buildRoutePickDockCandidates(
  viewport: RectLike,
  panelWidth: number,
  panelHeight: number,
  margin = ROUTE_PICK_DOCK_MARGIN_PX,
): RoutePickDockCandidate[] {
  const left = margin;
  const top = margin;
  const right = Math.max(margin, viewport.width - panelWidth - margin);
  const bottom = Math.max(margin, viewport.height - panelHeight - margin);
  const centerY = Math.max(margin, (viewport.height - panelHeight) / 2);
  const centerX = Math.max(margin, (viewport.width - panelWidth) / 2);
  return [
    { left, top: centerY, edge: "left" },
    { left: right, top: centerY, edge: "right" },
    { left: centerX, top, edge: "top" },
    { left: centerX, top: bottom, edge: "bottom" },
    { left, top, edge: "left" },
    { left: right, top, edge: "right" },
    { left, top: bottom, edge: "left" },
    { left: right, top: bottom, edge: "right" },
  ];
}

export function scoreRoutePickDockCandidate(
  candidate: RoutePickDockCandidate,
  panelWidth: number,
  panelHeight: number,
  reservedRects: RectLike[],
  focus: RoutePickDockFocus,
): number {
  const panel = panelRectAt(candidate.left, candidate.top, panelWidth, panelHeight);
  let score = 0;
  for (const reserved of reservedRects) {
    score += overlapArea(panel, reserved) * 4;
  }
  for (const focusRect of focusRects(focus)) {
    score += overlapArea(panel, focusRect) * 6;
  }
  if (candidate.edge === "left" || candidate.edge === "right") {
    score -= 12;
  }
  return score;
}

export function pickRoutePickDockPosition(input: {
  viewport: RectLike;
  panelWidth: number;
  panelHeight: number;
  reservedRects: RectLike[];
  focus: RoutePickDockFocus;
  savedPosition?: { left: number; top: number } | null;
  margin?: number;
}): { left: number; top: number } {
  const margin = input.margin ?? ROUTE_PICK_DOCK_MARGIN_PX;
  if (input.savedPosition) {
    return clampRoutePickDockPosition(
      input.savedPosition.left,
      input.savedPosition.top,
      input.panelWidth,
      input.panelHeight,
      input.viewport,
      margin,
    );
  }
  const candidates = buildRoutePickDockCandidates(
    input.viewport,
    input.panelWidth,
    input.panelHeight,
    margin,
  );
  let best = candidates[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const score = scoreRoutePickDockCandidate(
      candidate,
      input.panelWidth,
      input.panelHeight,
      input.reservedRects,
      input.focus,
    );
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return clampRoutePickDockPosition(
    best.left,
    best.top,
    input.panelWidth,
    input.panelHeight,
    input.viewport,
    margin,
  );
}

export const ROUTE_PICK_DOCK_HUD_SELECTORS = [
  ".map-hud",
  ".route-dock-anchor",
  ".map-view__nav-control-wrap",
  ".elevation-overlay",
  "[data-route-pick-dock-reserved]",
] as const;

export function collectRoutePickDockReservedRects(root: ParentNode): RectLike[] {
  const rects: RectLike[] = [];
  for (const selector of ROUTE_PICK_DOCK_HUD_SELECTORS) {
    for (const el of root.querySelectorAll(selector)) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      rects.push(rectFromLike(rect));
    }
  }
  return rects;
}

export function viewportRectFromElement(el: HTMLElement): RectLike {
  const rect = el.getBoundingClientRect();
  return rectFromLike(rect);
}

export function mapLngLatToContainerPoint(
  map: { project(lnglat: { lng: number; lat: number }): { x: number; y: number } },
  lngLat: [number, number],
): RoutePickDockPoint {
  const p = map.project({ lng: lngLat[0], lat: lngLat[1] });
  return { x: p.x, y: p.y };
}

export function mountRoutePickDockDrag(input: {
  handleEl: HTMLElement;
  panelEl: HTMLElement;
  mapCanvas: HTMLElement;
  getPosition: () => { left: number; top: number };
  onPositionChange: (pos: { left: number; top: number }) => void;
  onDraggingChange?: (dragging: boolean) => void;
}): () => void {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    const pos = input.getPosition();
    originLeft = pos.left;
    originTop = pos.top;
    input.handleEl.setPointerCapture(event.pointerId);
    input.onDraggingChange?.(true);
    event.preventDefault();
    event.stopPropagation();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    input.onPositionChange({ left: originLeft + dx, top: originTop + dy });
    event.preventDefault();
    event.stopPropagation();
  };

  const endDrag = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (input.handleEl.hasPointerCapture(event.pointerId)) {
      input.handleEl.releasePointerCapture(event.pointerId);
    }
    input.onDraggingChange?.(false);
    event.preventDefault();
    event.stopPropagation();
  };

  input.handleEl.addEventListener("pointerdown", onPointerDown);
  input.handleEl.addEventListener("pointermove", onPointerMove);
  input.handleEl.addEventListener("pointerup", endDrag);
  input.handleEl.addEventListener("pointercancel", endDrag);

  return () => {
    input.handleEl.removeEventListener("pointerdown", onPointerDown);
    input.handleEl.removeEventListener("pointermove", onPointerMove);
    input.handleEl.removeEventListener("pointerup", endDrag);
    input.handleEl.removeEventListener("pointercancel", endDrag);
  };
}

export function rectsOverlapAny(panel: RectLike, others: RectLike[]): boolean {
  return others.some((other) => rectsOverlap(panel, other));
}

export function toCanvasLocalRect(rect: RectLike, canvasRect: RectLike): RectLike {
  return {
    left: rect.left - canvasRect.left,
    top: rect.top - canvasRect.top,
    right: rect.right - canvasRect.left,
    bottom: rect.bottom - canvasRect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function buildRoutePickDockFocus(input: {
  click?: RoutePickDockPoint | null;
  start?: RoutePickDockPoint | null;
  routePoints?: RoutePickDockPoint[];
}): RoutePickDockFocus {
  return {
    clickPoint: input.click ?? null,
    startPoint: input.start ?? null,
    routePoints: input.routePoints ?? [],
  };
}

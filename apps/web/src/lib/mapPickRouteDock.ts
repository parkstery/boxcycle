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

export function panelReservedOverlapArea(
  panel: RectLike,
  reservedRects: RectLike[],
): number {
  let total = 0;
  for (const reserved of reservedRects) {
    total += overlapArea(panel, reserved);
  }
  return total;
}

export function panelFocusOverlapArea(panel: RectLike, focus: RoutePickDockFocus): number {
  let total = 0;
  for (const focusRect of focusRects(focus)) {
    total += overlapArea(panel, focusRect);
  }
  return total;
}

/** @deprecated 진단·회귀용. 위치 선택은 pickRoutePickDockPosition의 lexicographic 규칙을 따른다. */
export function scoreRoutePickDockCandidate(
  candidate: RoutePickDockCandidate,
  panelWidth: number,
  panelHeight: number,
  reservedRects: RectLike[],
  focus: RoutePickDockFocus,
): number {
  const panel = panelRectAt(candidate.left, candidate.top, panelWidth, panelHeight);
  return (
    panelReservedOverlapArea(panel, reservedRects) * 4 +
    panelFocusOverlapArea(panel, focus) * 6 -
    (candidate.edge === "left" || candidate.edge === "right" ? 12 : 0)
  );
}

function edgePreferenceRank(edge: RoutePickDockCandidate["edge"]): number {
  return edge === "left" || edge === "right" ? 0 : 1;
}

export function pickBestRoutePickDockCandidate(input: {
  candidates: RoutePickDockCandidate[];
  panelWidth: number;
  panelHeight: number;
  reservedRects: RectLike[];
  focus: RoutePickDockFocus;
}): RoutePickDockCandidate {
  const scored = input.candidates.map((candidate, index) => {
    const panel = panelRectAt(candidate.left, candidate.top, input.panelWidth, input.panelHeight);
    return {
      candidate,
      index,
      reservedOverlap: panelReservedOverlapArea(panel, input.reservedRects),
      focusOverlap: panelFocusOverlapArea(panel, input.focus),
      edgeRank: edgePreferenceRank(candidate.edge),
    };
  });
  scored.sort((a, b) => {
    if (a.reservedOverlap !== b.reservedOverlap) return a.reservedOverlap - b.reservedOverlap;
    if (a.focusOverlap !== b.focusOverlap) return a.focusOverlap - b.focusOverlap;
    if (a.edgeRank !== b.edgeRank) return a.edgeRank - b.edgeRank;
    return a.index - b.index;
  });
  return scored[0]!.candidate;
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
  const collisionFree = candidates.filter((candidate) => {
    const panel = panelRectAt(candidate.left, candidate.top, input.panelWidth, input.panelHeight);
    return panelReservedOverlapArea(panel, input.reservedRects) === 0;
  });
  const pool = collisionFree.length > 0 ? collisionFree : candidates;
  const best = pickBestRoutePickDockCandidate({
    candidates: pool,
    panelWidth: input.panelWidth,
    panelHeight: input.panelHeight,
    reservedRects: input.reservedRects,
    focus: input.focus,
  });
  return clampRoutePickDockPosition(
    best.left,
    best.top,
    input.panelWidth,
    input.panelHeight,
    input.viewport,
    margin,
  );
}

export const ROUTE_PICK_DOCK_HUD_SLOT_SELECTORS = [
  ".map-hud__tl",
  ".map-hud__tc",
  ".map-hud__tr",
  ".map-hud__tr-under",
  ".map-hud__rs",
  ".map-hud__bc",
  ".map-hud__br",
  ".map-hud__mc",
] as const;

export const ROUTE_PICK_DOCK_HUD_SELECTORS = [
  ...ROUTE_PICK_DOCK_HUD_SLOT_SELECTORS,
  ".route-dock-anchor",
  ".map-view__nav-control-wrap",
  ".elevation-overlay",
  "[data-route-pick-dock-reserved]",
] as const;

function isVisibleDockReservationElement(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number.parseFloat(style.opacity) === 0) return false;
  if (el.getClientRects().length === 0) return false;
  if (el.offsetParent === null && style.position !== "fixed" && style.position !== "sticky") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function collectRoutePickDockReservedRects(root: ParentNode): RectLike[] {
  const rects: RectLike[] = [];
  for (const selector of ROUTE_PICK_DOCK_HUD_SELECTORS) {
    for (const el of root.querySelectorAll(selector)) {
      if (!(el instanceof HTMLElement)) continue;
      if (!isVisibleDockReservationElement(el)) continue;
      const rect = el.getBoundingClientRect();
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

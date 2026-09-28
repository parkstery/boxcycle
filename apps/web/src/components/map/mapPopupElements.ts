/**
 * 지도 위에 띄우는 **DOM 조각** — 지점 팝업(경로 생성)·출발/도착 핀·경유지 마커·
 * 활동 점 팝업·내 라이더 마커 뿌리.
 *
 * 왜 MapView 에서 나왔나 (2026-09-28, 구조 정비 A-3) — 전부 `document.createElement`
 * 로 만들고 콜백을 붙여 돌려주는 순수 제조기다. React 상태도 지도 구독도 모른다.
 * **동작은 바꾸지 않았다 — 자리만 옮겼다.**
 *
 * ⚠️ 팝업 문구는 계약이다. 「경로 생성 잔여 토큰 N개」·`지점 팝업 제목 행`(2026-09-16)은
 * 계약 시험이 문자열째 겨눈다 — 표현을 바꾸려면 시험부터 고쳐라.
 */
import { formatDistanceAutoRouteEta, resolveDistanceAutoRouteEta } from "../../lib/route/distanceAutoRouteEta";
import mapboxgl from "mapbox-gl";
import { formatDistanceAutoRouteDirectionClickHint, DISTANCE_AUTO_ROUTE_KM_MAX, DISTANCE_AUTO_ROUTE_KM_MIN, DISTANCE_AUTO_ROUTE_KM_STEP, DISTANCE_AUTO_ROUTE_REROUTE_HINT, DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_ARIA, DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_LABEL, validateDistanceAutoRouteTargetKm, DISTANCE_AUTO_ROUTE_CHIP_KM } from "../../lib/route/distanceAutoRouteErrors";
import { getDistanceAutoRouteMapBridge } from "../../lib/map/distanceAutoRouteMapBridge";
import type { LngLat } from "../../lib/geo/geo";
import { subscribeRouteTokenEffective } from "../../lib/account/routeTokenSpendBridge";
import { mountRouteTokenPopupFeedback } from "../../lib/account/mountRouteTokenPopupFeedback";
import { ROUTE_TOKEN_INSUFFICIENT_HINT } from "../../lib/account/routeTokenUiCopy";
import { MAX_ROUTE_WAYPOINTS } from "../../lib/geo/routeWaypoints";
import type { RouteProfile } from "../../services/mapboxDirections";
import { fetchMapboxReverseGeocodePlaceName } from "../../services/mapboxReverseGeocode";
import { ensureRiderPedalStripKeyframes } from "../../lib/rider/riderPedalStripKeyframes";
import { RIDER_PEDAL_SPRITE_REVISION } from "../../lib/rider/riderPedalSpriteMeta";
import {
  ACTIVITY_HEAT_DOTS_LAYER,
  ACTIVITY_PULSE_DOTS_LAYER,
} from "./mapLiveOverlayLayers";

/**
 * 지도 탭 팝업 — 경로 프로필(차·자전거·보행) 아이콘.
 * Lucide (https://lucide.dev) `car-front`, `bike`, `footprints` — ISC License.
 */
const PICK_POPUP_PROFILE_ICON_SVG: Record<RouteProfile, string> = {
  driving: `<svg class="map-view__pick-profile-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/></svg>`,
  cycling: `<svg class="map-view__pick-profile-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`,
  walking: `<svg class="map-view__pick-profile-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/></svg>`,
};

export function pickPickPopupAnchor(
  map: mapboxgl.Map,
  e: mapboxgl.MapMouseEvent | mapboxgl.MapLayerMouseEvent,
): "top" | "bottom" | "left" | "right" {
  const canvas = map.getCanvas();
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  const { x, y } = e.point;
  const m = Math.min(80, w * 0.14, h * 0.13);
  if (y < m) return "top";
  if (y > h - m) return "bottom";
  if (x < m) return "left";
  if (x > w - m) return "right";
  return "bottom";
}

export function createLiveRiderMarkerRoot(): {
  root: HTMLDivElement;
  nametag: HTMLDivElement;
  flip: HTMLDivElement;
  sprite: HTMLDivElement;
} {
  ensureRiderPedalStripKeyframes();
  const root = document.createElement("div");
  root.className = "cycling-sim-marker-host map-view__live-rider-host";
  const nametag = document.createElement("div");
  nametag.className = "map-view__rider-nametag map-view__rider-nametag--live";
  nametag.setAttribute("aria-hidden", "true");
  const flip = document.createElement("div");
  flip.className = "cycling-sim-marker-flip";
  const stack = document.createElement("div");
  stack.className = "cycling-sim-marker-stack";
  const sprite = document.createElement("div");
  sprite.className = "cycling-sim-marker-pedal-sprite";
  const baseRaw = import.meta.env.BASE_URL ?? "/";
  const base = baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
  sprite.style.backgroundImage = `url("${base}rider/pedal-sprite.png?v=${RIDER_PEDAL_SPRITE_REVISION}")`;
  stack.appendChild(sprite);
  flip.appendChild(stack);
  root.appendChild(nametag);
  root.appendChild(flip);
  root.title = "내 위치";
  return { root, nametag, flip, sprite };
}

/** Mapbox 기본 핀 형태 — 흰 원 없이 핀 머리에 큰 흰색 S/E */
export function createRouteEndpointPinEl(kind: "start" | "end"): HTMLDivElement {
  const color = kind === "start" ? "#16a34a" : "#dc2626";
  const letter = kind === "start" ? "S" : "E";
  const root = document.createElement("div");
  root.className = `map-view__route-pin map-view__route-pin--${kind}`;
  root.title = kind === "start" ? "출발 (Start)" : "도착 (End)";
  root.setAttribute("aria-label", root.title);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("display", "block");
  svg.setAttribute("height", "41");
  svg.setAttribute("width", "27");
  svg.setAttribute("viewBox", "0 0 27 41");
  svg.setAttribute("aria-hidden", "true");

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("fill-rule", "nonzero");

  const pinPath =
    "M27,13.5 C27,19.074644 20.250001,27.000002 14.75,34.500002 C14.016665,35.500004 12.983335,35.500004 12.25,34.500002 C6.7499993,27.000002 0,19.222448 0,13.5 C0,6.0441559 6.0441559,0 13.5,0 C20.955844,0 27,6.0441559 27,13.5 Z";

  const shadow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shadow.setAttribute("fill", "rgba(0,0,0,0.25)");
  shadow.setAttribute("d", pinPath);
  shadow.setAttribute("transform", "translate(3,3)");

  const fill = document.createElementNS("http://www.w3.org/2000/svg", "path");
  fill.setAttribute("fill", color);
  fill.setAttribute("d", pinPath);

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", "13.5");
  text.setAttribute("y", "14.5");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("fill", "#ffffff");
  text.setAttribute("font-size", "13");
  text.setAttribute("font-weight", "800");
  text.setAttribute("font-family", "system-ui, -apple-system, Segoe UI, sans-serif");
  text.setAttribute("paint-order", "stroke fill");
  text.setAttribute("stroke", "rgba(0,0,0,0.35)");
  text.setAttribute("stroke-width", "0.6");
  text.textContent = letter;

  g.append(shadow, fill, text);
  svg.append(g);
  root.append(svg);
  return root;
}

export function createWaypointMarkerEl(order: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "map-view__waypoint-marker";
  el.textContent = String(order);
  el.title = `경과지 ${order}`;
  return el;
}

function isWaypointSlotEnabled(currentCount: number, slot: 0 | 1 | 2): boolean {
  if (slot < currentCount) return true;
  if (slot === currentCount && currentCount < MAX_ROUTE_WAYPOINTS) return true;
  return false;
}

function waypointSlotTitle(slot: 0 | 1 | 2, count: number): string {
  if (isWaypointSlotEnabled(count, slot)) {
    return slot < count
      ? `Move waypoint ${slot + 1} here`
      : `Add waypoint ${slot + 1} here`;
  }
  if (slot > count) {
    return `Set WP${count + 1} before WP${slot + 1}`;
  }
  return "No more waypoints";
}

async function fetchPointElevationMeters(lngLat: LngLat, signal: AbortSignal): Promise<number | null> {
  const [lng, lat] = lngLat;
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const data = (await response.json()) as { elevation?: number[] };
  const v = data.elevation?.[0];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function buildActivityWorldPopupElement(text: string, kind: "pulse" | "heat"): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = `map-view__activity-popup map-view__activity-popup--${kind}`;
  const lines = text.split("\n").filter((line) => line.length > 0);
  const title = document.createElement("div");
  title.className = "map-view__activity-popup-title";
  title.textContent = lines[0] ?? "Activity";
  wrap.appendChild(title);
  if (lines.length > 1) {
    const body = document.createElement("div");
    body.className = "map-view__activity-popup-body";
    body.textContent = lines.slice(1).join(" · ");
    wrap.appendChild(body);
  }
  return wrap;
}

export function tryOpenActivityWorldPinPopup(
  map: mapboxgl.Map,
  event: mapboxgl.MapMouseEvent,
  getLabel: (publicationId: string, kind: "pulse" | "heat") => string | null,
  popupRef: { current: mapboxgl.Popup | null },
  pickAnchor: (map: mapboxgl.Map, event: mapboxgl.MapMouseEvent) => mapboxgl.Anchor,
): boolean {
  const layers = [ACTIVITY_PULSE_DOTS_LAYER, ACTIVITY_HEAT_DOTS_LAYER].filter((id) =>
    map.getLayer(id),
  );
  if (!layers.length) return false;
  const features = map.queryRenderedFeatures(event.point, { layers });
  if (!features.length) return false;
  const hit = features[0];
  const publicationId = hit.properties?.publicationId;
  if (typeof publicationId !== "string" || !publicationId.trim()) return false;
  const kind: "pulse" | "heat" = hit.layer?.id === ACTIVITY_HEAT_DOTS_LAYER ? "heat" : "pulse";
  const label = getLabel(publicationId.trim(), kind);
  if (!label) return false;

  popupRef.current?.remove();
  const popup = new mapboxgl.Popup({
    closeOnClick: true,
    className: "map-view__activity-popup-wrap",
    maxWidth: "min(16rem, calc(100vw - 1.5rem))",
    anchor: pickAnchor(map, event),
    offset: 12,
  })
    .setLngLat(event.lngLat)
    .setDOMContent(buildActivityWorldPopupElement(label, kind))
    .addTo(map);
  popup.on("close", () => {
    if (popupRef.current === popup) popupRef.current = null;
  });
  popupRef.current = popup;
  return true;
}

export type PickPopupAutoRouteUi = {
  setInlinePhase: (
    phase: "idle" | "direction" | "searching" | "found" | "failed",
    message?: string,
  ) => void;
  tryArmDirectionPick: () => void;
  /**
   * 목표 거리 슬라이더·숫자 입력을 지정 km 로 맞춘다.
   * popup 은 명령형 DOM 이라 React state 변화로 다시 그려지지 않는다 — 값이 바뀌는 지점에서
   * 명시적으로 부른다(`queueMicrotask` 타이밍 맞추기를 늘리지 않는다).
   */
  syncDistanceInputs: (km: number) => void;
};

export function buildPickPopup(deps: {
  lngLat: LngLat;
  getWaypointCount: () => number;
  accessToken: string;
  signal: AbortSignal;
  onSelectPoint: (
    type: "start" | "end" | "waypoint",
    lngLat: LngLat,
    waypointSlot?: 0 | 1 | 2,
  ) => void;
  initialStart: LngLat | null;
  routeProfile: RouteProfile;
  onRouteProfile: (p: RouteProfile) => void;
  onArmDirectionPick?: (input: {
    start: LngLat;
    profile: RouteProfile;
    targetKm: number;
  }) => { ok: true } | { ok: false; message: string };
  onRegisterAutoRouteUi?: (ui: PickPopupAutoRouteUi) => void;
  /** 예상 시간 계산용 누적 주행 — 없으면 폴백 속도를 쓴다(5A-R2 §4.3) */
  getUserMileage?: () => { totalMeters: number | null; totalSec: number | null };
  onDirectionPickArmed?: () => void;
  onRoutePanelActivated?: () => void;
  onPreviewDistanceAutoRouteCircle?: (input: {
    start: LngLat;
    targetKm: number;
  }) => void;
  onClearDistanceAutoRouteCircle?: () => void;
  onSetRouteProfileOnly?: (p: RouteProfile) => void;
  /** 호출 시점의 Route Token 부족 여부(잔액<1) — true면 수단 버튼 비활성 */
  getRouteTokenInsufficient?: () => boolean;
  /** Conquest — 이 지점 영토의 개척자 한 줄(null=미개척) */
  lookupPioneer?: (lngLat: LngLat) => Promise<string | null>;
  onClearRoute?: (() => void) | undefined;
  onClearAutoRouteClickDebugMarker?: () => void;
  initialHasStart: boolean;
  initialHasEnd: boolean;
  autoRouteSessionActive?: boolean;
  autoRouteTargetKm?: number;
  autoRouteStatusMessage?: string | null;
  closePopup: () => void;
}): HTMLDivElement {
  const {
    lngLat,
    getWaypointCount,
    accessToken,
    signal,
    onSelectPoint,
    initialStart,
    routeProfile,
    onRouteProfile,
    onArmDirectionPick,
    onRegisterAutoRouteUi,
    getUserMileage,
    onDirectionPickArmed,
    onRoutePanelActivated,
    onPreviewDistanceAutoRouteCircle,
    onClearDistanceAutoRouteCircle,
    onSetRouteProfileOnly,
    getRouteTokenInsufficient,
    lookupPioneer,
    onClearRoute,
    onClearAutoRouteClickDebugMarker,
    initialHasStart,
    initialHasEnd,
    autoRouteSessionActive = false,
    autoRouteTargetKm = 10,
    autoRouteStatusMessage = null,
    closePopup,
  } = deps;
  const [lng, lat] = lngLat;

  const wrap = document.createElement("div");
  wrap.className = "map-view__pick";

  /** 팝업이 열린 뒤 출발/도착 클릭으로 갱신되는 끝점 보유 상태(리렌더 전에도 동작). */
  const pins = { start: initialHasStart, end: initialHasEnd };
  let selectedStart = initialStart;
  let currentProfile = routeProfile;
  const mapBridge = getDistanceAutoRouteMapBridge();
  let autoSessionActive = autoRouteSessionActive || mapBridge?.sessionActive || false;
  let distanceDirectionChecked =
    mapBridge?.distanceDirectionMode ?? autoSessionActive;

  function getRouteStart(): LngLat | null {
    const armed = getDistanceAutoRouteMapBridge()?.getArmedStart?.() ?? null;
    return armed ?? selectedStart ?? initialStart;
  }

  function previewCircleForTargetKm(km: number) {
    const start = getRouteStart();
    if (!start || typeof onPreviewDistanceAutoRouteCircle !== "function") return;
    onPreviewDistanceAutoRouteCircle({ start, targetKm: km });
  }

  const addressEl = document.createElement("div");
  addressEl.className = "map-view__pick-address";
  addressEl.textContent = "주소를 불러오는 중…";

  const metaEl = document.createElement("div");
  metaEl.className = "map-view__pick-meta";
  metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 …`;

  const pinRow = document.createElement("div");
  pinRow.className = "map-view__pick-actions map-view__pick-actions--pin-row";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "map-view__pick-btn map-view__pick-btn--start";
  startBtn.textContent = "Start";
  startBtn.title = "Set as start";
  startBtn.setAttribute("aria-label", "Set start");
  startBtn.onclick = () => {
    onClearAutoRouteClickDebugMarker?.();
    getDistanceAutoRouteMapBridge()?.disarm?.();
    onSelectPoint("start", lngLat);
    queueMicrotask(() => {
      if (!getDistanceAutoRouteMapBridge()?.distanceDirectionMode) {
        applyDistanceDirectionMode(false);
      }
    });
    pins.start = true;
    selectedStart = lngLat;
    syncProfileUi();
    syncAutoRouteUi();
    syncTokenUi();
    if (pins.start && distanceDirectionChecked) previewCircleForTargetKm(targetKm);
    onRoutePanelActivated?.();
  };

  const wpSlots: (0 | 1 | 2)[] = [0, 1, 2];
  const initialCount = getWaypointCount();
  const wpButtons: HTMLButtonElement[] = [];
  for (const slot of wpSlots) {
    const wpBtn = document.createElement("button");
    wpBtn.type = "button";
    wpBtn.className = "map-view__pick-btn map-view__pick-btn--wp";
    wpBtn.textContent = `WP${slot + 1}`;
    const enabled = isWaypointSlotEnabled(initialCount, slot);
    wpBtn.disabled = !enabled;
    wpBtn.title = waypointSlotTitle(slot, initialCount);
    wpBtn.setAttribute("aria-label", `Waypoint ${slot + 1} (WP${slot + 1})`);
    wpBtn.onclick = () => {
      const count = getWaypointCount();
      if (!isWaypointSlotEnabled(count, slot)) return;
      onSelectPoint("waypoint", lngLat, slot);
      closePopup();
    };
    wpButtons.push(wpBtn);
  }

  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.className = "map-view__pick-btn map-view__pick-btn--end";
  endBtn.textContent = "End";
  endBtn.title = "Set as end";
  endBtn.setAttribute("aria-label", "Set end");
  endBtn.onclick = () => {
    onSelectPoint("end", lngLat);
    pins.end = true;
    if (!pins.start) closePopup();
    else {
      syncProfileUi();
      syncAutoRouteUi();
      syncTokenUi();
    }
  };

  pinRow.append(startBtn, wpButtons[0]!, wpButtons[1]!, wpButtons[2]!, endBtn);

  const profileSection = document.createElement("div");
  profileSection.className = "map-view__pick-profile-section";

  const rowProfile = document.createElement("div");
  rowProfile.className = "map-view__pick-actions map-view__pick-actions--profile";
  rowProfile.setAttribute("role", "group");

  const profileLabel = document.createElement("span");
  profileLabel.className = "map-view__pick-sr-only";
  profileLabel.id = "map-view-pick-profile-label";
  profileLabel.textContent = "이동수단";
  rowProfile.setAttribute("aria-labelledby", "map-view-pick-profile-label");
  rowProfile.append(profileLabel);

  const tokenSection = document.createElement("div");
  const tokenFeedback = mountRouteTokenPopupFeedback(tokenSection, signal);

  const profileSpecs: { profile: RouteProfile; ariaLabelKo: string }[] = [
    { profile: "driving", ariaLabelKo: "자동차 경로" },
    { profile: "cycling", ariaLabelKo: "자전거 경로" },
    { profile: "walking", ariaLabelKo: "보행 경로" },
  ];

  const profileButtons: HTMLButtonElement[] = [];
  for (const { profile, ariaLabelKo } of profileSpecs) {
    const pb = document.createElement("button");
    pb.type = "button";
    pb.className = "map-view__pick-btn map-view__pick-btn--profile";
    if (profile === currentProfile) pb.classList.add("is-active");
    pb.innerHTML = PICK_POPUP_PROFILE_ICON_SVG[profile];
    pb.title =
      profile === "driving" ? "Route by car" : profile === "walking" ? "Route on foot" : "Route by bike";
    pb.setAttribute("aria-label", ariaLabelKo);
    pb.onclick = () => {
      if (!pins.start) return;
      currentProfile = profile;
      profileButtons.forEach((item, index) => {
        item.classList.toggle("is-active", profileSpecs[index]?.profile === currentProfile);
      });
      const manualRouteReady = pins.start && pins.end && !distanceDirectionChecked;
      if (manualRouteReady) {
        if (getRouteTokenInsufficient?.()) return;
        tokenFeedback.setRoutePending(true);
        onRouteProfile(profile);
      } else {
        onSetRouteProfileOnly?.(profile);
      }
    };
    profileButtons.push(pb);
    rowProfile.appendChild(pb);
  }

  if (typeof onClearRoute === "function") {
    const clearRouteBtn = document.createElement("button");
    clearRouteBtn.type = "button";
    clearRouteBtn.className = "map-view__pick-btn map-view__pick-btn--clear-route";
    clearRouteBtn.textContent = "경로 삭제";
    clearRouteBtn.title = "Clear route";
    clearRouteBtn.setAttribute("aria-label", "경로 전체 삭제");
    clearRouteBtn.onclick = () => {
      onClearRoute();
      onClearDistanceAutoRouteCircle?.();
      pins.start = false;
      pins.end = false;
      selectedStart = null;
      closePopup();
    };
    rowProfile.appendChild(clearRouteBtn);
  }

  function syncProfileUi() {
    const hasStart = pins.start;
    const manualRouteReady = pins.start && pins.end && !distanceDirectionChecked;
    profileSection.hidden = !hasStart;
    rowProfile.hidden = !hasStart;
    wrap.classList.toggle("map-view__pick--awaiting-profile", manualRouteReady);
    profileLabel.textContent = manualRouteReady ? "경로 탐색 유형 선택" : "이동수단";
    profileSpecs.forEach((spec, i) => {
      const pb = profileButtons[i];
      if (!pb) return;
      pb.classList.toggle("is-active", spec.profile === currentProfile);
      if (!manualRouteReady) {
        pb.disabled = false;
        pb.classList.remove("is-disabled");
        pb.title =
          spec.profile === "driving"
            ? "Route by car"
            : spec.profile === "walking"
              ? "Route on foot"
              : "Route by bike";
        return;
      }
      const tokenInsufficient = Boolean(getRouteTokenInsufficient?.());
      pb.disabled = tokenInsufficient;
      pb.classList.toggle("is-disabled", tokenInsufficient);
      pb.title = tokenInsufficient
        ? ROUTE_TOKEN_INSUFFICIENT_HINT
        : spec.profile === "driving"
          ? "Route by car"
          : spec.profile === "walking"
            ? "Route on foot"
            : "Route by bike";
    });
  }

  function syncTokenUi() {
    /*
     * 제목 행은 늘 선다 — 숨기면 긴 주소가 첫 줄로 올라와 닫기 ✕ 를 덮는다.
     * 출발 핀 전에는 「경로 생성」만, 찍으면 「경로 생성 잔여 토큰 N개」(2026-09-16 Chief).
     */
    tokenFeedback.setRouteStartPinned(pins.start);
  }

  profileSection.append(rowProfile);
  syncProfileUi();
  syncTokenUi();

  const autoRouteSection = document.createElement("div");
  autoRouteSection.className = "map-view__pick-auto-route";

  let targetKm = autoRouteTargetKm;

  const distanceRow = document.createElement("div");
  distanceRow.className = "map-view__pick-distance-row";

  const modeField = document.createElement("label");
  modeField.className = "map-view__pick-distance-mode";

  const modeCheckbox = document.createElement("input");
  modeCheckbox.type = "checkbox";
  modeCheckbox.className = "map-view__pick-distance-mode-checkbox";
  modeCheckbox.setAttribute("aria-label", DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_ARIA);

  const modeLabel = document.createElement("span");
  modeLabel.className = "map-view__pick-distance-mode-label";
  modeLabel.textContent = DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_LABEL;

  modeField.append(modeCheckbox, modeLabel);

  const distanceLabel = document.createElement("label");
  distanceLabel.className = "map-view__pick-sr-only";
  distanceLabel.textContent = "목표거리(km)";
  distanceLabel.htmlFor = "map-view-pick-distance-slider";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.className = "map-view__pick-distance-step map-view__pick-distance-step--minus";
  minusBtn.textContent = "−";
  minusBtn.setAttribute("aria-label", "목표 거리 0.5km 감소");

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.className = "map-view__pick-distance-step map-view__pick-distance-step--plus";
  plusBtn.textContent = "+";
  plusBtn.setAttribute("aria-label", "목표 거리 0.5km 증가");

  const distanceSlider = document.createElement("input");
  distanceSlider.type = "range";
  distanceSlider.className = "map-view__pick-distance-slider";
  distanceSlider.id = "map-view-pick-distance-slider";
  /**
   * **슬라이더를 칩으로 대체한다**(5A-R2 §4.2). 추가가 아니라 대체다 — 팝업이 커지면
   * 3D-2 의 공간 최적화를 되돌리는 것이라 실패다.
   *
   * 0.5~120 km 를 0.5 눈금으로 두면 240칸이고 폰 슬라이더 폭 200 px 에서 한 칸이 1 px
   * 미만이라 손가락으로 특정 값을 고를 수 없었다. 자주 쓰는 값을 칩으로 내고, 미세 조정은
   * 이미 있는 `±` 버튼과 숫자 입력이 맡는다. 20 km 초과는 숫자 입력으로 — 드문 경우에
   * UI 공간을 쓰지 않는다.
   */
  distanceSlider.hidden = true;

  const distanceNumber = document.createElement("input");
  distanceNumber.type = "text";
  distanceNumber.inputMode = "decimal";
  distanceNumber.className = "map-view__pick-distance-number";
  distanceNumber.setAttribute("aria-label", "목표거리 km");
  distanceNumber.value = targetKm.toFixed(1);

  const distanceChips = document.createElement("div");
  distanceChips.className = "map-view__pick-distance-chips";
  const chipButtons: { km: number; el: HTMLButtonElement }[] = [];
  for (const km of DISTANCE_AUTO_ROUTE_CHIP_KM) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "map-view__pick-distance-chip";
    chip.textContent = String(km);
    chip.setAttribute("aria-label", `목표 거리 ${km}km`);
    chip.onclick = () => {
      if (!distanceDirectionChecked) return;
      syncDistanceInputs(km);
      previewCircleForTargetKm(km);
      tryArmDirectionPickIfChecked();
    };
    chipButtons.push({ km, el: chip });
    distanceChips.appendChild(chip);
  }

  /** 예상 소요 시간 — 사용자의 누적 평균 속도로 계산한다(5A-R2 §4.3) */
  const distanceEta = document.createElement("p");
  distanceEta.className = "map-view__pick-distance-eta";
  distanceEta.setAttribute("aria-live", "polite");

  distanceRow.append(modeField, distanceLabel, minusBtn, distanceSlider, plusBtn, distanceNumber);
  distanceRow.append(distanceChips, distanceEta);

  const autoRouteStatusSlot = document.createElement("div");
  autoRouteStatusSlot.className = "map-view__pick-auto-route-status-slot";

  const autoRouteStatus = document.createElement("p");
  autoRouteStatus.className = "map-view__pick-auto-route-status map-view__pick-auto-route-status--idle";
  autoRouteStatus.setAttribute("role", "status");
  autoRouteStatus.setAttribute("aria-live", "polite");
  autoRouteStatus.dataset.phase = "idle";

  // 「N km 로 늘려 클릭 지점까지 가기」 버튼은 제거했다(5A-R2 §3).
  // 그 버튼은 directRoadM 을 100m 단위로 **올림**해 목표로 삼아, 목표가 실측 도로거리보다
  // 커지면서 스스로 부족분을 만들고 우회를 불러 중복을 생산했다.
  // `offered` 고지 문구·고스트 마커·점선은 그대로 남는다 — 없앤 것은 버튼뿐이다.
  autoRouteStatusSlot.append(autoRouteStatus);

  function syncDistanceInputs(km: number) {
    targetKm = km;
    for (const c of chipButtons) c.el.classList.toggle("is-active", Math.abs(c.km - km) < 1e-9);
    distanceEta.textContent = formatDistanceAutoRouteEta(
      resolveDistanceAutoRouteEta({
        targetKm: km,
        mileageTotalMeters: getUserMileage?.().totalMeters ?? null,
        mileageTotalSec: getUserMileage?.().totalSec ?? null,
      }),
    );
    distanceNumber.value = km.toFixed(1);
    if (distanceDirectionChecked) {
      minusBtn.disabled = km <= DISTANCE_AUTO_ROUTE_KM_MIN;
      plusBtn.disabled = km >= DISTANCE_AUTO_ROUTE_KM_MAX;
      // 원과 함께 안내 `{N}` 즉시 갱신(검색/결과 문구는 덮지 않음)
      if (autoRouteStatus.dataset.phase === "direction") {
        autoRouteStatus.textContent = formatDistanceAutoRouteDirectionClickHint(km);
      }
    }
  }

  function syncDistanceModeUi() {
    modeCheckbox.checked = distanceDirectionChecked;
    distanceSlider.disabled = !distanceDirectionChecked;
    for (const c of chipButtons) c.el.disabled = !distanceDirectionChecked;
    distanceNumber.disabled = !distanceDirectionChecked;
    distanceRow.classList.toggle(
      "map-view__pick-distance-row--disabled",
      !distanceDirectionChecked,
    );
    if (!distanceDirectionChecked) {
      minusBtn.disabled = true;
      plusBtn.disabled = true;
      return;
    }
    syncDistanceInputs(targetKm);
  }

  function applyDistanceDirectionMode(checked: boolean) {
    distanceDirectionChecked = checked;
    /*
     * 브리지는 **그때그때 다시 찾는다**(2026-09-18 Chief).
     * `mapBridge` 는 팝업을 만들 때 한 번 잡아 둔 값이라, 그 시점에 아직 등록 전이었거나
     * 이후 다시 등록됐으면 `null`·낡은 객체를 붙들고 있다 — 그러면 이 호출이 조용히
     * 사라져 체크를 풀어도 훅은 아무것도 모른다(반경 원이 그대로 남던 원인).
     */
    getDistanceAutoRouteMapBridge()?.setDistanceDirectionMode?.(checked);
    syncDistanceModeUi();
    if (!checked) {
      onClearAutoRouteClickDebugMarker?.();
      // 원을 소유한 쪽에 직접 지우라고 말한다 — 훅의 정리에만 기대지 않는다.
      onClearDistanceAutoRouteCircle?.();
      setInlinePhase("idle");
      return;
    }
    previewCircleForTargetKm(targetKm);
    tryArmDirectionPickIfChecked();
  }

  function tryArmDirectionPickIfChecked() {
    if (!distanceDirectionChecked) return;
    tryArmDirectionPick();
  }

  function stepTargetKm(deltaKm: number) {
    if (!distanceDirectionChecked) return;
    const next = Math.min(
      DISTANCE_AUTO_ROUTE_KM_MAX,
      Math.max(
        DISTANCE_AUTO_ROUTE_KM_MIN,
        Math.round((targetKm + deltaKm) / DISTANCE_AUTO_ROUTE_KM_STEP) * DISTANCE_AUTO_ROUTE_KM_STEP,
      ),
    );
    syncDistanceInputs(next);
    previewCircleForTargetKm(next);
    tryArmDirectionPickIfChecked();
  }

  function setInlinePhase(
    phase: "idle" | "direction" | "searching" | "found" | "failed",
    message?: string,
  ) {
    autoRouteStatus.className = "map-view__pick-auto-route-status";
    autoRouteStatus.dataset.phase = phase;
    if (phase === "idle") {
      autoRouteStatus.textContent = "";
      autoRouteStatus.classList.add("map-view__pick-auto-route-status--idle");
      return;
    }
    if (phase === "direction") {
      autoRouteStatus.textContent =
        message ?? formatDistanceAutoRouteDirectionClickHint(targetKm);
      return;
    }
    if (phase === "searching") {
      autoRouteStatus.classList.add("map-view__pick-auto-route-status--searching");
      autoRouteStatus.textContent =
        message ?? "목표 거리에 맞는 도로 경로를 찾는 중입니다…";
      return;
    }
    if (phase === "failed") {
      autoRouteStatus.classList.add("map-view__pick-auto-route-status--failed");
      autoRouteStatus.textContent = message ?? "경로를 찾지 못했습니다.";
      return;
    }
    autoRouteStatus.classList.add("map-view__pick-auto-route-status--found");
    autoRouteStatus.textContent = message ?? "경로를 찾았습니다.";
  }

  function tryArmDirectionPick() {
    if (!distanceDirectionChecked) return;
    const start = getRouteStart();
    if (!start || typeof onArmDirectionPick !== "function") return;
    if (getRouteTokenInsufficient?.()) {
      setInlinePhase("failed", ROUTE_TOKEN_INSUFFICIENT_HINT);
      return;
    }
    const parsed = Number.parseFloat(distanceNumber.value);
    const validated = validateDistanceAutoRouteTargetKm(parsed);
    if (!validated.ok) {
      setInlinePhase("failed", validated.message);
      return;
    }
    syncDistanceInputs(validated.km);
    previewCircleForTargetKm(validated.km);
    const result = onArmDirectionPick({
      start,
      profile: currentProfile,
      targetKm: validated.km,
    });
    if (!result.ok) {
      setInlinePhase("failed", result.message);
      return;
    }
    autoSessionActive = true;
    const rerouteReady = autoRouteStatus.dataset.phase === "found";
    setInlinePhase(
      "direction",
      rerouteReady || autoRouteStatusMessage === DISTANCE_AUTO_ROUTE_REROUTE_HINT
        ? DISTANCE_AUTO_ROUTE_REROUTE_HINT
        : formatDistanceAutoRouteDirectionClickHint(validated.km),
    );
    onDirectionPickArmed?.();
  }

  onRegisterAutoRouteUi?.({
    setInlinePhase,
    tryArmDirectionPick: tryArmDirectionPickIfChecked,
    syncDistanceInputs,
  });

  modeCheckbox.addEventListener("change", () => {
    applyDistanceDirectionMode(modeCheckbox.checked);
  });


  minusBtn.addEventListener("click", () => {
    if (minusBtn.disabled) return;
    stepTargetKm(-DISTANCE_AUTO_ROUTE_KM_STEP);
  });
  plusBtn.addEventListener("click", () => {
    if (plusBtn.disabled) return;
    stepTargetKm(DISTANCE_AUTO_ROUTE_KM_STEP);
  });

  distanceNumber.addEventListener("change", () => {
    if (!distanceDirectionChecked) return;
    tryArmDirectionPickIfChecked();
  });

  autoRouteSection.append(distanceRow, autoRouteStatusSlot);

  function syncAutoRouteUi() {
    const available = pins.start && typeof onArmDirectionPick === "function";
    autoRouteSection.hidden = !available;
    if (!available) {
      setInlinePhase("idle");
      onClearDistanceAutoRouteCircle?.();
    }
  }
  syncAutoRouteUi();
  syncDistanceModeUi();
  syncDistanceInputs(targetKm);
  if (distanceDirectionChecked && pins.start) {
    tryArmDirectionPickIfChecked();
  }
  if (distanceDirectionChecked && autoRouteStatusMessage) {
    setInlinePhase("found", autoRouteStatusMessage);
  }

  const unsubTokenForProfile = subscribeRouteTokenEffective(() => {
    syncProfileUi();
    syncAutoRouteUi();
    syncTokenUi();
  });
  signal.addEventListener(
    "abort",
    () => {
      unsubTokenForProfile();
      onClearDistanceAutoRouteCircle?.();
    },
    { once: true },
  );

  /** Conquest — 이 지점 영토의 개척자(있을 때만 노출, §3.4 Phase A 유일 노출 지점) */
  const pioneerEl = document.createElement("div");
  pioneerEl.className = "map-view__pick-pioneer";
  pioneerEl.hidden = true;
  if (typeof lookupPioneer === "function") {
    void lookupPioneer(lngLat)
      .then((line) => {
        if (signal.aborted) return;
        if (line) {
          pioneerEl.textContent = line;
          pioneerEl.hidden = false;
        }
      })
      .catch(() => {
        /* noop */
      });
  }

  const dragHandle = document.createElement("div");
  dragHandle.className = "map-view__pick-drag-handle";
  /*
   * 첫 줄 = 제목(「경로 생성 …」), 둘째 줄 = 주소(2026-09-16 Chief).
   * 종전에는 긴 주소가 첫 줄이라 오른쪽 끝의 닫기 ✕ 밑으로 파고들었고, 팝업에
   * 제목 구실을 하는 행이 아예 없었다. 짧은 제목을 위로 올려 둘 다 해결한다.
   */
  dragHandle.append(tokenSection, addressEl, metaEl);

  wrap.append(dragHandle, pioneerEl, pinRow, profileSection, autoRouteSection);

  const token = accessToken.trim();
  if (token.length > 0) {
    void (async () => {
      try {
        const [place, elevM] = await Promise.all([
          fetchMapboxReverseGeocodePlaceName(lngLat, token, signal),
          fetchPointElevationMeters(lngLat, signal),
        ]);
        if (signal.aborted) return;
        addressEl.textContent = place ?? "주소를 찾을 수 없습니다";
        const elevLabel =
          elevM != null && Number.isFinite(elevM) ? `${Math.round(elevM)}m` : "—";
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 ${elevLabel}`;
      } catch {
        if (signal.aborted) return;
        addressEl.textContent = "주소를 불러오지 못했습니다";
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 —`;
      }
    })();
  } else {
    addressEl.textContent = "지도 토큰이 없어 주소를 표시할 수 없습니다";
    void (async () => {
      try {
        const elevM = await fetchPointElevationMeters(lngLat, signal);
        if (signal.aborted) return;
        const elevLabel =
          elevM != null && Number.isFinite(elevM) ? `${Math.round(elevM)}m` : "—";
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 ${elevLabel}`;
      } catch {
        if (signal.aborted) return;
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 —`;
      }
    })();
  }

  // App 측 armDirectionPick(anchor extend) 이 popup DOM 보다 먼저 커밋되면 checkbox 가 한 틱 늦게 맞춰진다.
  queueMicrotask(() => {
    if (signal.aborted) return;
    const live = getDistanceAutoRouteMapBridge();
    if (!live?.distanceDirectionMode) return;
    const armed = live.getArmedStart?.() ?? null;
    if (armed) {
      selectedStart = armed;
      pins.start = true;
    } else if (!pins.start && !selectedStart) {
      return;
    }
    distanceDirectionChecked = true;
    if (typeof live.targetKm === "number" && live.targetKm > 0) {
      syncDistanceInputs(live.targetKm);
    }
    syncDistanceModeUi();
    tryArmDirectionPickIfChecked();
    onDirectionPickArmed?.();
  });

  return wrap;
}

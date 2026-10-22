/**
 * 지도 위에 띄우는 **마커·활동 팝업 DOM 조각** — 출발/도착 핀·임시 지점 핀·경유지 마커·
 * 내 라이더 마커 뿌리·활동 점 팝업.
 *
 * 왜 mapPopupElements 에서 나왔나 (2026-10-22, code-tidy 지시12) — `buildPickPopup`(지점 팝업)과
 * 무관한 독립 제조기가 앞쪽에 섞여 있었다. **동작은 바꾸지 않았다 — 자리만 옮겼다.**
 * 옛 import 경로(`mapPopupElements`)는 그쪽에서 다시 내보내 깨지지 않는다.
 */
import mapboxgl from "mapbox-gl";
import { ensureRiderPedalStripKeyframes } from "../../lib/rider/riderPedalStripKeyframes";
import { RIDER_PEDAL_SPRITE_REVISION } from "../../lib/rider/riderPedalSpriteMeta";
import {
  ACTIVITY_HEAT_DOTS_LAYER,
  ACTIVITY_PULSE_DOTS_LAYER,
} from "./mapLiveOverlayLayers";

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
export function createRouteEndpointPinEl(
  kind: "start" | "end",
  options: { color?: string; letter?: string | null; title?: string } = {},
): HTMLDivElement {
  const color = options.color ?? (kind === "start" ? "#16a34a" : "#dc2626");
  const letter = options.letter === undefined ? (kind === "start" ? "S" : "E") : options.letter;
  const root = document.createElement("div");
  root.className = `map-view__route-pin map-view__route-pin--${kind}`;
  root.title = options.title ?? (kind === "start" ? "출발 (Start)" : "도착 (End)");
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

  if (letter) {
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
  } else {
    g.append(shadow, fill);
  }
  svg.append(g);
  root.append(svg);
  return root;
}

/** 지도 클릭 직후의 임시 지점 — 출발/도착 핀과 같은 실루엣을 흰색으로 표시한다. */
export function createTemporaryRoutePinEl(): HTMLDivElement {
  return createRouteEndpointPinEl("start", {
    color: "#ffffff",
    letter: null,
    title: "선택한 위치",
  });
}

export function createWaypointMarkerEl(order: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "map-view__waypoint-marker";
  el.textContent = String(order);
  el.title = `경과지 ${order}`;
  return el;
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
